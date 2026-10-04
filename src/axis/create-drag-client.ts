import type { DragClient } from "../coordinator"
import {
	isOnScrollbar,
	supportedUserSelect,
	toLogical,
	tryCapturePointer,
	tryReleasePointer,
	type Vector,
} from "../utils"
import { AXES, DRAGGING_ATTR, EDGE, ZERO } from "./constants"
import { dragsAlong } from "./drags-along"
import type { AxisCore, Hold, ScrollDriver, SnapSuspension, StyleOverrides } from "./types"

export function createDragClient(
	core: AxisCore,
	snap: SnapSuspension,
	hold: Hold,
	driver: ScrollDriver,
	styles: StyleOverrides,
) {
	const { el, win, rtl, scrollRange, position, options, motion, setMotion, isDestroyed } = core
	const { stop, fling } = driver
	const userSelect = supportedUserSelect(el.style)
	let pointerId = -1
	let pressScroll: Vector = { x: 0, y: 0 }
	const allows = (axis: "x" | "y") => dragsAlong(options().axis, axis)

	const endDrag = () => {
		tryReleasePointer(el, pointerId)
		pointerId = -1
		el.removeAttribute(DRAGGING_ATTR)
		styles.restore(userSelect)
	}

	const freezeMomentum = () => {
		stop()
		setMotion("pressed")
	}

	const client: DragClient = {
		el,
		onScrollbar: (event) => isOnScrollbar(el, event),
		accepts(axis) {
			if (!allows(axis)) return false

			const max = scrollRange()

			return options().axis === "both" ? max.x > 0 || max.y > 0 : max[axis] > 0
		},
		canScroll(delta) {
			const isRtlNow = rtl()
			const max = scrollRange()
			const current = position(isRtlNow, max)
			const againstPointer = { x: toLogical(-delta.x, isRtlNow), y: -delta.y }

			return AXES.some(
				(axis) =>
					allows(axis) &&
					((againstPointer[axis] > 0 && current[axis] < max[axis] - EDGE) ||
						(againstPointer[axis] < 0 && current[axis] > EDGE)),
			)
		},
		press() {
			if (motion() === "momentum") freezeMomentum()
			else if (motion() === "idle") setMotion("pressed")
		},
		yield() {
			hold.yieldDrag(motion() === "glide" || motion() === "wheel")
		},
		start(id) {
			stop()
			pressScroll = { x: el.scrollLeft, y: el.scrollTop }
			hold.holdCurrent()
			pointerId = id
			snap.suspend()
			tryCapturePointer(el, id)
			el.setAttribute(DRAGGING_ATTR, "")
			styles.override(userSelect, "none")
			win.getSelection()?.removeAllRanges()
			setMotion("dragging")
		},
		move(delta) {
			if (isDestroyed()) return

			if (allows("x")) {
				el.scrollLeft = pressScroll.x - delta.x
				hold.follow("x")
			}

			if (allows("y")) {
				el.scrollTop = pressScroll.y - delta.y
				hold.follow("y")
			}
		},
		pass() {
			hold.undoAutoscroll()
			hold.reset()
			const pressFroze = motion() === "pressed"

			if (!pressFroze) return

			if (snap.isSuspended()) fling(ZERO)
			else setMotion("idle")
		},
		end(pointerVelocity) {
			endDrag()
			hold.undoAutoscroll()
			fling(pointerVelocity ? { x: toLogical(-pointerVelocity.x, rtl()), y: -pointerVelocity.y } : ZERO)
		},
		interrupt: driver.interrupt,
	}

	const endDragIfActive = () => {
		if (pointerId !== -1) endDrag()
	}

	return { client, endDragIfActive }
}
