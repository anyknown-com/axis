// One coordinator per window decides which instance owns a mouse drag. Nested instances therefore never
// fight: a press is shared by every instance under the pointer until the movement passes the threshold, and
// then exactly one of them takes the whole drag.
import { dominantAxis, type Sample, VELOCITY_WINDOW, type Vector, velocityFromSamples } from "./math"

const DRAG_THRESHOLD = 5
const CLICK_SUPPRESS_MS = 100
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])"
const NO_DRAG = `${EDITABLE}, [data-axis-no-drag]`
const SCROLL_KEYS = new Set([
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"PageUp",
	"PageDown",
	"Home",
	"End",
	" ",
])

/** True for a key press that scrolls: arrows, Page Up/Down, Home, End and Space, outside editable elements. */
export function isScrollKey(event: KeyboardEvent): boolean {
	if (!SCROLL_KEYS.has(event.key)) return false
	const target = event.target as Element | null
	return !target?.closest?.(EDITABLE)
}

/** The side of an instance that the coordinator talks to. */
export interface DragClient {
	readonly el: HTMLElement
	/** True when the press lands on this element's own scrollbar, which belongs to the browser. */
	onScrollbar(event: PointerEvent): boolean
	/** True when this instance drags along `axis` and has something to scroll. */
	accepts(axis: "x" | "y"): boolean
	/** True when this instance can still scroll the way the pointer `delta` pushes it. */
	canScroll(delta: Vector): boolean
	/** A drag may start here: stop any glide and remember the start position. */
	press(): void
	/** The drag started and another instance under the pointer owns it: hold the current scroll position. */
	yield(): void
	/** This instance owns the drag from now on, and holds its scroll position on the axes it does not drag. */
	start(pointerId: number): void
	/** Pointer moved by `delta` since the press. */
	move(delta: Vector): void
	/** The press ended and this instance did not own a drag: stop holding, settle what the press froze. */
	pass(): void
	/** The drag ended. `velocity` is the pointer velocity in px/ms, or null when the drag was cancelled. */
	end(velocity: Vector | null): void
	/** The user scrolls on purpose (wheel, keyboard), or non-draggable input arrived: stop gliding and holding. */
	interrupt(): void
}

interface Session {
	pointerId: number
	start: Vector
	chain: DragClient[]
	owner: DragClient | null
	samples: Sample[]
}

interface Coordinator {
	add(client: DragClient): () => void
}

const coordinators = new WeakMap<Window, Coordinator>()

/** Registers `client` with the coordinator of its window. Returns the function that unregisters it. */
export function register(client: DragClient): () => void {
	const win = client.el.ownerDocument.defaultView ?? window
	let coordinator = coordinators.get(win)
	if (!coordinator) {
		coordinator = createCoordinator(win)
		coordinators.set(win, coordinator)
	}
	return coordinator.add(client)
}

/**
 * Picks the owner for a drag that moved by `delta`. `chain` runs from the innermost instance outwards.
 * First choice: the innermost instance that drags along the dominant axis and can still scroll that way.
 * Otherwise the innermost one that drags along that axis at all (it is at its edge, but still owns the
 * gesture so the click is not fired). Otherwise nobody, and the browser handles the movement natively.
 */
export function pickOwner(chain: readonly DragClient[], delta: Vector): DragClient | null {
	const axis = dominantAxis(delta)
	const candidates = chain.filter((client) => client.accepts(axis))
	return candidates.find((client) => client.canScroll(delta)) ?? candidates[0] ?? null
}

// True when the press starts in content that keeps its own mouse behaviour (form fields, opt-outs).
const blockedByContent = (path: EventTarget[], outer: HTMLElement) => {
	for (const node of path) {
		if (node === outer) return false
		if ((node as Node).nodeType === 1 && (node as Element).matches(NO_DRAG)) return true
	}
	return false
}

