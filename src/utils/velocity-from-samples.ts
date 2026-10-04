import { clamp } from "./clamp"
import { MAX_VELOCITY, VELOCITY_WINDOW } from "./constants"
import type { Sample, Vector } from "./types"

export function velocityFromSamples(samples: readonly Sample[], window = VELOCITY_WINDOW): Vector {
	const last = samples.at(-1)

	if (!last) return { x: 0, y: 0 }

	let first = last

	for (let i = samples.length - 2; i >= 0; i--) {
		const sample = samples[i]!

		if (last.t - sample.t > window) break

		first = sample
	}

	const dt = last.t - first.t

	if (dt <= 0) return { x: 0, y: 0 }

	return {
		x: clamp((last.x - first.x) / dt, -MAX_VELOCITY, MAX_VELOCITY),
		y: clamp((last.y - first.y) / dt, -MAX_VELOCITY, MAX_VELOCITY),
	}
}
