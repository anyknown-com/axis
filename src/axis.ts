import { type DragClient, isScrollKey, register } from "./coordinator"
import {
	adjacentSnap,
	clamp,
	easeOutCubic,
	glideDuration,
	MIN_VELOCITY,
	momentumDistance,
	momentumStep,
	nearestSnap,
	parseSnapAlign,
	parseSnapType,
	type SnapItem,
	snapPositions,
	toLogical,
	toPhysical,
	type Vector,
} from "./math"

/** The direction(s) a mouse drag scrolls: horizontal, vertical, or free 2D panning. */
export type AxisMode = "x" | "y" | "both"

/** A single scroll axis. */
export type AxisName = "x" | "y"

/** Options for {@link createAxis}. Every option can be changed later with {@link AxisInstance.setOptions}. */
export interface AxisOptions {
	/**
	 * Which direction a mouse drag scrolls. `"x"` ignores vertical mouse movement, `"y"` ignores horizontal
	 * movement, and `"both"` pans freely in 2D.
	 * @default "x"
	 */
	axis?: AxisMode
	/**
	 * Keep gliding after a fast mouse drag is released. Never applied under `prefers-reduced-motion: reduce`.
	 * @default true
	 */
	momentum?: boolean
	/**
	 * Translate vertical mouse-wheel scrolling into horizontal scrolling. Only used with `axis: "x"`; at either
	 * end the wheel is left alone, so the page keeps scrolling.
	 * @default false
	 */
	wheel?: boolean
	/**
	 * Set `cursor: grab` on the container while it can be dragged, and `grabbing` while dragging.
	 * @default true
	 */
	cursor?: boolean
}

/** Scroll state of one axis. Positions are logical: measured from the start edge, so positive in RTL too. */
export interface AxisState {
	/** Distance scrolled from the start edge, in px (0 to `maxScroll`). */
	scroll: number
	/** Largest possible `scroll`, in px. 0 when the content fits. */
	maxScroll: number
	/** `scroll / maxScroll`, from 0 to 1. 0 when the content fits. */
	progress: number
	/** True when the container is more than 1px away from the start edge. */
	canScrollPrev: boolean
	/** True when the container is more than 1px away from the end edge. */
	canScrollNext: boolean
}

/** Scroll state of both axes, whatever `axis` is set to. */
export interface AxisScrollState {
	x: AxisState
	y: AxisState
	/** True while a mouse drag is scrolling the container. */
	isDragging: boolean
	/** True while the container glides after a drag is released (momentum or settling on a snap position). */
	isMomentum: boolean
}

/** A logical scroll position. Axes that are left out keep their current position. */
export interface AxisPosition {
	x?: number
	y?: number
}

/** Options for {@link AxisInstance.scrollTo}. */
export interface AxisScrollToOptions {
	/** Animate the scroll. Ignored (jumps) under `prefers-reduced-motion: reduce`. @default true */
	animate?: boolean
}

/** An axis instance bound to one scroll container. */
export interface AxisInstance {
	/** The current state. The object is replaced, never mutated, when a value changes. */
	getState(): AxisScrollState
	/** Calls `listener` whenever the state changes. Returns a function that removes the listener. */
	subscribe(listener: (state: AxisScrollState) => void): () => void
	/**
	 * Scrolls `axis` to the previous snap position, or back by 90% of the visible size when it does not snap.
	 * `axis` defaults to the configured axis and is required with `axis: "both"`.
	 */
	scrollPrev(axis?: AxisName): void
	/**
	 * Scrolls `axis` to the next snap position, or forward by 90% of the visible size when it does not snap.
	 * `axis` defaults to the configured axis and is required with `axis: "both"`.
	 */
	scrollNext(axis?: AxisName): void
	/** Scrolls to a logical position (px from the start edge of each axis). */
	scrollTo(position: AxisPosition, options?: AxisScrollToOptions): void
	/** Changes some options. Keys that are left out or `undefined` keep their current value. */
	setOptions(options: AxisOptions): void
	/**
	 * Re-reads the layout: clears the cached snap positions and updates the state. Only needed after a change
	 * axis cannot observe, such as a stylesheet or media query changing snap properties without a resize.
	 */
	refresh(): void
	/** Removes every listener and observer and restores every inline style that axis changed. */
	destroy(): void
}

