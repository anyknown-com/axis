import {
	composedPathMatches,
	isScrollKey,
	pointerSample,
	type Vector,
	VELOCITY_WINDOW,
	velocityFromSamples,
} from "../utils"
import { CLICK_SUPPRESS_MS, coordinators, DRAG_THRESHOLD, NO_DRAG } from "./constants"
import { pickOwner } from "./pick-owner"
import type { Coordinator, DragClient, Session } from "./types"

export function createCoordinator(win: Window): Coordinator {
	const clients = new Map<EventTarget, DragClient>()
	let session: Session | null = null
	let suppressClick = false
	let suppressTimer = 0
	const capture = { capture: true }
	const passiveCapture = { capture: true, passive: true }

	const stillRegistered = (client: DragClient) => clients.get(client.el) === client

	const forgetSuppressedClick = () => {
		suppressClick = false
		win.clearTimeout(suppressTimer)
	}

	const detach = () => {
		win.removeEventListener("pointermove", onPointerMove)
		win.removeEventListener("pointerup", onPointerUp)
		win.removeEventListener("pointercancel", onPointerCancel)
		win.removeEventListener("wheel", releaseHoldsOnUserScroll, passiveCapture)
		win.removeEventListener("keydown", releaseHoldsOnUserScroll, capture)
		win.removeEventListener("contextmenu", cancelPress, capture)
		win.removeEventListener("blur", cancelPress)
		win.document.removeEventListener("visibilitychange", cancelPressWhenHidden)
		session = null
	}

	const endSession = (ended: Session, pointerVelocity: Vector | null) => {
		detach()

		if (ended.owner && stillRegistered(ended.owner)) ended.owner.end(pointerVelocity)

		for (const client of ended.chain) {
			if (client !== ended.owner && stillRegistered(client)) client.pass()
		}
	}

	const cancelPress = () => {
		if (session) endSession(session, null)
	}

	const cancelPressWhenHidden = () => {
		if (win.document.visibilityState === "hidden") cancelPress()
	}

	const releaseHoldsOnUserScroll = (event: Event) => {
		if (event.type === "keydown" && !isScrollKey(event as KeyboardEvent)) return
		if (session) for (const client of session.chain) client.interrupt()
	}

	const attach = () => {
		win.addEventListener("pointermove", onPointerMove)
		win.addEventListener("pointerup", onPointerUp)
		win.addEventListener("pointercancel", onPointerCancel)
		win.addEventListener("wheel", releaseHoldsOnUserScroll, passiveCapture)
		win.addEventListener("keydown", releaseHoldsOnUserScroll, capture)
		win.addEventListener("contextmenu", cancelPress, capture)
		win.addEventListener("blur", cancelPress)
		win.document.addEventListener("visibilitychange", cancelPressWhenHidden)
	}

	const onPointerDown = (event: PointerEvent) => {
		forgetSuppressedClick()

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
			!composedPathMatches(path, NO_DRAG, chain.at(-1)!.el) &&
			!chain.some((client) => client.onScrollbar(event))

		if (!draggable) {
			for (const client of chain) client.interrupt()

			return
		}

		for (const client of chain) client.press()
		const pressed = chain.filter(stillRegistered)

		if (pressed.length === 0) return

		session = {
			pointerId: event.pointerId,
			start: { x: event.clientX, y: event.clientY },
			chain: pressed,
			owner: null,
			samples: [pointerSample(event)],
		}

		attach()
	}

	const handOver = (current: Session, delta: Vector) => {
		const owner = pickOwner(current.chain, delta)

		if (!owner) {
			endSession(current, null)

			return
		}

		current.owner = owner
		for (const client of current.chain) if (client !== owner) client.yield()
		owner.start(current.pointerId)
	}

	const onPointerMove = (event: PointerEvent) => {
		const current = session

		if (!current || event.pointerId !== current.pointerId) return

		const releasedOutsideWindow = !(event.buttons & 1)

		if (releasedOutsideWindow) {
			cancelPress()

			return
		}

		const { samples } = current

		samples.push(pointerSample(event))
		while (samples.length > 2 && event.timeStamp - samples[0]!.t > VELOCITY_WINDOW * 2) samples.shift()
		const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y }

		if (!current.owner) {
			if (Math.hypot(delta.x, delta.y) <= DRAG_THRESHOLD) return

			handOver(current, delta)
		}

		const endedByListener = session !== current

		if (endedByListener || !current.owner) return

		current.owner.move(delta)
	}

	const onPointerUp = (event: PointerEvent) => {
		const current = session

		if (!current || event.pointerId !== current.pointerId) return

		current.samples.push(pointerSample(event))

		if (current.owner) {
			suppressClick = true
			win.clearTimeout(suppressTimer)
			suppressTimer = win.setTimeout(() => (suppressClick = false), CLICK_SUPPRESS_MS)
		}

		endSession(current, current.owner ? velocityFromSamples(current.samples) : null)
	}

	const onPointerCancel = (event: PointerEvent) => {
		if (session && event.pointerId === session.pointerId) cancelPress()
	}

	const swallowClickAfterDrag = (event: MouseEvent) => {
		if (!suppressClick) return

		forgetSuppressedClick()
		event.preventDefault()
		event.stopPropagation()
	}

	const preventNativeDragAndDrop = (event: DragEvent) => {
		if (session) event.preventDefault()
	}

	const remove = (client: DragClient) => {
		if (clients.get(client.el) !== client) return

		clients.delete(client.el)

		if (session) {
			const current = session

			current.chain = current.chain.filter((other) => other !== client)

			if (current.owner === client || current.chain.length === 0) {
				current.owner = null
				endSession(current, null)
			}
		}

		if (clients.size === 0) {
			win.removeEventListener("pointerdown", onPointerDown, capture)
			win.removeEventListener("click", swallowClickAfterDrag, capture)
			win.removeEventListener("dragstart", preventNativeDragAndDrop, capture)
			forgetSuppressedClick()
			coordinators.delete(win)
		}
	}

	return {
		add(client) {
			if (clients.size === 0) {
				win.addEventListener("pointerdown", onPointerDown, capture)
				win.addEventListener("click", swallowClickAfterDrag, capture)
				win.addEventListener("dragstart", preventNativeDragAndDrop, capture)
			}

			clients.set(client.el, client)

			return () => remove(client)
		},
	}
}
