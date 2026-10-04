import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { drag } from "../../test/drag"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import { pointer } from "../../test/pointer"

afterEach(cleanup)

describe("drag on x", () => {
	it("scrolls by the dragged distance and flags the drag while it lasts", async () => {
		const { el, z } = mount({ options: { momentum: false } })
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 120, start.y, 10)
		expect(z.getState().isDragging).toBe(true)
		expect(el.hasAttribute("data-axis-dragging")).toBe(true)
		expect(el.style.cursor).toBe("grabbing")
		expect(el.style.userSelect).toBe("none")
		expect(el.scrollLeft).toBe(120)
		await commands.mouseUp()
		expect(z.getState().isDragging).toBe(false)
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		expect(el.style.cursor).toBe("grab")
		expect(el.style.userSelect).toBe("")
		expect(el.scrollLeft).toBe(120)
	})

	it("treats movement within the 5px threshold as a click", async () => {
		const { el, z } = mount()
		const onClick = vi.fn<() => void>()

		el.addEventListener("click", onClick)
		await drag(center(el), 4, { steps: 4 })
		expect(onClick).toHaveBeenCalledTimes(1)
		expect(el.scrollLeft).toBe(0)
		expect(z.getState().isDragging).toBe(false)
	})

	it("lets the next press click even if the drag produced no click", () => {
		const { el } = mount({ options: { momentum: false } })
		const onClick = vi.fn<() => void>()

		el.addEventListener("click", onClick)
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
		const pressWithin100msClickSuppression = pointer("pointerdown", { pointerType: "mouse", button: 0 })

		el.dispatchEvent(pressWithin100msClickSuppression)
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse" }))
		el.click()
		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it("keeps following the pointer outside the container", async () => {
		const indentedSoPointerLeavesContainerButNotPage = "margin-left:100px;"
		const { el } = mount({ style: indentedSoPointerLeavesContainerButNotPage, options: { momentum: false } })
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 160, start.y, 10)
		const timeForSafariToAutoscrollAgainstTheDrag = 300

		await new Promise((resolve) => setTimeout(resolve, timeForSafariToAutoscrollAgainstTheDrag))
		const afterNextScrollEventUndoesAutoscroll = nextFrame

		await afterNextScrollEventUndoesAutoscroll()
		expect(el.scrollLeft).toBe(160)
		await commands.mouseUp()
		await nextFrame()
		expect(el.scrollLeft).toBe(160)
	})

	it("releases where the drag is, even right after an autoscroll", () => {
		const { el, z } = mount({ options: { momentum: false } })

		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		const safariAutoscrollBeforeItsScrollEvent = 10

		el.scrollLeft = safariAutoscrollBeforeItsScrollEvent
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
		expect(el.scrollLeft).toBe(50)
		expect(z.getState().isDragging).toBe(false)
	})

	it("leaves presses on a classic scrollbar to the browser", async () => {
		const sheet = document.createElement("style")

		sheet.textContent =
			".classic::-webkit-scrollbar{height:16px}.classic::-webkit-scrollbar-thumb{background:#888}"
		document.head.append(sheet)
		cleanups.push(() => sheet.remove())

		const { el, z } = mount({
			style: "scrollbar-width:auto;",
			className: "classic",
			options: { momentum: false },
		})

		const scrollbarHeightOutsidePaddingBox = 16

		await vi.waitFor(() => expect(el.offsetHeight - el.clientHeight).toBe(scrollbarHeightOutsidePaddingBox))
		const rect = el.getBoundingClientRect()

		const syntheticPress = (clientY: number) => {
			const at = { pointerType: "mouse", button: 0, clientY }

			el.dispatchEvent(pointer("pointerdown", { ...at, clientX: rect.left + 10 }))
			window.dispatchEvent(pointer("pointermove", { ...at, buttons: 1, clientX: rect.left + 70 }))
			const dragging = z.getState().isDragging

			window.dispatchEvent(pointer("pointerup", { ...at, clientX: rect.left + 70 }))

			return dragging
		}

		const onScrollbar = rect.bottom - 4
		const onContentAboveScrollbar = rect.bottom - 20

		expect(syntheticPress(onScrollbar)).toBe(false)
		expect(syntheticPress(onContentAboveScrollbar)).toBe(true)
	})

	it("drags from images and links instead of starting native drag and drop", async () => {
		const pixel =
			"data:image/svg+xml," +
			encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"/>')

		const { el } = mount({
			options: { momentum: false },
			inner: () => `<a href="#x"><img src="${pixel}" width="100" height="80" alt=""></a>`,
		})

		await drag(center(el.querySelector("img")!), -80, { steps: 16 })
		expect(el.scrollLeft).toBe(80)
	})

	it("leaves touch and pen pointers to native scrolling", () => {
		const { el, z } = mount()

		for (const pointerType of ["touch", "pen"]) {
			el.dispatchEvent(pointer("pointerdown", { pointerType, button: 0, pointerId: 3 }))
			window.dispatchEvent(pointer("pointermove", { pointerType, clientX: 50, pointerId: 3 }))
			expect(z.getState().isDragging).toBe(false)
			expect(el.hasAttribute("data-axis-dragging")).toBe(false)
			window.dispatchEvent(pointer("pointerup", { pointerType, clientX: 50, pointerId: 3 }))
		}

		expect(el.scrollLeft).toBe(0)
	})

	it("ignores the middle and right mouse buttons", () => {
		const { el, z } = mount()

		for (const button of [1, 2]) {
			el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button, pointerId: 1 }))
			window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", clientX: 50, pointerId: 1 }))
			expect(z.getState().isDragging).toBe(false)
		}

		expect(el.scrollLeft).toBe(0)
	})

	it.each([
		["input", `<input value="text" style="width:150px">`],
		["textarea", `<textarea style="width:150px"></textarea>`],
		["select", `<select style="width:150px"><option>a</option></select>`],
		["contenteditable", `<div contenteditable style="width:150px;height:50px">edit</div>`],
		[
			"data-axis-no-drag",
			`<div data-axis-no-drag style="width:150px;height:50px"><span>no drag</span></div>`,
		],
	])("does not take over a drag that starts inside %s", async (_, html) => {
		const { el, z } = mount({ inner: () => html })
		const target = el.querySelector(".card > *")!

		await commands.mouseMove(center(target).x, center(target).y)
		await commands.mouseDown()
		await commands.mouseMove(center(target).x - 80, center(target).y, 8)
		expect(z.getState().isDragging).toBe(false)
		await commands.mouseUp()
		expect(el.scrollLeft).toBe(0)
	})

	it("ends a cancelled drag without momentum or click suppression", async () => {
		const { el, z } = mount()
		const onClick = vi.fn<() => void>()

		el.addEventListener("click", onClick)
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		expect(z.getState().isDragging).toBe(true)
		window.dispatchEvent(pointer("pointercancel", { pointerType: "mouse", clientX: 100 }))
		expect(z.getState()).toMatchObject({ isDragging: false, isMomentum: false, x: { scroll: 50 } })
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		expect(el.style.userSelect).toBe("")
		expect(el.style.cursor).toBe("grab")
		el.click()
		expect(onClick).toHaveBeenCalledTimes(1)
	})
})
