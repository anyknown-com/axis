import { describe, expect, it } from "vitest"
import { adjacentSnap } from "./adjacent-snap"

describe("nearestSnap / adjacentSnap", () => {
	const positions = [0, 200, 400, 600]

	it("finds the next and previous positions beyond 1px", () => {
		expect(adjacentSnap(positions, 200, 1)).toBe(400)
		expect(adjacentSnap(positions, 200.5, 1)).toBe(400)
		expect(adjacentSnap(positions, 200, -1)).toBe(0)
		expect(adjacentSnap(positions, 250, -1)).toBe(200)
		expect(adjacentSnap(positions, 600, 1)).toBeUndefined()
		expect(adjacentSnap(positions, 0, -1)).toBeUndefined()
	})
})
