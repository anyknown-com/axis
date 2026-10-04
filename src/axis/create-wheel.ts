import { adjacentSnap, clamp, nearestSnap, wheelDeltaYPx } from "../utils"
import { EDGE, ZERO } from "./constants"
import type { AxisCore, ScrollDriver, SnapSuspension } from "./types"

export function createWheel(core: AxisCore, snap: SnapSuspension, driver: ScrollDriver) {
	const { el, rtl, scrollRange, position, writePosition, options, motion, setMotion, isDestroyed } = core
	let direction: 1 | -1 = 1
	let attached = false

	const settleOnNextSnapInWheelDirection = () => {
		if (isDestroyed()) return

		if (!snap.snapAxes().x) {
			driver.settle()

			return
		}

		const current = position().x
		const positions = core.snapPoints().x

		const target =
			adjacentSnap(positions, current - 2 * direction, direction) ?? nearestSnap(positions, current)

		driver.glideTo({ x: target }, ZERO, "glide")
	}

	const onWheel = (event: WheelEvent) => {
		if (options().axis !== "x" || event.ctrlKey || event.shiftKey) return
		if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
		if (motion() === "pressed" || motion() === "dragging") return

		const delta = wheelDeltaYPx(event, el.clientWidth)
		const isRtlNow = rtl()
		const max = scrollRange()
		const current = position(isRtlNow, max).x
		const leavesPageScrollingAtEdge = delta > 0 ? current >= max.x - EDGE : current <= EDGE

		if (leavesPageScrollingAtEdge) return

		event.preventDefault()
		driver.stop()
		snap.suspend()
		direction = delta > 0 ? 1 : -1
		writePosition({ x: clamp(current + delta, 0, max.x) }, isRtlNow)

		if (motion() !== "wheel") setMotion("wheel")
		if (isDestroyed()) return

		driver.afterWheelPause(settleOnNextSnapInWheelDirection)
	}

	const sync = () => {
		const { wheel, axis } = options()
		const wanted = wheel && axis === "x"

		if (wanted === attached) return

		attached = wanted

		if (wanted) el.addEventListener("wheel", onWheel, { passive: false })
		else el.removeEventListener("wheel", onWheel)
	}

	const remove = () => el.removeEventListener("wheel", onWheel)

	return { sync, remove }
}
