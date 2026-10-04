import { afterEach, describe, expect, it } from "vitest"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { kanban } from "../../test/kanban"
import { nextFrame } from "../../test/next-frame"

afterEach(cleanup)

describe("keys that do not scroll", () => {
	it("keep the holds: modifiers, and Space in a text field", async () => {
		const { board, column } = kanban()
		const field = document.createElement("input")

		document.body.append(field)
		cleanups.push(() => field.remove())
		column.el.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				pointerId: 7,
				pointerType: "mouse",
				clientX: 150,
				clientY: 200,
			}),
		)
		window.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerId: 7,
				pointerType: "mouse",
				buttons: 1,
				clientX: 100,
				clientY: 200,
			}),
		)
		expect(board.z.getState().isDragging).toBe(true)
		document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }))
		field.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
		column.el.scrollTop = 30
		await nextFrame()
		expect(column.el.scrollTop).toBe(0)
		window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "mouse" }))
	})
})
