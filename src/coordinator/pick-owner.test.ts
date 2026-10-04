import { describe, expect, it } from "vitest"
import type { DragClient } from "./index"
import { pickOwner } from "./pick-owner"

const fakeClient = (
	name: string,
	dragsAlong: "x" | "y" | "both",
	canScrollTowardsPointerDelta: (delta: { x: number; y: number }) => boolean,
) =>
	({
		name,
		accepts: (axis: "x" | "y") => dragsAlong === "both" || dragsAlong === axis,
		canScroll: canScrollTowardsPointerDelta,
	}) as unknown as DragClient & { name: string }

const always = () => true
const never = () => false
const name = (owner: DragClient | null) => (owner as { name?: string } | null)?.name ?? null

describe("pickOwner", () => {
	it("gives the drag to the innermost instance on the dominant axis", () => {
		const column = fakeClient("column", "y", always)
		const board = fakeClient("board", "x", always)

		expect(name(pickOwner([column, board], { x: 2, y: 30 }))).toBe("column")
		expect(name(pickOwner([column, board], { x: 30, y: 2 }))).toBe("board")
	})

	it("chains outwards when the inner instance is at its edge", () => {
		const inner = fakeClient("inner", "x", never)
		const outer = fakeClient("outer", "x", always)

		expect(name(pickOwner([inner, outer], { x: -20, y: 0 }))).toBe("outer")
	})

	it("keeps the gesture on the innermost matching instance when nothing can scroll", () => {
		const inner = fakeClient("inner", "x", never)
		const outer = fakeClient("outer", "x", never)

		expect(name(pickOwner([inner, outer], { x: -20, y: 0 }))).toBe("inner")
	})

	it("lets both-axis instances take either direction", () => {
		const canvas = fakeClient("canvas", "both", always)
		const page = fakeClient("page", "y", always)

		expect(name(pickOwner([canvas, page], { x: 0, y: 20 }))).toBe("canvas")
		expect(name(pickOwner([canvas, page], { x: 20, y: 0 }))).toBe("canvas")
	})

	it("returns null when no instance drags along the dominant axis", () => {
		expect(pickOwner([fakeClient("row", "x", always)], { x: 1, y: 20 })).toBeNull()
	})
})
