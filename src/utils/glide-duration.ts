import { clamp } from "./clamp"
import { EASE_OUT_CUBIC_START_SPEED } from "./constants"

export function glideDuration(distance: number, velocity = 0): number {
	const d = Math.abs(distance)
	const continuesRelease = velocity !== 0 && Math.sign(velocity) === Math.sign(distance)

	if (continuesRelease) return clamp((EASE_OUT_CUBIC_START_SPEED * d) / Math.abs(velocity), 180, 900)

	return clamp(200 + d * 0.5, 200, 600)
}
