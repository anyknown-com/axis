import { describe, expect, it } from "vitest"
import { snapPositions } from "./snap-positions"
import type { SnapAxis } from "./types"

const SNAPPORT_OFFSET = 10
const SNAPPORT_SIZE = 300
const ITEM_SIZE = 200

const snapAxis = (patch: Partial<SnapAxis> = {}): SnapAxis => ({
	start: SNAPPORT_OFFSET,
	size: SNAPPORT_SIZE,
	paddingStart: 0,
	paddingEnd: 0,
	scroll: 0,
	maxScroll: 700,
	rtl: false,
	...patch,
})

const backToBackItems = (align: "start" | "center" | "end", scroll = 0) =>
	Array.from({ length: 5 }, (_, i) => ({
		start: SNAPPORT_OFFSET + i * ITEM_SIZE - scroll,
		size: ITEM_SIZE,
		align,
	}))

describe("snapPositions", () => {
	it("aligns starts", () => {
		expect(snapPositions(snapAxis(), backToBackItems("start"))).toEqual([0, 200, 400, 600, 700])
	})

	it("is independent of the current scroll position", () => {
		expect(snapPositions(snapAxis({ scroll: 250 }), backToBackItems("start", 250))).toEqual([
			0, 200, 400, 600, 700,
		])
	})

	it("aligns centers and ends, clamping and de-duplicating at the edges", () => {
		expect(snapPositions(snapAxis(), backToBackItems("center"))).toEqual([0, 150, 350, 550, 700])
		expect(snapPositions(snapAxis(), backToBackItems("end"))).toEqual([0, 100, 300, 500, 700])
	})

	it("honours scroll-padding at both ends", () => {
		expect(snapPositions(snapAxis({ paddingStart: 20 }), backToBackItems("start"))).toEqual([
			0, 180, 380, 580, 700,
		])
		expect(snapPositions(snapAxis({ paddingEnd: 20 }), backToBackItems("end"))).toEqual([
			0, 120, 320, 520, 700,
		])
	})

	it("skips items without snap-align", () => {
		const list = [...backToBackItems("start").slice(0, 2), { start: 410, size: 200, align: "none" as const }]

		expect(snapPositions(snapAxis(), list)).toEqual([0, 200])
	})

	it("uses the right edge as start in RTL", () => {
		const snapportRightEdgeAtScrollLeftZero = SNAPPORT_OFFSET + SNAPPORT_SIZE

		const rtlItems = Array.from({ length: 5 }, (_, i) => ({
			start: snapportRightEdgeAtScrollLeftZero - (i + 1) * ITEM_SIZE,
			size: ITEM_SIZE,
			align: "start" as const,
		}))

		expect(snapPositions(snapAxis({ rtl: true }), rtlItems)).toEqual([0, 200, 400, 600, 700])

		const scrolledBy200LogicalSoEveryItemMovedRight = rtlItems.map((item) => ({
			...item,
			start: item.start + 200,
		}))

		expect(
			snapPositions(snapAxis({ rtl: true, scroll: -200 }), scrolledBy200LogicalSoEveryItemMovedRight),
		).toEqual([0, 200, 400, 600, 700])
	})
})