type Motion = "idle" | "pressed" | "dragging" | "momentum" | "glide" | "wheel"

const AXES = ["x", "y"] as const
const EDGE = 1
const WHEEL_SETTLE_MS = 150
const LINE_HEIGHT = 16
const DRAGGING_ATTR = "data-axis-dragging"
const ZERO: Vector = { x: 0, y: 0 }

const EMPTY_AXIS: AxisState = {
	scroll: 0,
	maxScroll: 0,
	progress: 0,
	canScrollPrev: false,
	canScrollNext: false,
}
const INITIAL_STATE: AxisScrollState = { x: EMPTY_AXIS, y: EMPTY_AXIS, isDragging: false, isMomentum: false }

const DEFAULTS: Required<AxisOptions> = { axis: "x", momentum: true, wheel: false, cursor: true }

function merge(base: Required<AxisOptions>, patch: AxisOptions): Required<AxisOptions> {
	const next = { ...base }
	for (const key of Object.keys(DEFAULTS) as (keyof AxisOptions)[]) {
		if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key]
	}
	return next
}

function axisState(scroll: number, max: number, previous: AxisState): AxisState {
	const next: AxisState = {
		scroll,
		maxScroll: max,
		progress: max > 0 ? scroll / max : 0,
		canScrollPrev: scroll > EDGE,
		canScrollNext: scroll < max - EDGE,
	}
	for (const key of Object.keys(next) as (keyof AxisState)[]) if (next[key] !== previous[key]) return next
	return previous
}

function px(value: string, basis: number) {
	const number = Number.parseFloat(value)
	if (Number.isNaN(number)) return 0
	return value.endsWith("%") ? (basis * number) / 100 : number
}

/**
 * Enhances a scroll container (`overflow: auto`) with mouse drag-scrolling, momentum, snap-aware release,
 * optional wheel translation and an observable scroll state.
 *
 * Native scrolling stays the source of truth: touch, trackpad, keyboard and scrollbar input are untouched,
 * and only a primary-button mouse drag is taken over (by writing `scrollLeft` / `scrollTop`). Nested instances
 * share the drag: the innermost instance that can scroll in the drag's direction takes it.
 */
