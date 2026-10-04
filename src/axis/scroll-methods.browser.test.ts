import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { MAX } from "../../test/constants"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"

afterEach(cleanup)

describe("scroll methods", () => {
	it("pages by 90% of the visible size without snap", async () => {
		const { el, z } = mount()

		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(270))
		z.scrollPrev()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(0))
	})

	it("needs an explicit axis for prev/next on both", async () => {
		const { el, z } = mount({ layout: "both" })

		expect(() => z.scrollPrev()).toThrow(/scrollPrev\(\) needs an axis/)
		expect(() => z.scrollNext()).toThrow(/scrollNext\(\) needs an axis/)
		z.scrollNext("y")
		await vi.waitFor(() => expect(el.scrollTop).toBe(270))
		expect(el.scrollLeft).toBe(0)
	})

	it("scrolls to a 2D position and leaves missing axes alone", () => {
		const { el, z } = mount({ layout: "both" })

		z.scrollTo({ x: 300, y: 400 }, { animate: false })
		expect([el.scrollLeft, el.scrollTop]).toEqual([300, 400])
		z.scrollTo({ y: 10 }, { animate: false })
		expect([el.scrollLeft, el.scrollTop]).toEqual([300, 10])
	})

	it("clamps scrollTo to the scroll range", async () => {
		const { el, z } = mount()

		z.scrollTo({ x: -50 }, { animate: false })
		expect(el.scrollLeft).toBe(0)
		z.scrollTo({ x: 99999 })
		z.scrollPrev()
		const onePageBeforeTheClampedGlideTarget = MAX - 270

		await vi.waitFor(() => expect(el.scrollLeft).toBe(onePageBeforeTheClampedGlideTarget))
	})

	it("ignores scrollTo and prev/next during a drag", async () => {
		const { el, z } = mount({ options: { momentum: false } })
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 100, start.y, 10)
		z.scrollTo({ x: 500 }, { animate: false })
		z.scrollTo({ x: 500 })
		z.scrollNext()
		z.scrollPrev()
		await nextFrame()
		await nextFrame()
		expect(el.scrollLeft).toBe(100)
		expect(z.getState().isDragging).toBe(true)
		await commands.mouseUp()
	})

	it("stops a glide started during the press when the drag begins", async () => {
		const { el, z } = mount({ options: { momentum: false } })
		const start = center(el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		z.scrollTo({ x: 600 })
		await nextFrame()
		await nextFrame()
		await commands.mouseMove(start.x - 50, start.y, 5)
		expect(z.getState().isDragging).toBe(true)
		const at = el.scrollLeft
		const pressPosition = 50
		const pastThePressPositionSoTheDragContinuesFromTheGlide = pressPosition + 10

		expect(at).toBeGreaterThan(pastThePressPositionSoTheDragContinuesFromTheGlide)
		const longerThanTheGlide = 700

		await new Promise((resolve) => setTimeout(resolve, longerThanTheGlide))
		expect(z.getState().isDragging).toBe(true)
		expect(el.scrollLeft).toBe(at)
		await commands.mouseUp()
	})

	it("jumps under prefers-reduced-motion", async () => {
		await commands.reducedMotion(true)
		const { el, z } = mount()

		z.scrollNext()
		expect(el.scrollLeft).toBe(270)
		z.scrollTo({ x: MAX })
		expect(el.scrollLeft).toBe(MAX)
	})
})
