import { afterEach, describe, expect, it, vi } from "vitest"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { MAX } from "../../test/constants"
import { drag } from "../../test/drag"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import { settled } from "../../test/settled"
import { wheel } from "../../test/wheel"

const letFirstResizeObservationsComeAndGo = async () => {
	await nextFrame()
	await nextFrame()
}

afterEach(cleanup)

describe("RTL", () => {
	it("reports logical positions and directions", async () => {
		const { el, z } = mount({ dir: "rtl" })

		expect(z.getState().x).toMatchObject({ scroll: 0, canScrollPrev: false, canScrollNext: true })
		z.scrollTo({ x: 300 }, { animate: false })
		expect(el.scrollLeft).toBe(-300)
		await vi.waitFor(() => expect(z.getState().x.scroll).toBe(300))
		expect(z.getState().x.progress).toBeCloseTo(300 / MAX)
		z.scrollTo({ x: MAX }, { animate: false })
		await vi.waitFor(() =>
			expect(z.getState().x).toMatchObject({ canScrollPrev: true, canScrollNext: false }),
		)
	})

	it("follows direction changes through dir and through an ancestor's class", async () => {
		const sheet = document.createElement("style")

		sheet.textContent = ".rtl { direction: rtl }"
		document.head.append(sheet)
		const wrapper = document.createElement("div")

		document.body.append(wrapper)
		cleanups.push(() => {
			sheet.remove()
			wrapper.remove()
		})

		for (const flip of [(el: HTMLElement) => (el.dir = "rtl"), () => wrapper.classList.add("rtl")]) {
			const { el, z } = mount({ parent: wrapper })

			// oxlint-disable-next-line no-await-in-loop
			await letFirstResizeObservationsComeAndGo()
			flip(el)
			el.scrollLeft = -500
			// oxlint-disable-next-line no-await-in-loop
			await vi.waitFor(() => expect(z.getState().x.scroll).toBe(500))
			z.scrollTo({ x: 300 }, { animate: false })
			expect(el.scrollLeft).toBe(-300)
		}
	})

	it("drags in the physical direction", async () => {
		const { el, z } = mount({ dir: "rtl", options: { momentum: false } })

		await drag(center(el), 120)
		expect(el.scrollLeft).toBe(-120)
		expect(z.getState().x.scroll).toBe(120)
	})

	it("flings towards the inline end when thrown to the right", async () => {
		const { el, z } = mount({ dir: "rtl" })

		await drag(center(el), 100, { steps: 5 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		await settled(z, el)
		expect(el.scrollLeft).toBeLessThan(-150)
		expect(z.getState().x.scroll).toBe(-el.scrollLeft)
	})

	it("steps next towards the inline end, with and without snap", async () => {
		const plain = mount({ dir: "rtl" })

		plain.z.scrollNext()
		await vi.waitFor(() => expect(plain.el.scrollLeft).toBe(-270))

		const snapped = mount({
			dir: "rtl",
			style: "scroll-snap-type:x mandatory;",
			card: "scroll-snap-align:start;",
		})

		snapped.z.scrollNext()
		await vi.waitFor(() => expect(snapped.el.scrollLeft).toBe(-200))
		snapped.z.scrollPrev()
		await vi.waitFor(() => expect(snapped.el.scrollLeft).toBe(0))
	})

	it("turns wheel-down into logical forward scrolling", () => {
		const { el } = mount({ dir: "rtl", options: { wheel: true } })

		expect(wheel(el, { deltaY: 100 })).toBe(true)
		expect(el.scrollLeft).toBe(-100)
	})
})