function createCoordinator(win: Window): Coordinator {
	const clients = new Map<EventTarget, DragClient>()
	let session: Session | null = null
	let suppressClick = false
	let suppressTimer = 0
	const capture = { capture: true }
	const passiveCapture = { capture: true, passive: true }

	// An instance destroyed by a listener while the coordinator works on it is no longer registered.
	const alive = (client: DragClient) => clients.get(client.el) === client

	const detach = () => {
		win.removeEventListener("pointermove", onPointerMove)
		win.removeEventListener("pointerup", onPointerUp)
		win.removeEventListener("pointercancel", onPointerCancel)
		win.removeEventListener("wheel", onUserScroll, passiveCapture)
		win.removeEventListener("keydown", onUserScroll, capture)
		win.removeEventListener("contextmenu", cancel, capture)
		win.removeEventListener("blur", cancel)
		win.document.removeEventListener("visibilitychange", onVisibilityChange)
		session = null
	}

	// Ends the session: the owner ends its drag, every other instance lets go of the press.
	const close = (ended: Session, velocity: Vector | null) => {
		detach()
		if (ended.owner && alive(ended.owner)) ended.owner.end(velocity)
		for (const client of ended.chain) if (client !== ended.owner && alive(client)) client.pass()
	}

	// The press ended without a pointerup the window saw: a context menu, the window losing focus or the
	// tab being hidden, or a release over an iframe (the next move then has no button down).
	const cancel = () => {
		if (session) close(session, null)
	}

	const onVisibilityChange = () => {
		if (win.document.visibilityState === "hidden") cancel()
	}

	// Wheel or keyboard scrolling anywhere, also outside the instances under the pointer, lets go of the holds.
	const onUserScroll = (event: Event) => {
		if (event.type === "keydown" && !isScrollKey(event as KeyboardEvent)) return
		if (session) for (const client of session.chain) client.interrupt()
	}

	const onPointerDown = (event: PointerEvent) => {
		// The click that follows a drag fires right after its pointerup, so it can no longer come now. Safari
		// fires none when the press and the release hit different elements; it must not eat this press's click.
		suppressClick = false
		win.clearTimeout(suppressTimer)
		if (session) return
		const path = event.composedPath()
		const chain: DragClient[] = []
		for (const node of path) {
			const client = clients.get(node)
			if (client) chain.push(client)
		}
		if (chain.length === 0) return
		const draggable =
			event.pointerType === "mouse" &&
			event.button === 0 &&
			!blockedByContent(path, chain.at(-1)!.el) &&
			!chain.some((client) => client.onScrollbar(event))
		if (!draggable) {
			for (const client of chain) client.interrupt()
			return
		}
		for (const client of chain) client.press()
		const pressed = chain.filter(alive)
		if (pressed.length === 0) return
		session = {
			pointerId: event.pointerId,
			start: { x: event.clientX, y: event.clientY },
			chain: pressed,
			owner: null,
			samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
		}
		win.addEventListener("pointermove", onPointerMove)
		win.addEventListener("pointerup", onPointerUp)
		win.addEventListener("pointercancel", onPointerCancel)
		win.addEventListener("wheel", onUserScroll, passiveCapture)
		win.addEventListener("keydown", onUserScroll, capture)
		win.addEventListener("contextmenu", cancel, capture)
		win.addEventListener("blur", cancel)
		win.document.addEventListener("visibilitychange", onVisibilityChange)
	}

	const onPointerMove = (event: PointerEvent) => {
		const current = session
		if (!current || event.pointerId !== current.pointerId) return
		if (!(event.buttons & 1)) {
			cancel()
			return
		}
		const { samples } = current
		samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
		while (samples.length > 2 && event.timeStamp - samples[0]!.t > VELOCITY_WINDOW * 2) samples.shift()
		const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y }
		if (!current.owner) {
			if (Math.hypot(delta.x, delta.y) <= DRAG_THRESHOLD) return
			const owner = pickOwner(current.chain, delta)
			if (!owner) {
				// Nobody drags this way: the browser handles the movement natively.
				close(current, null)
				return
			}
			current.owner = owner
			for (const client of current.chain) if (client !== owner) client.yield()
			owner.start(current.pointerId)
		}
		// A listener may have destroyed the owner (which ends the session) since the last move.
		if (session !== current || !current.owner) return
		current.owner.move(delta)
	}

	const onPointerUp = (event: PointerEvent) => {
		const current = session
		if (!current || event.pointerId !== current.pointerId) return
		current.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
		if (current.owner) {
			suppressClick = true
			win.clearTimeout(suppressTimer)
			suppressTimer = win.setTimeout(() => (suppressClick = false), CLICK_SUPPRESS_MS)
		}
		close(current, current.owner ? velocityFromSamples(current.samples) : null)
	}

	const onPointerCancel = (event: PointerEvent) => {
		if (session && event.pointerId === session.pointerId) cancel()
	}

	// A drag that ends over a link or button must not activate it: swallow the one click that follows.
	const onClick = (event: MouseEvent) => {
		if (!suppressClick) return
		suppressClick = false
		win.clearTimeout(suppressTimer)
		event.preventDefault()
		event.stopPropagation()
	}

	// Native drag and drop of images and links would steal the pointer before the threshold is reached.
	const onDragStart = (event: DragEvent) => {
		if (session) event.preventDefault()
	}

	return {
		add(client) {
			if (clients.size === 0) {
				win.addEventListener("pointerdown", onPointerDown, capture)
				win.addEventListener("click", onClick, capture)
				win.addEventListener("dragstart", onDragStart, capture)
			}
			clients.set(client.el, client)
			return () => {
				if (clients.get(client.el) !== client) return
				clients.delete(client.el)
				if (session) {
					const current = session
					current.chain = current.chain.filter((other) => other !== client)
					if (current.owner === client || current.chain.length === 0) {
						// The destroyed instance has cleaned up after itself; the others let go of the press.
						current.owner = null
						close(current, null)
					}
				}
				if (clients.size === 0) {
					win.removeEventListener("pointerdown", onPointerDown, capture)
					win.removeEventListener("click", onClick, capture)
					win.removeEventListener("dragstart", onDragStart, capture)
					win.clearTimeout(suppressTimer)
					suppressClick = false
					coordinators.delete(win)
				}
			}
		},
	}
}
