import { describe, expect, it } from "vitest"
import { dominantAxis } from "./dominant-axis"

describe("dominantAxis", () => {
	it("picks the larger component, x on ties", () => {
		expect(dominantAxis({ x: 10, y: 3 })).toBe("x")
		expect(dominantAxis({ x: -2, y: -9 })).toBe("y")
		expect(dominantAxis({ x: 4, y: -4 })).toBe("x")
	})
})
