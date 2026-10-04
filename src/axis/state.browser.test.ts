import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { MAX } from "../../test/constants"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import type { AxisScrollState } from "./index"

afterEach(cleanup)

describe("state", () => {
	it("reports both axes with a 1px edge tolerance", async () => {
		const { el, z } = mount()

		expect(z.getState()).toEqual({
			x: { scroll: 0, maxScroll: MAX, progress: 0, canScrollPrev: false, canScrollNext: true },
			y: { scroll: 0, maxScroll: 0, progress: 0, canScrollPrev: false, canScrollNext: false },
			isDragging: false,
			isMomentum: false,
		})
		el.scrollLeft = 1
		await vi.waitFor(() => expect(z.getState().x.scroll).toBe(1))
		expect(z.getState().x.canScrollPrev).toBe(false)
		el.scrollLeft = 2
		await vi.waitFor(() => expect(z.getState().x.canScrollPrev).toBe(true))
		el.scrollLeft = MAX
		await vi.waitFor(() => expect(z.getState().x.canScrollNext).toBe(false))
		expect(z.getState().x.progress).toBe(1)
		el.scrollLeft = MAX - 1
		await vi.waitFor(() => expect(z.getState().x.scroll).toBe(MAX - 1))
		expect(z.getState().x.canScrollNext).toBe(false)
	})

	it("tracks y even when only x is dragged", async () => {
		const { el, z } = mount({ layout: "both", options: { axis: "x" } })

		el.scrollTop = 250
		await vi.waitFor(() =>
			expect(z.getState().y).toMatchObject({ scroll: 250, maxScroll: MAX, canScrollPrev: true }),
		)
	})

	it("notifies only on change and keeps unchanged axis objects", async () => {
		const { el, z } = mount()
		const listener = vi.fn<(state: AxisScrollState) => void>()
		const unsubscribe = z.subscribe(listener)
		const { y } = z.getState()

		el.dispatchEvent(new Event("scroll"))
		expect(listener).not.toHaveBeenCalled()
		el.scrollLeft = 50
		await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
		expect(listener.mock.calls[0]![0]).toBe(z.getState())
		expect(z.getState().y).toBe(y)
		unsubscribe()
		el.scrollLeft = 80
		await vi.waitFor(() => expect(z.getState().x.scroll).toBe(80))
		expect(listener).toHaveBeenCalledTimes(1)
	})

	it("follows container resizes and added or resized children", async () => {
		const { el, z } = mount()

		el.style.width = "2000px"
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(0))
		expect(z.getState().x.canScrollNext).toBe(false)
		expect(el.style.cursor).toBe("")
		const extra = document.createElement("div")

		extra.style.cssText = "flex:0 0 100px"
		el.append(extra)
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(100))
		expect(el.style.cursor).toBe("grab")
		extra.style.flexBasis = "300px"
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(300))
		extra.remove()
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(0))
	})

	it("follows layout changes that resize no observed box", async () => {
		const { el, z } = mount({ style: "gap:10px;" })
		const { maxScroll } = z.getState().x
		const emptyChildThatOnlyAddsAFlexGap = document.createElement("div")

		emptyChildThatOnlyAddsAFlexGap.style.height = "0"
		el.append(emptyChildThatOnlyAddsAFlexGap)
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(maxScroll + 10))

		const childMarginThatChangesNoBoxSize = "50px"

		;(el.firstElementChild as HTMLElement).style.marginLeft = childMarginThatChangesNoBoxSize
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(maxScroll + 60))
	})

	it("keeps observing a child removed and re-added around its own style write", async () => {
		const sheet = document.createElement("style")

		document.head.append(sheet)
		cleanups.push(() => sheet.remove())
		const { el, z } = mount()
		const child = el.lastElementChild as HTMLElement

		child.classList.add("grows")
		await nextFrame()
		await nextFrame()
		child.remove()
		const cursorStyleWriteDeferringTheRemovalRecord = () => z.setOptions({ cursor: false })

		cursorStyleWriteDeferringTheRemovalRecord()
		el.append(child)
		await nextFrame()
		await nextFrame()
		const growthOnlyTheChildResizeObserverSees = ".grows { flex-basis: 600px !important }"

		sheet.textContent = growthOnlyTheChildResizeObserverSees
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(MAX + 400))
	})

	it("leaves the cursor alone with cursor: false", () => {
		const { el } = mount({ options: { cursor: false } })

		expect(el.style.cursor).toBe("")
	})
})
