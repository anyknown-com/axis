import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { CARD, MAX, VIEWPORT } from "../../test/constants"
import { drag } from "../../test/drag"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import { settled } from "../../test/settled"

afterEach(cleanup)

describe("scroll-snap", () => {
	const snap = { style: "scroll-snap-type:x mandatory;", card: "scroll-snap-align:start;" }

	const restingAtZeroWithSnapPositionsCached = (className: string) => {
		const row = mount({ ...snap, className })
		const measuresSnapPositionsAndGoesNowhere = () => row.z.scrollPrev()

		measuresSnapPositionsAndGoesNowhere()

		return row
	}

	it("settles a slow drag on the snap position nearest the release point", async () => {
		const { el, z } = mount({ ...snap })

		await drag(center(el), -130, { holdStillBeforeRelease: 200 })
		await settled(z, el)
		expect(el.scrollLeft).toBe(200)
		expect(el.style.scrollSnapType).toBe("x mandatory")
	})

	it("settles a fling on the snap position nearest the predicted landing, unsnapped only while moving", async () => {
		const { el, z } = mount({ ...snap })
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 60, start.y, 3)
		expect(el.style.getPropertyValue("scroll-snap-type")).toBe("none")
		expect(el.style.getPropertyValue("scroll-behavior")).toBe("auto")
		await commands.mouseUp()
		await settled(z, el)
		expect(el.style.getPropertyValue("scroll-snap-type")).toBe("x mandatory")
		expect(el.scrollLeft).toBeGreaterThan(200)
		expect(el.scrollLeft % CARD === 0 || el.scrollLeft === MAX).toBe(true)
	})

	it("honours center alignment and scroll-padding", async () => {
		const { el, z } = mount({
			style: "scroll-snap-type:x mandatory;scroll-padding-left:20px;",
			card: "scroll-snap-align:start;",
		})

		await drag(center(el), -150, { holdStillBeforeRelease: 200 })
		await settled(z, el)
		expect(el.scrollLeft).toBe(180)
		const centered = mount({ ...snap, card: "scroll-snap-align:center;" })

		centered.z.scrollNext()
		await vi.waitFor(() => expect(centered.el.scrollLeft).toBe(150))
	})

	it("honours scroll-margin", async () => {
		const { el, z } = mount({ ...snap, card: "scroll-snap-align:start;scroll-margin-left:20px;" })

		await drag(center(el), -150, { holdStillBeforeRelease: 200 })
		await settled(z, el)
		expect(el.scrollLeft).toBe(180)
		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(380))
	})

	it("aligns ends against scroll-padding-right and scroll-padding-bottom", async () => {
		const row = mount({
			style: "scroll-snap-type:x mandatory;scroll-padding-right:20px;",
			card: "scroll-snap-align:end;",
		})

		const rowSnapportEnd = VIEWPORT - 20

		row.z.scrollNext()
		await vi.waitFor(() => expect(row.el.scrollLeft).toBe(2 * CARD - rowSnapportEnd))
		row.z.scrollNext()
		await vi.waitFor(() => expect(row.el.scrollLeft).toBe(3 * CARD - rowSnapportEnd))

		const column = mount({
			layout: "y",
			style: "scroll-snap-type:y mandatory;scroll-padding-bottom:10px;",
			card: "scroll-snap-align:end;",
		})

		const columnSnapportEnd = VIEWPORT - 10

		column.z.scrollNext()
		await settled(column.z, column.el)
		const keptByTheBrowserOnceSnapTypeIsBack = column.el.scrollTop

		expect(keptByTheBrowserOnceSnapTypeIsBack).toBe(2 * CARD - columnSnapportEnd)
	})

	it.each([
		["inline", "x"],
		["block", "y"],
	] as const)("reads scroll-snap-type: %s as %s", async (type, layout) => {
		const { el, z } = mount({
			layout,
			style: `scroll-snap-type:${type} mandatory;`,
			card: "scroll-snap-align:start;",
		})

		await drag(center(el), layout === "x" ? -130 : 0, {
			dy: layout === "y" ? -130 : 0,
			holdStillBeforeRelease: 200,
		})
		await settled(z, el)
		expect(layout === "x" ? el.scrollLeft : el.scrollTop).toBe(200)
	})

	it("re-measures snap positions after a resize, an attribute change or refresh()", async () => {
		const sheet = document.createElement("style")

		document.head.append(sheet)
		cleanups.push(() => sheet.remove())
		const resized = restingAtZeroWithSnapPositionsCached("resized")
		const classed = restingAtZeroWithSnapPositionsCached("")
		const refreshed = restingAtZeroWithSnapPositionsCached("refreshed")
		const resizesChildWithoutMutation = ".resized > :first-child { flex-basis: 260px !important }"
		const padsWithoutResize = ".padded, .refreshed { scroll-padding-left: 20px }"

		sheet.textContent = `${resizesChildWithoutMutation}
			${padsWithoutResize}`
		classed.el.classList.add("padded")
		refreshed.z.refresh()
		await nextFrame()
		await nextFrame()
		const widerFirstCard = 260
		const twentyPixelPadding = 180

		for (const [row, firstSnapAfterZero] of [
			[resized, widerFirstCard],
			[classed, twentyPixelPadding],
			[refreshed, twentyPixelPadding],
		] as const) {
			row.z.scrollNext()
			// oxlint-disable-next-line no-await-in-loop
			await vi.waitFor(() => expect(row.el.scrollLeft).toBe(firstSnapAfterZero))
		}
	})

	it("steps prev/next between snap positions", async () => {
		const { el, z } = mount({ ...snap })

		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(200))
		z.scrollNext()
		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(600))
		z.scrollPrev()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(400))
	})

	it("snaps on y with block alignment and scroll-padding-top", async () => {
		const { el, z } = mount({
			layout: "y",
			style: "scroll-snap-type:y mandatory;scroll-padding-top:10px;",
			card: "scroll-snap-align:start;",
		})

		await drag(center(el), 0, { dy: -120, holdStillBeforeRelease: 200 })
		await settled(z, el)
		expect(el.scrollTop).toBe(190)
		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollTop).toBe(390))
	})

	it("snaps both axes independently and glides there together", async () => {
		const blockStartInlineCenter = "scroll-snap-align:start center;"

		const { el, z } = mount({
			layout: "both",
			style: "scroll-snap-type:both mandatory;",
			card: blockStartInlineCenter,
		})

		await drag(center(el), -130, { dy: -130, holdStillBeforeRelease: 200 })
		await settled(z, el)
		const xCentersA200pxCellIn300pxPort = 150
		const yAlignsStarts = 200

		expect(el.scrollLeft).toBe(xCentersA200pxCellIn300pxPort)
		expect(el.scrollTop).toBe(yAlignsStarts)
		z.scrollNext("x")
		await vi.waitFor(() => expect(el.scrollLeft).toBe(350))
		expect(el.scrollTop).toBe(200)
	})
})
