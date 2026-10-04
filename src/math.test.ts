import { describe, expect, it } from "vitest"
import { type DragClient, pickOwner } from "./coordinator"
import {
	adjacentSnap,
	DECAY,
	dominantAxis,
	FRAME_MS,
	glideDuration,
	MAX_VELOCITY,
	momentumDistance,
	momentumStep,
	nearestSnap,
	parseSnapAlign,
	parseSnapType,
	type SnapAxis,
	snapPositions,
	velocityFromSamples,
} from "./math"

// A 300px snapport at viewport offset 10, scrolled to 0, with 200px items laid out back to back.
const snapAxis = (patch: Partial<SnapAxis> = {}): SnapAxis => ({
	start: 10,
	size: 300,
	paddingStart: 0,
	paddingEnd: 0,
	scroll: 0,
	maxScroll: 700,
	rtl: false,
	...patch,
})
const items = (align: "start" | "center" | "end", scroll = 0) =>
	Array.from({ length: 5 }, (_, i) => ({ start: 10 + i * 200 - scroll, size: 200, align }))

describe("velocityFromSamples", () => {
	it("is 0 without enough samples", () => {
		expect(velocityFromSamples([])).toEqual({ x: 0, y: 0 })
		expect(velocityFromSamples([{ t: 0, x: 10, y: 10 }])).toEqual({ x: 0, y: 0 })
	})

	it("measures a 2D px/ms vector over the last 100ms only", () => {
		const samples = [
			{ t: 0, x: 0, y: 0 },
			{ t: 100, x: 1000, y: 1000 }, // outside the window relative to the last sample
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

describe("momentum", () => {
	it("decays per reference frame", () => {
		const step = momentumStep(1, FRAME_MS)
		expect(step.distance).toBeCloseTo(FRAME_MS)
		expect(step.velocity).toBeCloseTo(DECAY)
	})

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

describe("dominantAxis", () => {
	it("picks the larger component, x on ties", () => {
		expect(dominantAxis({ x: 10, y: 3 })).toBe("x")
		expect(dominantAxis({ x: -2, y: -9 })).toBe("y")
		expect(dominantAxis({ x: 4, y: -4 })).toBe("x")
	})
})

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

describe("parseSnapAlign", () => {
	it("reads block then inline, one value meaning both", () => {
		expect(parseSnapAlign("start")).toEqual({ x: "start", y: "start" })
		expect(parseSnapAlign("none center")).toEqual({ x: "center", y: "none" })
		expect(parseSnapAlign("start end")).toEqual({ x: "end", y: "start" })
		expect(parseSnapAlign("none")).toEqual({ x: "none", y: "none" })
		expect(parseSnapAlign("")).toEqual({ x: "none", y: "none" })
	})
})

describe("snapPositions", () => {
	it("aligns starts", () => {
		expect(snapPositions(snapAxis(), items("start"))).toEqual([0, 200, 400, 600, 700])
	})

	it("is independent of the current scroll position", () => {
		expect(snapPositions(snapAxis({ scroll: 250 }), items("start", 250))).toEqual([0, 200, 400, 600, 700])
	})

	it("aligns centers and ends, clamping and de-duplicating at the edges", () => {
		expect(snapPositions(snapAxis(), items("center"))).toEqual([0, 150, 350, 550, 700])
		expect(snapPositions(snapAxis(), items("end"))).toEqual([0, 100, 300, 500, 700])
	})

	it("honours scroll-padding at both ends", () => {
		expect(snapPositions(snapAxis({ paddingStart: 20 }), items("start"))).toEqual([0, 180, 380, 580, 700])
		expect(snapPositions(snapAxis({ paddingEnd: 20 }), items("end"))).toEqual([0, 120, 320, 520, 700])
	})

	it("skips items without snap-align", () => {
		const list = [...items("start").slice(0, 2), { start: 410, size: 200, align: "none" as const }]
		expect(snapPositions(snapAxis(), list)).toEqual([0, 200])
	})

	it("uses the right edge as start in RTL", () => {
		// Item i sits i*200px left of the right edge; the snapport spans 10..310, scrollLeft 0 = start.
		const rtlItems = Array.from({ length: 5 }, (_, i) => ({
			start: 310 - (i + 1) * 200,
			size: 200,
			align: "start" as const,
		}))
		expect(snapPositions(snapAxis({ rtl: true }), rtlItems)).toEqual([0, 200, 400, 600, 700])
		// Scrolled by 200 logical (scrollLeft -200): every item moved 200px to the right.
		const scrolled = rtlItems.map((item) => ({ ...item, start: item.start + 200 }))
		expect(snapPositions(snapAxis({ rtl: true, scroll: -200 }), scrolled)).toEqual([0, 200, 400, 600, 700])
	})
})

describe("nearestSnap / adjacentSnap", () => {
	const positions = [0, 200, 400, 600]

	it("picks the nearest position to the predicted landing", () => {
		expect(nearestSnap(positions, 90)).toBe(0)
		expect(nearestSnap(positions, 130)).toBe(200)
		expect(nearestSnap(positions, 9999)).toBe(600)
		expect(nearestSnap([], 42)).toBe(42)
	})

	it("finds the next and previous positions beyond 1px", () => {
		expect(adjacentSnap(positions, 200, 1)).toBe(400)
		expect(adjacentSnap(positions, 200.5, 1)).toBe(400)
		expect(adjacentSnap(positions, 200, -1)).toBe(0)
		expect(adjacentSnap(positions, 250, -1)).toBe(200)
		expect(adjacentSnap(positions, 600, 1)).toBeUndefined()
		expect(adjacentSnap(positions, 0, -1)).toBeUndefined()
	})
})

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

// A fake client: `axes` it drags along, and the pointer directions in which it can still scroll.
const client = (
	name: string,
	axes: "x" | "y" | "both",
	canScroll: (delta: { x: number; y: number }) => boolean,
) =>
	({
		name,
		accepts: (axis: "x" | "y") => axes === "both" || axes === axis,
		canScroll,
	}) as unknown as DragClient & { name: string }
const always = () => true
const never = () => false
const name = (owner: DragClient | null) => (owner as { name?: string } | null)?.name ?? null

describe("pickOwner", () => {
	it("gives the drag to the innermost instance on the dominant axis", () => {
		const column = client("column", "y", always)
		const board = client("board", "x", always)
		expect(name(pickOwner([column, board], { x: 2, y: 30 }))).toBe("column")
		expect(name(pickOwner([column, board], { x: 30, y: 2 }))).toBe("board")
	})

	it("chains outwards when the inner instance is at its edge", () => {
		const inner = client("inner", "x", never)
		const outer = client("outer", "x", always)
		expect(name(pickOwner([inner, outer], { x: -20, y: 0 }))).toBe("outer")
	})

	it("keeps the gesture on the innermost matching instance when nothing can scroll", () => {
		const inner = client("inner", "x", never)
		const outer = client("outer", "x", never)
		expect(name(pickOwner([inner, outer], { x: -20, y: 0 }))).toBe("inner")
	})

	it("lets both-axis instances take either direction", () => {
		const canvas = client("canvas", "both", always)
		const page = client("page", "y", always)
		expect(name(pickOwner([canvas, page], { x: 0, y: 20 }))).toBe("canvas")
		expect(name(pickOwner([canvas, page], { x: 20, y: 0 }))).toBe("canvas")
	})

	it("returns null when no instance drags along the dominant axis", () => {
		expect(pickOwner([client("row", "x", always)], { x: 1, y: 20 })).toBeNull()
	})
})
