import { describe, expect, it } from "vitest"
import { parseSnapAlign } from "./parse-snap-align"

describe("parseSnapAlign", () => {
	it("reads block then inline, one value meaning both", () => {
		expect(parseSnapAlign("start")).toEqual({ x: "start", y: "start" })
		expect(parseSnapAlign("none center")).toEqual({ x: "center", y: "none" })
		expect(parseSnapAlign("start end")).toEqual({ x: "end", y: "start" })
		expect(parseSnapAlign("none")).toEqual({ x: "none", y: "none" })
		expect(parseSnapAlign("")).toEqual({ x: "none", y: "none" })
	})
})
