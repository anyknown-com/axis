import { describe, expect, it } from "vitest"
import { FRAME_MS } from "./constants"
import { momentumDistance } from "./momentum-distance"
import { momentumStep } from "./momentum-step"

describe("momentum", () => {
	it("predicts the same total distance the step loop travels", () => {
		let velocity = 2
		let travelled = 0

		while (Math.abs(velocity) > 1e-6) {
			const step = momentumStep(velocity, FRAME_MS)

			travelled += step.distance
			velocity = step.velocity
		}

		expect(momentumDistance(2)).toBeCloseTo(travelled, 3)
		expect(momentumDistance(-2)).toBeCloseTo(-travelled, 3)
	})
})
