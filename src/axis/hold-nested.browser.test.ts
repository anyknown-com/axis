import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { drag } from "../../test/drag"
import { kanban } from "../../test/kanban"
import { moveTo } from "../../test/move-to"
import { nextFrame } from "../../test/next-frame"
import { press } from "../../test/press"
import { release } from "../../test/release"
import { rowWithColumn } from "../../test/row-with-column"
import { settled } from "../../test/settled"
import { type DragClient, register } from "../coordinator"

const spyClient = (el: HTMLElement) => ({
	el,
	onScrollbar: () => false,
	accepts: () => true,
	canScroll: () => true,
	press: vi.fn<DragClient["press"]>(),
	yield: vi.fn<DragClient["yield"]>(),
	start: vi.fn<DragClient["start"]>(),
	move: vi.fn<DragClient["move"]>(),
	pass: vi.fn<DragClient["pass"]>(),
	end: vi.fn<DragClient["end"]>(),
	interrupt: vi.fn<DragClient["interrupt"]>(),
})

afterEach(cleanup)

describe("holding scroll positions", () => {
	it("undoes a last autoscroll on the instances that did not own the drag", () => {
		const { board, column } = kanban()

		press(column.el)
		moveTo(100, 200)
		expect(board.z.getState().isDragging).toBe(true)
		const safariAutoscrollOfTheHeldColumnBeforeItsScrollEvent = 50

		column.el.scrollTop = safariAutoscrollOfTheHeldColumnBeforeItsScrollEvent
		release()
		expect(column.el.scrollTop).toBe(0)
	})

	it("freezes the momentum of an outer instance and holds it while an inner one owns the drag", async () => {
		const { row, column, pressablePointOnColumn } = rowWithColumn()
		const onTheColumn = { x: 250, y: 50 }
		const horizontalSoTheRowTakesIt = -100

		await drag(onTheColumn, horizontalSoTheRowTakesIt, { steps: 5 })
		await vi.waitFor(() => expect(row.z.getState().isMomentum).toBe(true))
		const at = pressablePointOnColumn()

		press(column.el, at)
		expect(row.z.getState().isMomentum).toBe(false)
		moveTo(at.x, at.y - 40)
		expect(column.z.getState().isDragging).toBe(true)
		const held = row.el.scrollLeft

		row.el.scrollLeft = held + 40
		await nextFrame()
		await nextFrame()
		expect(row.el.scrollLeft).toBe(held)
		release()
		await settled(row.z, row.el)
		expect(row.el.scrollLeft).toBe(held)
	})

	it("lets an outer instance's scrollTo glide run through a drag it does not own", async () => {
		const { row, column, pressablePointOnColumn } = rowWithColumn()

		row.z.scrollTo({ x: 600 })
		const at = pressablePointOnColumn()

		press(column.el, at)
		moveTo(at.x, at.y - 40)
		expect(column.z.getState().isDragging).toBe(true)
		release()
		await vi.waitFor(() => expect(row.el.scrollLeft).toBe(600))
	})

	it("reports an outer instance's glide while an inner one owns the drag", async () => {
		const { row, column, pressablePointOnColumn } = rowWithColumn()
		const reported: number[] = []

		row.z.subscribe((state) => reported.push(state.x.scroll))
		row.z.scrollTo({ x: 400 })
		await nextFrame()
		const at = pressablePointOnColumn()

		press(column.el, at)
		moveTo(at.x, at.y - 40)
		expect(column.z.getState().isDragging).toBe(true)
		const unheldGlideEnd = 400

		await vi.waitFor(() => expect(row.z.getState().x.scroll).toBe(unheldGlideEnd))
		expect(row.el.scrollLeft).toBe(400)
		expect(new Set(reported).size).toBeGreaterThan(3)
		release()
	})

	it("holds an outer instance where its glide ended, until the drag ends", async () => {
		const { row, column, pressablePointOnColumn } = rowWithColumn()

		row.z.scrollTo({ x: 400 })
		await nextFrame()
		const at = pressablePointOnColumn()

		press(column.el, at)
		moveTo(at.x, at.y - 40)
		await vi.waitFor(() => expect(row.z.getState().x.scroll).toBe(400))
		await settled(row.z, row.el)
		const safariAutoscrollOfTheRowWhileTheColumnIsStillDragged = 700

		row.el.scrollLeft = safariAutoscrollOfTheRowWhileTheColumnIsStillDragged
		await nextFrame()
		await nextFrame()
		expect(row.el.scrollLeft).toBe(400)
		release()
		await nextFrame()
		expect(row.el.scrollLeft).toBe(400)
	})

	it("skips an instance a listener destroyed while the drag ended", () => {
		const outer = document.createElement("div")
		const inner = document.createElement("div")

		outer.append(inner)
		document.body.append(outer)
		const owner = spyClient(inner)
		const other = spyClient(outer)
		const unregisterOther = register(other)
		const unregisterOwner = register(owner)

		cleanups.push(() => {
			unregisterOwner()
			unregisterOther()
			outer.remove()
		})
		const ownerListenerDestroyingTheOuterInstance = () => unregisterOther()

		owner.end.mockImplementation(ownerListenerDestroyingTheOuterInstance)
		press(inner)
		moveTo(100, 200)
		expect(owner.start).toHaveBeenCalled()
		release()
		expect(owner.end).toHaveBeenCalled()
		expect(other.pass).not.toHaveBeenCalled()
	})

	it.each([
		["wheel", () => document.body.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))],
		[
			"ArrowRight",
			() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
		],
	])("lets go of every hold on %s outside the instances", async (_, input) => {
		const { board, column } = kanban()

		press(column.el)
		moveTo(100, 200)
		expect(board.z.getState().isDragging).toBe(true)
		input()
		column.el.scrollTop = 30
		await nextFrame()
		expect(column.el.scrollTop).toBe(30)
		release()
	})
})