export function createAxis(el: HTMLElement, options: AxisOptions = {}): AxisInstance {
	const win = el.ownerDocument.defaultView ?? window
	let opts = merge(DEFAULTS, options)
	let state = INITIAL_STATE
	let destroyed = false
	const listeners = new Set<(state: AxisScrollState) => void>()

	const allows = (axis: AxisName) => opts.axis === "both" || opts.axis === axis

	// --- inline style overrides -------------------------------------------------------------------------

	const hadStyleAttr = el.hasAttribute("style")
	// Safari only knows the prefixed property; Chrome aliases the two, so exactly one of them is used.
	const USER_SELECT = "userSelect" in el.style ? "user-select" : "-webkit-user-select"
	const saved = new Map<string, [value: string, priority: string]>()

	// Watches the container (children, and class/style/dir anywhere inside it) and `dir` on every ancestor.
	// The handler is defined with the rest of the wiring below.
	const mutationObserver = new MutationObserver((records) => onMutations(records))

	// axis's own inline styles do not change the layout. Their mutation records are dropped; records that
	// were already pending are handed on as usual.
	const ownStyle = (write: () => void) => {
		const pending = mutationObserver.takeRecords()
		write()
		mutationObserver.takeRecords()
		if (pending.length > 0) queueMicrotask(() => onMutations(pending))
	}

	const override = (prop: string, value: string, important = false) => {
		if (!saved.has(prop)) {
			saved.set(prop, [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)])
		} else if (el.style.getPropertyValue(prop) === value) return
		ownStyle(() => el.style.setProperty(prop, value, important ? "important" : ""))
	}

	const restore = (prop: string) => {
		const original = saved.get(prop)
		if (!original) return
		saved.delete(prop)
		ownStyle(() => {
			if (original[0]) el.style.setProperty(prop, original[0], original[1])
			else el.style.removeProperty(prop)
		})
	}

	// --- geometry: everything below works in logical positions --------------------------------------------

	// Cleared whenever the layout may have changed: resize and mutation observers, setOptions and refresh.
	let snapCache: Record<AxisName, number[]> | null = null
	const invalidate = () => {
		snapCache = null
	}

	const isRtl = () => win.getComputedStyle(el).direction === "rtl"
	const maxScroll = (): Vector => ({
		x: Math.max(0, el.scrollWidth - el.clientWidth),
		y: Math.max(0, el.scrollHeight - el.clientHeight),
	})
	const read = (rtl = isRtl(), max = maxScroll()): Vector => ({
		x: clamp(toLogical(el.scrollLeft, rtl), 0, max.x),
		y: clamp(el.scrollTop, 0, max.y),
	})
	const write = (position: AxisPosition, rtl = isRtl()) => {
		if (position.x !== undefined) el.scrollLeft = toPhysical(position.x, rtl)
		if (position.y !== undefined) el.scrollTop = position.y
	}
	const reducedMotion = () => win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

	const measureSnaps = (): Record<AxisName, number[]> => {
		const style = win.getComputedStyle(el)
		const rect = el.getBoundingClientRect()
		const max = maxScroll()
		const items: Record<AxisName, SnapItem[]> = { x: [], y: [] }
		for (const child of el.children) {
			const childStyle = win.getComputedStyle(child)
			const align = parseSnapAlign(childStyle.scrollSnapAlign)
			if (align.x === "none" && align.y === "none") continue
			const box = child.getBoundingClientRect()
			const margin = (side: string) => px(childStyle.getPropertyValue(`scroll-margin-${side}`), 0)
			const left = margin("left")
			const top = margin("top")
			items.x.push({ start: box.left - left, size: box.width + left + margin("right"), align: align.x })
			items.y.push({ start: box.top - top, size: box.height + top + margin("bottom"), align: align.y })
		}
		const padding = (side: string, basis: number) =>
			px(style.getPropertyValue(`scroll-padding-${side}`), basis)
		return {
			x: snapPositions(
				{
					start: rect.left + el.clientLeft,
					size: el.clientWidth,
					paddingStart: padding("left", el.clientWidth),
					paddingEnd: padding("right", el.clientWidth),
					scroll: el.scrollLeft,
					maxScroll: max.x,
					rtl: style.direction === "rtl",
				},
				items.x,
			),
			y: snapPositions(
				{
					start: rect.top + el.clientTop,
					size: el.clientHeight,
					paddingStart: padding("top", el.clientHeight),
					paddingEnd: padding("bottom", el.clientHeight),
					scroll: el.scrollTop,
					maxScroll: max.y,
					rtl: false,
				},
				items.y,
			),
		}
	}
	const snapPoints = () => (snapCache ??= measureSnaps())

	// --- state --------------------------------------------------------------------------------------------

	let motion: Motion = "idle"

	const syncCursor = (max: Vector) => {
		if (!opts.cursor) restore("cursor")
		else if (motion === "dragging") override("cursor", "grabbing")
		else if ((allows("x") && max.x > 0) || (allows("y") && max.y > 0)) override("cursor", "grab")
		else restore("cursor")
	}

	const update = () => {
		if (destroyed) return
		const max = maxScroll()
		const position = read(isRtl(), max)
		const x = axisState(position.x, max.x, state.x)
		const y = axisState(position.y, max.y, state.y)
		const isDragging = motion === "dragging"
		const isMomentum = motion === "momentum"
		syncCursor(max)
		if (
			x === state.x &&
			y === state.y &&
			isDragging === state.isDragging &&
			isMomentum === state.isMomentum
		) {
			return
		}
		state = { x, y, isDragging, isMomentum }
		for (const listener of listeners) listener(state)
	}

	const setMotion = (next: Motion) => {
		motion = next
		update()
	}

	// --- motion: every lib-driven scroll runs with snap and smooth scrolling switched off inline -----------

	let frame = 0
	let wheelTimer = 0
	let glideTarget: Vector = { x: 0, y: 0 }
	// The computed scroll-snap-type from before the override, or null while nothing is overridden.
	let snapType: string | null = null

	const beginOverride = () => {
		if (snapType !== null) return
		snapType = win.getComputedStyle(el).scrollSnapType
		override("scroll-snap-type", "none", true)
		override("scroll-behavior", "auto", true)
	}

	const endOverride = () => {
		if (snapType === null) return
		snapType = null
		restore("scroll-snap-type")
		restore("scroll-behavior")
	}

	const snapAxes = () => parseSnapType(snapType ?? win.getComputedStyle(el).scrollSnapType)

	// While a drag lasts, the physical scroll position each instance under the pointer holds (see onScroll).
	let held: Vector | null = null
	// True from yield() to pass() or interrupt(): another instance owns the drag and this one holds.
	let yielded = false

	const stop = () => {
		// Every scroll axis drives itself starts here, and it moves the position on purpose.
		held = null
		if (frame) win.cancelAnimationFrame(frame)
		frame = 0
		win.clearTimeout(wheelTimer)
		wheelTimer = 0
	}

	const settle = () => {
		stop()
		// A glide that ends while another instance owns the drag holds where it ended.
		if (yielded) held = { x: el.scrollLeft, y: el.scrollTop }
		endOverride()
		setMotion("idle")
	}

	// Stops a glide, and lets go of a held position, when the user takes over with native input.
	const interrupt = () => {
		held = null
		yielded = false
		if (motion === "momentum" || motion === "glide") settle()
	}

	const jump = (target: AxisPosition) => {
		stop()
		beginOverride()
		write(target)
		settle()
	}

	// Glides both axes to `target` together. Axes missing from `target` stay where they are.
	const animateTo = (target: AxisPosition, velocity: Vector, kind: "momentum" | "glide") => {
		stop()
		const rtl = isRtl()
		const from = read(rtl)
		const moving = AXES.filter(
			(axis) => target[axis] !== undefined && Math.abs(target[axis] - from[axis]) >= 0.5,
		)
		if (moving.length === 0 || reducedMotion()) {
			jump(target)
			return
		}
		beginOverride()
		glideTarget = { x: target.x ?? from.x, y: target.y ?? from.y }
		const distance = { x: glideTarget.x - from.x, y: glideTarget.y - from.y }
		const duration = Math.max(...moving.map((axis) => glideDuration(distance[axis], velocity[axis])))
		const start = win.performance.now()
		setMotion(kind)
		// A listener may have destroyed the instance.
		if (destroyed) return
		const tick = (now: number) => {
			if (destroyed) return
			const eased = easeOutCubic(clamp((now - start) / duration, 0, 1))
			const position: AxisPosition = {}
			for (const axis of moving) position[axis] = from[axis] + distance[axis] * eased
			write(position, rtl)
			if (eased < 1) frame = win.requestAnimationFrame(tick)
			else settle()
		}
		frame = win.requestAnimationFrame(tick)
	}

	const runMomentum = (velocity: Vector) => {
		stop()
		beginOverride()
		setMotion("momentum")
		if (destroyed) return
		const rtl = isRtl()
		const max = maxScroll()
		const position = read(rtl, max)
		const speed = { ...velocity }
		let last = win.performance.now()
		const tick = (now: number) => {
			if (destroyed) return
			const dt = clamp(now - last, 0, 64)
			last = now
			const next: AxisPosition = {}
			for (const axis of AXES) {
				if (speed[axis] === 0) continue
				const advance = momentumStep(speed[axis], dt)
				position[axis] = clamp(position[axis] + advance.distance, 0, max[axis])
				speed[axis] = position[axis] <= 0 || position[axis] >= max[axis] ? 0 : advance.velocity
				next[axis] = position[axis]
			}
			write(next, rtl)
			if (Math.hypot(speed.x, speed.y) < MIN_VELOCITY) settle()
			else frame = win.requestAnimationFrame(tick)
		}
		frame = win.requestAnimationFrame(tick)
	}

	// Called when a drag ends. `velocity` is the logical scroll velocity in px/ms.
	const fling = (velocity: Vector) => {
		const allowed = opts.momentum && !reducedMotion()
		const speed = { x: allowed && allows("x") ? velocity.x : 0, y: allowed && allows("y") ? velocity.y : 0 }
		const snaps = snapAxes()
		if (snaps.x || snaps.y) {
			// Predict where momentum would land, then glide each snapping axis to its nearest snap position.
			const max = maxScroll()
			const from = read(isRtl(), max)
			const positions = snapPoints()
			const target: AxisPosition = {}
			for (const axis of AXES) {
				const landing = clamp(from[axis] + momentumDistance(speed[axis]), 0, max[axis])
				target[axis] = snaps[axis] ? nearestSnap(positions[axis], landing) : landing
			}
			animateTo(target, speed, "momentum")
		} else if (Math.hypot(speed.x, speed.y) > MIN_VELOCITY) runMomentum(speed)
		else settle()
	}

	// --- drag (the coordinator decides which instance owns it) ---------------------------------------------

	let pointerId = -1
	let pressScroll: Vector = { x: 0, y: 0 }

	const holdBack = () => {
		if (!held) return
		if (Math.abs(el.scrollLeft - held.x) >= 1) el.scrollLeft = held.x
		if (Math.abs(el.scrollTop - held.y) >= 1) el.scrollTop = held.y
	}

	const endDrag = () => {
		try {
			if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
		} catch {
			// The pointer is already gone.
		}
		pointerId = -1
		el.removeAttribute(DRAGGING_ATTR)
		restore(USER_SELECT)
	}

	const client: DragClient = {
		el,
		onScrollbar(event) {
			const rect = el.getBoundingClientRect()
			const x = event.clientX - rect.left - el.clientLeft
			const y = event.clientY - rect.top - el.clientTop
			return x < 0 || y < 0 || x >= el.clientWidth || y >= el.clientHeight
		},
		accepts(axis) {
			if (!allows(axis)) return false
			const max = maxScroll()
			return opts.axis === "both" ? max.x > 0 || max.y > 0 : max[axis] > 0
		},
		canScroll(delta) {
			const rtl = isRtl()
			const max = maxScroll()
			const position = read(rtl, max)
			// The content moves with the pointer, so the scroll position moves against it.
			const push = { x: toLogical(-delta.x, rtl), y: -delta.y }
			return AXES.some(
				(axis) =>
					allows(axis) &&
					((push[axis] > 0 && position[axis] < max[axis] - EDGE) ||
						(push[axis] < 0 && position[axis] > EDGE)),
			)
		},
		press() {
			// A press freezes momentum (the glide after a drag, with its snap settling), like grabbing a flung
			// list. Overrides stay on, so the browser cannot re-snap underneath. A glide the page started
			// (scrollTo, prev/next, wheel snapping) keeps going; it only stops when this instance is dragged.
			// Nothing is held yet: until the drag starts, the press may still be a click, and the page's own
			// scrolling (scrollIntoView, focus, anchoring) must work.
			if (motion === "momentum") {
				stop()
				setMotion("pressed")
			} else if (motion === "idle") setMotion("pressed")
		},
		yield() {
			yielded = true
			// A running glide drives the position itself, and holds where it ends (see settle).
			if (motion === "glide" || motion === "wheel") return
			held = { x: el.scrollLeft, y: el.scrollTop }
		},
		start(id) {
			// Start from where the content is now: the page, a scrollTo or prev/next may have moved it during the
			// press. Such a glide stops here, so it can neither fight the drag nor end it.
			stop()
			pressScroll = { x: el.scrollLeft, y: el.scrollTop }
			held = { ...pressScroll }
			pointerId = id
			beginOverride()
			try {
				el.setPointerCapture(id)
			} catch {
				// Synthetic or already released pointer: the coordinator's window listeners still see it.
			}
			el.setAttribute(DRAGGING_ATTR, "")
			override(USER_SELECT, "none")
			win.getSelection()?.removeAllRanges()
			setMotion("dragging")
		},
		move(delta) {
			if (destroyed) return
			if (allows("x")) {
				el.scrollLeft = pressScroll.x - delta.x
				if (held) held.x = el.scrollLeft
			}
			if (allows("y")) {
				el.scrollTop = pressScroll.y - delta.y
				if (held) held.y = el.scrollTop
			}
		},
		pass() {
			// Undo an autoscroll that came after the last scroll event, then let go.
			holdBack()
			held = null
			yielded = false
			// Only settle what the press froze. A glide that kept going during the press runs to its end.
			if (motion !== "pressed") return
			if (snapType !== null) fling(ZERO)
			else setMotion("idle")
		},
		end(velocity) {
			endDrag()
			// Undo an autoscroll that came after the last scroll event, so the release starts where the drag is.
			holdBack()
			fling(velocity ? { x: toLogical(-velocity.x, isRtl()), y: -velocity.y } : ZERO)
		},
		interrupt,
	}

	// --- wheel (axis "x" only: vertical scrolling is already native) -------------------------------------

	let wheelDirection: 1 | -1 = 1

	const settleWheel = () => {
		wheelTimer = 0
		if (destroyed) return
		if (!snapAxes().x) {
			settle()
			return
		}
		// Like native wheel snapping: any wheel travel moves on to the next snap position in that direction.
		const current = read().x
		const positions = snapPoints().x
		const target =
			adjacentSnap(positions, current - 2 * wheelDirection, wheelDirection) ?? nearestSnap(positions, current)
		animateTo({ x: target }, ZERO, "glide")
	}

	const onWheel = (event: WheelEvent) => {
		if (opts.axis !== "x" || event.ctrlKey || event.shiftKey) return
		if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
		if (motion === "pressed" || motion === "dragging") return
		const scale = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? el.clientWidth : 1
		const delta = event.deltaY * scale
		const rtl = isRtl()
		const max = maxScroll()
		const current = read(rtl, max).x
		// At the edge in the wheel's direction: let the page scroll.
		if (delta > 0 ? current >= max.x - EDGE : current <= EDGE) return
		event.preventDefault()
		stop()
		beginOverride()
		wheelDirection = delta > 0 ? 1 : -1
		write({ x: clamp(current + delta, 0, max.x) }, rtl)
		if (motion !== "wheel") setMotion("wheel")
		if (destroyed) return
		wheelTimer = win.setTimeout(settleWheel, WHEEL_SETTLE_MS)
	}

	let wheelAttached = false
	const syncWheel = () => {
		const wanted = opts.wheel && opts.axis === "x"
		if (wanted === wheelAttached) return
		wheelAttached = wanted
		if (wanted) el.addEventListener("wheel", onWheel, { passive: false })
		else el.removeEventListener("wheel", onWheel)
	}

	// --- wiring -------------------------------------------------------------------------------------------

	const resizeObserver = new ResizeObserver(() => {
		invalidate()
		update()
	})
	resizeObserver.observe(el)
	for (const child of el.children) resizeObserver.observe(child)

	const onMutations = (records: MutationRecord[]) => {
		if (destroyed) return
		invalidate()
		// Records can arrive late and out of order (ownStyle defers some), so the current parent decides.
		for (const record of records) {
			if (record.target !== el) continue
			for (const node of [...record.addedNodes, ...record.removedNodes]) {
				if (node.nodeType !== 1) continue
				if (node.parentElement === el) resizeObserver.observe(node as Element)
				else resizeObserver.unobserve(node as Element)
			}
		}
		// Cheap when nothing changed (no notification), and it covers what the resize observer never reports,
		// such as an added 0×0 child that only adds a flex gap.
		update()
	}
	mutationObserver.observe(el, {
		childList: true,
		attributes: true,
		attributeFilter: ["class", "style", "dir"],
		subtree: true,
	})
	// A `dir` change on an ancestor flips the direction without resizing anything. Observing the root again
	// would replace the options above when the container is the root itself.
	const root = el.ownerDocument.documentElement
	if (el !== root) {
		mutationObserver.observe(root, { attributes: true, attributeFilter: ["dir"], subtree: true })
	}

	const onKeyDown = (event: KeyboardEvent) => {
		if (isScrollKey(event)) interrupt()
	}

	const onScroll = () => {
		// Safari autoscrolls the pressed containers towards a pointer held outside them, on any axis and also
		// for instances that do not own the drag. Every instance under the press holds its position until the
		// press ends or the user scrolls with the wheel or keyboard.
		holdBack()
		update()
	}

	const passive = { passive: true }
	el.addEventListener("scroll", onScroll, passive)
	el.addEventListener("wheel", interrupt, passive)
	el.addEventListener("touchstart", interrupt, passive)
	el.addEventListener("keydown", onKeyDown)
	const unregister = register(client)
	syncWheel()
	update()

	const resolveAxis = (method: string, axis: AxisName | undefined): AxisName => {
		if (axis) return axis
		if (opts.axis === "both") {
			throw new Error(`axis: ${method}() needs an axis ("x" or "y") when the instance uses axis: "both"`)
		}
		return opts.axis
	}

	const step = (axis: AxisName, direction: 1 | -1) => {
		if (destroyed || motion === "dragging") return
		const visible = axis === "x" ? el.clientWidth : el.clientHeight
		// Repeated presses during a glide continue from where the glide is heading.
		const max = maxScroll()
		const from = motion === "glide" ? glideTarget[axis] : read(isRtl(), max)[axis]
		const target = snapAxes()[axis]
			? (adjacentSnap(snapPoints()[axis], from, direction) ?? (direction === 1 ? max[axis] : 0))
			: from + direction * visible * 0.9
		animateTo({ [axis]: clamp(target, 0, max[axis]) }, ZERO, "glide")
	}

	return {
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		scrollPrev: (axis) => step(resolveAxis("scrollPrev", axis), -1),
		scrollNext: (axis) => step(resolveAxis("scrollNext", axis), 1),
		scrollTo(position, { animate = true } = {}) {
			if (destroyed || motion === "dragging") return
			const max = maxScroll()
			const target: AxisPosition = {}
			for (const axis of AXES) {
				const value = position[axis]
				if (value !== undefined) target[axis] = clamp(value, 0, max[axis])
			}
			if (animate) animateTo(target, ZERO, "glide")
			else jump(target)
		},
		setOptions(patch) {
			if (destroyed) return
			opts = merge(opts, patch)
			invalidate()
			syncWheel()
			update()
		},
		refresh() {
			if (destroyed) return
			invalidate()
			update()
		},
		destroy() {
			if (destroyed) return
			stop()
			unregister()
			if (pointerId !== -1) endDrag()
			resizeObserver.disconnect()
			mutationObserver.disconnect()
			el.removeEventListener("scroll", onScroll)
			el.removeEventListener("wheel", interrupt)
			el.removeEventListener("touchstart", interrupt)
			el.removeEventListener("keydown", onKeyDown)
			el.removeEventListener("wheel", onWheel)
			el.removeAttribute(DRAGGING_ATTR)
			for (const prop of saved.keys()) restore(prop)
			if (!hadStyleAttr && !el.getAttribute("style")) el.removeAttribute("style")
			destroyed = true
			listeners.clear()
		},
	}
}
