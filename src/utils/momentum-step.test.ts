import { describe, expect, it } from "vitest"
import { DECAY, FRAME_MS } from "./constants"
import { momentumStep } from "./momentum-step"

describe("momentum", () => {
	it("decays per reference frame", () => {
		const step = momentumStep(1, FRAME_MS)

		expect(step.distance).toBeCloseTo(FRAME_MS)
		expect(step.velocity).toBeCloseTo(DECAY)
	})
})
