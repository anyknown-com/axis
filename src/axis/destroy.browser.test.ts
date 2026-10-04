import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { drag } from "../../test/drag"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import { pointer } from "../../test/pointer"
import { wheel } from "../../test/wheel"
import { type AxisScrollState, createAxis } from "./index"

const realTimeBetweenFlingEvents = () => new Promise((resolve) => setTimeout(resolve, 16))

afterEach(cleanup)

describe("drag on x", () => {
	it("schedules nothing more once a listener destroys the instance", async () => {
		const { el, z } = mount()

		z.subscribe((state) => {
			if (state.isMomentum) z.destroy()
		})
		await drag(center(el), -100, { steps: 5 })
		await nextFrame()
		await nextFrame()
		await nextFrame()
		expect(el.scrollLeft).toBe(100)
		expect(el.style.scrollSnapType).toBe("")
	})

	it("ends quietly when a listener destroys the instance as its drag starts", () => {
		const { el, z } = mount({ options: { momentum: false } })

		z.subscribe((state) => {
			if (state.isDragging) z.destroy()
		})
		const errors: unknown[] = []
		const onError = (event: ErrorEvent) => errors.push(event.error)

		window.addEventListener("error", onError)
		cleanups.push(() => window.removeEventListener("error", onError))
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 80 }))
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 80 }))
		expect(errors).toEqual([])
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		const other = mount({ options: { momentum: false } })
		const { y: clientY } = center(other.el)

		other.el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0, clientY }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100, clientY }))
		const { isDragging: coordinatorNotStuck } = other.z.getState()

		expect(coordinatorNotStuck).toBe(true)
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
	})

	it("leaves an instance alone once a listener destroyed it during the press", async () => {
		const { el, z } = mount()

		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))

		for (const clientX of [140, 100]) {
			// oxlint-disable-next-line no-await-in-loop
			await realTimeBetweenFlingEvents()
			window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX }))
		}

		await realTimeBetweenFlingEvents()
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 60 }))
		expect(z.getState().isMomentum).toBe(true)
		z.subscribe((state) => {
			const stoppedByThePress = !state.isMomentum

			if (stoppedByThePress) z.destroy()
		})
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		expect(el.style.userSelect).toBe("")
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
	})
})

describe("destroy", () => {
	it("restores inline styles mid-drag and removes every listener", async () => {
		const style = "scroll-snap-type:x mandatory;cursor:pointer;"
		const { el, z } = mount({ style, card: "scroll-snap-align:start;" })
		const reference = document.createElement("div")

		reference.setAttribute("style", el.getAttribute("style")!.replace("cursor: grab", "cursor: pointer"))
		const listener = vi.fn<(state: AxisScrollState) => void>()

		z.subscribe(listener)
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 90, start.y, 5)
		expect(el.style.cursor).toBe("grabbing")
		const calls = listener.mock.calls.length

		expect(calls).toBeGreaterThan(0)
		z.destroy()
		expect(el.style.cssText).toBe(reference.style.cssText)
		expect(el.style.cursor).toBe("pointer")
		expect(el.style.scrollSnapType).toBe("x mandatory")
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		await commands.mouseMove(start.x - 150, start.y, 5)
		await commands.mouseUp()
		const before = el.scrollLeft

		await drag(start, -100)
		expect(el.scrollLeft).toBe(before)
		el.scrollLeft = 0
		await nextFrame()
		expect(listener).toHaveBeenCalledTimes(calls)
		const onClick = vi.fn<() => void>()

		el.addEventListener("click", onClick)
		await drag(start, 0)
		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it("removes a style attribute it created", () => {
		const sheet = document.createElement("style")

		sheet.textContent = ".z{display:flex;width:100px;overflow-x:auto}.z>div{flex:0 0 300px}"
		const el = document.createElement("div")

		el.className = "z"
		el.innerHTML = '<div style="height:10px"></div>'
		document.body.append(sheet, el)
		const z = createAxis(el, { wheel: true })

		expect(el.style.cursor).toBe("grab")
		z.destroy()
		expect(el.hasAttribute("style")).toBe(false)
		expect(wheel(el, { deltaY: 100 })).toBe(false)
		el.remove()
		sheet.remove()
	})
})
