import {
	clamp,
	easeOutCubic,
	glideDuration,
	MIN_VELOCITY,
	momentumDistance,
	momentumStep,
	nearestSnap,
	prefersReducedMotion,
	type Vector,
} from "../utils"
import { AXES, MAX_FRAME_MS, WHEEL_SETTLE_MS } from "./constants"
import { dragsAlong } from "./drags-along"
import type { AxisCore, AxisPosition, Glide, Hold, ScrollDriver, SnapSuspension } from "./types"

export function createScrollDriver(core: AxisCore, snap: SnapSuspension, hold: Hold): ScrollDriver {
	const { win, rtl, scrollRange, position, writePosition, options, motion, setMotion, isDestroyed } = core
	const { suspend, resume, snapAxes } = snap
	let frame = 0
	let wheelTimer = 0
	let glideTarget: Vector = { x: 0, y: 0 }

	const stop = () => {
		hold.release()

		if (frame) win.cancelAnimationFrame(frame)

		frame = 0
		win.clearTimeout(wheelTimer)
		wheelTimer = 0
	}

	const settle = () => {
		stop()
		hold.holdIfYielded()
		resume()
		setMotion("idle")
	}

	const jump = (target: AxisPosition) => {
		stop()
		suspend()
		writePosition(target)
		settle()
	}

	const glideTo = (target: AxisPosition, velocity: Vector, kind: Glide) => {
		stop()
		const isRtlNow = rtl()
		const from = position(isRtlNow)

		const moving = AXES.filter(
			(axis) => target[axis] !== undefined && Math.abs(target[axis] - from[axis]) >= 0.5,
		)

		if (moving.length === 0 || prefersReducedMotion(win)) {
			jump(target)

			return
		}

		suspend()
		glideTarget = { x: target.x ?? from.x, y: target.y ?? from.y }
		const distance = { x: glideTarget.x - from.x, y: glideTarget.y - from.y }
		const duration = Math.max(...moving.map((axis) => glideDuration(distance[axis], velocity[axis])))
		const start = win.performance.now()

		setMotion(kind)

		if (isDestroyed()) return

		const tick = (now: number) => {
			if (isDestroyed()) return

			const eased = easeOutCubic(clamp((now - start) / duration, 0, 1))
			const next: AxisPosition = {}

			for (const axis of moving) next[axis] = from[axis] + distance[axis] * eased
			writePosition(next, isRtlNow)

			if (eased < 1) frame = win.requestAnimationFrame(tick)
			else settle()
		}

		frame = win.requestAnimationFrame(tick)
	}

	const runMomentum = (velocity: Vector) => {
		stop()
		suspend()
		setMotion("momentum")

		if (isDestroyed()) return

		const isRtlNow = rtl()
		const max = scrollRange()
		const current = position(isRtlNow, max)
		const speed = { ...velocity }
		let last = win.performance.now()

		const tick = (now: number) => {
			if (isDestroyed()) return

			const dt = clamp(now - last, 0, MAX_FRAME_MS)

			last = now
			const next: AxisPosition = {}

			for (const axis of AXES) {
				if (speed[axis] === 0) continue

				const advance = momentumStep(speed[axis], dt)

				current[axis] = clamp(current[axis] + advance.distance, 0, max[axis])
				speed[axis] = current[axis] <= 0 || current[axis] >= max[axis] ? 0 : advance.velocity
				next[axis] = current[axis]
			}

			writePosition(next, isRtlNow)

			if (Math.hypot(speed.x, speed.y) < MIN_VELOCITY) settle()
			else frame = win.requestAnimationFrame(tick)
		}

		frame = win.requestAnimationFrame(tick)
	}

	const nearestSnapToLanding = (speed: Vector, snaps: { x: boolean; y: boolean }) => {
		const max = scrollRange()
		const from = position(rtl(), max)
		const positions = core.snapPoints()
		const target: AxisPosition = {}

		for (const axis of AXES) {
			const landing = clamp(from[axis] + momentumDistance(speed[axis]), 0, max[axis])

			target[axis] = snaps[axis] ? nearestSnap(positions[axis], landing) : landing
		}

		return target
	}

	return {
		stop,
		settle,
		jump,
		glideTo,
		interrupt() {
			hold.reset()

			if (motion() === "momentum" || motion() === "glide") settle()
		},
		fling(scrollVelocity) {
			const { momentum, axis } = options()
			const allowed = momentum && !prefersReducedMotion(win)

			const speed = {
				x: allowed && dragsAlong(axis, "x") ? scrollVelocity.x : 0,
				y: allowed && dragsAlong(axis, "y") ? scrollVelocity.y : 0,
			}

			const snaps = snapAxes()

			if (snaps.x || snaps.y) glideTo(nearestSnapToLanding(speed, snaps), speed, "momentum")
			else if (Math.hypot(speed.x, speed.y) > MIN_VELOCITY) runMomentum(speed)
			else settle()
		},
		afterWheelPause(settleWheel) {
			wheelTimer = win.setTimeout(() => {
				wheelTimer = 0
				settleWheel()
			}, WHEEL_SETTLE_MS)
		},
		glideTarget: () => glideTarget,
	}
}
