import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import { pointer } from "../../test/pointer"
import { settled } from "../../test/settled"
import { createAxis } from "./index"

const click = async (point: { x: number; y: number }, ms: number) => {
	await commands.mouseMove(point.x, point.y)
	await commands.mouseDown()
	await new Promise((resolve) => setTimeout(resolve, ms))
	await commands.mouseUp()
}

const releaseTheWindowNeverSees = () => commands.mouseUp()

afterEach(cleanup)

describe("holding scroll positions", () => {
	it.each<[string, (el: HTMLElement) => void, number]>([
		["a scrollLeft write", (el) => (el.scrollLeft = 400), 400],
		["scrollIntoView", (el) => el.children[5]!.scrollIntoView({ inline: "start", block: "nearest" }), 1000],
		["a smooth scrollTo", (el) => el.scrollTo({ left: 400, behavior: "smooth" }), 400],
	])("lets the page scroll during a click: %s on mousedown", async (_, scroll, expected) => {
		const { el } = mount()

		el.addEventListener("mousedown", () => scroll(el))
		await click(center(el), 600)
		await vi.waitFor(() => expect(el.scrollLeft).toBe(expected))
	})

	it.each([
		["with snap", { style: "scroll-snap-type:x mandatory;", card: "scroll-snap-align:start;" }],
		["without snap", {}],
	])("lets a scrollTo glide started on mousedown finish after a click, %s", async (_, layout) => {
		const { el, z } = mount(layout)

		el.addEventListener("mousedown", () => z.scrollTo({ x: 400 }))
		await click(center(el), 60)
		await vi.waitFor(() => expect(el.scrollLeft).toBe(400))
		await settled(z, el)
		expect(el.scrollLeft).toBe(400)
	})

	it("lets the page scroll while the mouse is held still", async () => {
		const { el } = mount()

		await commands.mouseMove(center(el).x, center(el).y)
		await commands.mouseDown()
		el.scrollLeft = 300
		await nextFrame()
		await nextFrame()
		expect(el.scrollLeft).toBe(300)
		await commands.mouseUp()
		await nextFrame()
		expect(el.scrollLeft).toBe(300)
	})

	it("keeps scroll anchoring working during a press", async () => {
		const blockContainerWhereBrowsersAnchor = "width:100px;height:300px;overflow-y:auto;scrollbar-width:none"
		const el = document.createElement("div")

		el.setAttribute("style", blockContainerWhereBrowsersAnchor)
		el.innerHTML = '<div style="height:200px"></div>'.repeat(10)
		document.body.append(el)
		const z = createAxis(el, { axis: "y" })

		cleanups.push(() => {
			z.destroy()
			el.remove()
		})
		el.scrollTop = 400
		await nextFrame()
		await commands.mouseMove(center(el).x, center(el).y)
		await commands.mouseDown()
		const addedAboveTheVisibleContent = document.createElement("div")

		addedAboveTheVisibleContent.style.height = "200px"
		el.prepend(addedAboveTheVisibleContent)
		await nextFrame()
		await nextFrame()
		await commands.mouseUp()
		await nextFrame()
		expect(el.scrollTop).toBe(600)
	})

	it("forgets a press released over an iframe", async () => {
		const { el, z } = mount()
		const iframe = document.createElement("iframe")

		iframe.setAttribute("style", "display:block;width:300px;height:100px;border:0")
		iframe.srcdoc = "frame"
		const loaded = new Promise((resolve) => iframe.addEventListener("load", resolve))

		document.body.append(iframe)
		cleanups.push(() => iframe.remove())
		await loaded
		const top = iframe.getBoundingClientRect().top
		const x = el.getBoundingClientRect().left + 150

		await commands.mouseMove(x, top - 2)
		await commands.mouseDown()
		await commands.mouseMove(x, top + 2, 2)
		await releaseTheWindowNeverSees()
		const moveBackWithNoButtonDown = () => commands.mouseMove(x - 120, top - 30, 10)

		await moveBackWithNoButtonDown()
		expect(z.getState().isDragging).toBe(false)
		expect(el.scrollLeft).toBe(0)
		el.scrollLeft = 200
		await nextFrame()
		expect(el.scrollLeft).toBe(200)
	})

	it("ends a drag released over an iframe", async () => {
		const playwrightMovesInWebKitAreFastEnoughToFling = { momentum: false }
		const { el, z } = mount({ options: playwrightMovesInWebKitAreFastEnoughToFling })
		const iframe = document.createElement("iframe")

		iframe.setAttribute("style", "display:block;width:300px;height:100px;border:0")
		iframe.srcdoc = "frame"
		const loaded = new Promise((resolve) => iframe.addEventListener("load", resolve))

		document.body.append(iframe)
		cleanups.push(() => iframe.remove())
		await loaded
		const top = iframe.getBoundingClientRect().top
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 60, start.y, 6)
		await commands.mouseMove(start.x - 60, top + 50, 6)
		await commands.mouseUp()
		await commands.mouseMove(start.x - 100, top - 60, 10)
		expect(z.getState().isDragging).toBe(false)
		expect(el.scrollLeft).toBe(60)
		el.scrollLeft = 160
		await nextFrame()
		expect(el.scrollLeft).toBe(160)
	})

	it.each([
		["a context menu", () => window.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))],
		["the window losing focus", () => window.dispatchEvent(new Event("blur"))],
		[
			"the tab being hidden",
			() => {
				Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
				document.dispatchEvent(new Event("visibilitychange"))
				Reflect.deleteProperty(document, "visibilityState")
			},
		],
	])("cancels the drag on %s", async (_, cancel) => {
		const { el, z } = mount({ options: { momentum: false } })

		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		expect(z.getState().isDragging).toBe(true)
		cancel()
		expect(z.getState().isDragging).toBe(false)
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		const moveThatADragWouldFollow = pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 20 })

		window.dispatchEvent(moveThatADragWouldFollow)
		expect(el.scrollLeft).toBe(50)
		const scrollThatAHoldWouldUndo = 300

		el.scrollLeft = scrollThatAHoldWouldUndo
		await nextFrame()
		expect(el.scrollLeft).toBe(300)
	})
})
