import { describe, expect, it } from "vitest"
import { MAX_VELOCITY } from "./constants"
import { velocityFromSamples } from "./velocity-from-samples"

describe("velocityFromSamples", () => {
	it("is 0 without enough samples", () => {
		expect(velocityFromSamples([])).toEqual({ x: 0, y: 0 })
		expect(velocityFromSamples([{ t: 0, x: 10, y: 10 }])).toEqual({ x: 0, y: 0 })
	})

	it("measures a 2D px/ms vector over the last 100ms only", () => {
		const outsideTheWindowBeforeTheLastSample = { t: 100, x: 1000, y: 1000 }

		const samples = [
			{ t: 0, x: 0, y: 0 },
			outsideTheWindowBeforeTheLastSample,
			{ t: 150, x: 1010, y: 1000 },
			{ t: 250, x: 1110, y: 950 },
		]

		const velocity = velocityFromSamples(samples)

		expect(velocity.x).toBeCloseTo(1)
		expect(velocity.y).toBeCloseTo(-0.5)
	})

	it("caps each axis", () => {
		const velocity = velocityFromSamples([
			{ t: 0, x: 0, y: 0 },
			{ t: 1, x: 1000, y: -1000 },
		])

		expect(velocity).toEqual({ x: MAX_VELOCITY, y: -MAX_VELOCITY })
	})
})
