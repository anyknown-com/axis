import { describe, expect, it } from "vitest"
import { parseSnapType } from "./parse-snap-type"

describe("parseSnapType", () => {
	it("maps every axis keyword", () => {
		expect(parseSnapType("none")).toEqual({ x: false, y: false })
		expect(parseSnapType("x mandatory")).toEqual({ x: true, y: false })
		expect(parseSnapType("y proximity")).toEqual({ x: false, y: true })
		expect(parseSnapType("both mandatory")).toEqual({ x: true, y: true })
		expect(parseSnapType("inline")).toEqual({ x: true, y: false })
		expect(parseSnapType("block mandatory")).toEqual({ x: false, y: true })
	})
})
