import { register } from "../coordinator"
import { adjacentSnap, clamp, isScrollKey, measureSnaps, type Vector } from "../utils"
import { AXES, DEFAULTS, DRAGGING_ATTR, INITIAL_STATE, PAGE_FRACTION, ZERO } from "./constants"
import { createDragClient } from "./create-drag-client"
import { createGeometry } from "./create-geometry"
import { createHold } from "./create-hold"
import { createScrollDriver } from "./create-scroll-driver"
import { createSnapSuspension } from "./create-snap-suspension"
import { createStyleOverrides } from "./create-style-overrides"
import { createWheel } from "./create-wheel"
import { dragsAlong } from "./drags-along"
import { mergeOptions } from "./merge-options"
import { nextAxisState } from "./next-axis-state"
import { resolveAxis } from "./resolve-axis"
import type {
	AxisCore,
	AxisInstance,
	AxisName,
	AxisOptions,
	AxisPosition,
	AxisScrollState,
	Motion,
} from "./types"

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
	let opts = mergeOptions(DEFAULTS, options)
	let motion: Motion = "idle"
	let destroyed = false
	let state = INITIAL_STATE
	const listeners = new Set<(state: AxisScrollState) => void>()
	const hadStyleAttr = el.hasAttribute("style")
	const mutationObserver = new MutationObserver((records) => onLayoutMutations(records))
	const styles = createStyleOverrides(el, mutationObserver, (records) => onLayoutMutations(records))
	const { override, restore } = styles
	const geometry = createGeometry(win, el)
	const { rtl, scrollRange, position } = geometry
	let snapCache: Record<AxisName, number[]> | null = null

	const invalidate = () => {
		snapCache = null
	}

	const snapPoints = () => (snapCache ??= measureSnaps(win, el))
	const allows = (axis: AxisName) => dragsAlong(opts.axis, axis)

	const syncCursor = (max: Vector) => {
		if (!opts.cursor) restore("cursor")
		else if (motion === "dragging") override("cursor", "grabbing")
		else if ((allows("x") && max.x > 0) || (allows("y") && max.y > 0)) override("cursor", "grab")
		else restore("cursor")
	}

	const update = () => {
		if (destroyed) return

		const max = scrollRange()
		const current = position(rtl(), max)
		const x = nextAxisState(current.x, max.x, state.x)
		const y = nextAxisState(current.y, max.y, state.y)
		const isDragging = motion === "dragging"
		const isMomentum = motion === "momentum"

		syncCursor(max)
		const unchanged = x === state.x && y === state.y && isDragging === state.isDragging

		if (unchanged && isMomentum === state.isMomentum) return

		state = { x, y, isDragging, isMomentum }
		for (const listener of listeners) listener(state)
	}

	const setMotion = (next: Motion) => {
		motion = next
		update()
	}

	const core: AxisCore = {
		...geometry,
		el,
		win,
		options: () => opts,
		motion: () => motion,
		setMotion,
		isDestroyed: () => destroyed,
		snapPoints,
	}

	const snap = createSnapSuspension(win, el, styles)
	const hold = createHold(el)
	const driver = createScrollDriver(core, snap, hold)
	const { stop, interrupt, glideTo } = driver
	const drag = createDragClient(core, snap, hold, driver, styles)
	const wheel = createWheel(core, snap, driver)

	const resizeObserver = new ResizeObserver(() => {
		invalidate()
		update()
	})

	resizeObserver.observe(el)
	for (const child of el.children) resizeObserver.observe(child)

	const observeCurrentChildren = (record: MutationRecord) => {
		for (const node of [...record.addedNodes, ...record.removedNodes]) {
			if (node.nodeType !== 1) continue

			if (node.parentElement === el) resizeObserver.observe(node as Element)
			else resizeObserver.unobserve(node as Element)
		}
	}

	const onLayoutMutations = (records: MutationRecord[]) => {
		if (destroyed) return

		invalidate()
		for (const record of records) if (record.target === el) observeCurrentChildren(record)
		update()
	}

	mutationObserver.observe(el, {
		childList: true,
		attributes: true,
		attributeFilter: ["class", "style", "dir"],
		subtree: true,
	})

	const root = el.ownerDocument.documentElement

	const watchAncestorDirection = () =>
		mutationObserver.observe(root, { attributes: true, attributeFilter: ["dir"], subtree: true })

	if (el !== root) watchAncestorDirection()

	const onKeyDown = (event: KeyboardEvent) => {
		if (isScrollKey(event)) interrupt()
	}

	const holdAgainstSafariAutoscroll = () => {
		hold.undoAutoscroll()
		update()
	}

	const passive = { passive: true }

	el.addEventListener("scroll", holdAgainstSafariAutoscroll, passive)
	el.addEventListener("wheel", interrupt, passive)
	el.addEventListener("touchstart", interrupt, passive)
	el.addEventListener("keydown", onKeyDown)
	const unregister = register(drag.client)

	wheel.sync()
	update()

	const step = (axis: AxisName, direction: 1 | -1) => {
		if (destroyed || motion === "dragging") return

		const visible = axis === "x" ? el.clientWidth : el.clientHeight
		const max = scrollRange()
		const heading = motion === "glide" ? driver.glideTarget()[axis] : position(rtl(), max)[axis]

		const target = snap.snapAxes()[axis]
			? (adjacentSnap(snapPoints()[axis], heading, direction) ?? (direction === 1 ? max[axis] : 0))
			: heading + direction * visible * PAGE_FRACTION

		glideTo({ [axis]: clamp(target, 0, max[axis]) }, ZERO, "glide")
	}

	return {
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener)

			return () => {
				listeners.delete(listener)
			}
		},
		scrollPrev: (axis) => step(resolveAxis("scrollPrev", axis, opts.axis), -1),
		scrollNext: (axis) => step(resolveAxis("scrollNext", axis, opts.axis), 1),
		scrollTo(target, { animate = true } = {}) {
			if (destroyed || motion === "dragging") return

			const max = scrollRange()
			const clamped: AxisPosition = {}

			for (const axis of AXES) {
				const value = target[axis]

				if (value !== undefined) clamped[axis] = clamp(value, 0, max[axis])
			}

			if (animate) glideTo(clamped, ZERO, "glide")
			else driver.jump(clamped)
		},
		setOptions(patch) {
			if (destroyed) return

			opts = mergeOptions(opts, patch)
			invalidate()
			wheel.sync()
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
			drag.endDragIfActive()
			resizeObserver.disconnect()
			mutationObserver.disconnect()
			el.removeEventListener("scroll", holdAgainstSafariAutoscroll)
			el.removeEventListener("wheel", interrupt)
			el.removeEventListener("touchstart", interrupt)
			el.removeEventListener("keydown", onKeyDown)
			wheel.remove()
			el.removeAttribute(DRAGGING_ATTR)
			styles.restoreAll()

			if (!hadStyleAttr && !el.getAttribute("style")) el.removeAttribute("style")

			destroyed = true
			listeners.clear()
		},
	}
}
