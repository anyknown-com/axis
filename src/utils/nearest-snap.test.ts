import { describe, expect, it } from "vitest"
import { nearestSnap } from "./nearest-snap"

describe("nearestSnap / adjacentSnap", () => {
	const positions = [0, 200, 400, 600]

	it("picks the nearest position to the predicted landing", () => {
		expect(nearestSnap(positions, 90)).toBe(0)
		expect(nearestSnap(positions, 130)).toBe(200)
		expect(nearestSnap(positions, 9999)).toBe(600)
		expect(nearestSnap([], 42)).toBe(42)
	})
})
