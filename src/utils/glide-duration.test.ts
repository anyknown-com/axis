import { describe, expect, it } from "vitest"
import { glideDuration } from "./glide-duration"

describe("glideDuration", () => {
	it("matches the release velocity when it points towards the target", () => {
		expect(glideDuration(300, 2)).toBe(450)
		expect(glideDuration(-300, -2)).toBe(450)
	})

	it("falls back to a distance-based duration", () => {
		expect(glideDuration(300, -2)).toBe(350)
		expect(glideDuration(10)).toBe(205)
		expect(glideDuration(5000)).toBe(600)
	})
})
