import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "../../test/cleanup"
import { MAX } from "../../test/constants"
import { mount } from "../../test/mount"
import { settled } from "../../test/settled"
import { wheel } from "../../test/wheel"

afterEach(cleanup)

describe("wheel", () => {
	it("turns vertical wheel into horizontal scrolling and lets the page scroll at the edges", () => {
		const { el, z } = mount({ options: { wheel: true } })

		expect(wheel(el, { deltaY: -100 })).toBe(false)
		expect(wheel(el, { deltaY: 100 })).toBe(true)
		expect(el.scrollLeft).toBe(100)
		expect(wheel(el, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE })).toBe(true)
		expect(el.scrollLeft).toBe(148)
		expect(wheel(el, { deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_PAGE })).toBe(true)
		expect(el.scrollLeft).toBe(448)
		z.scrollTo({ x: MAX }, { animate: false })
		expect(wheel(el, { deltaY: 100 })).toBe(false)
		expect(wheel(el, { deltaY: -100 })).toBe(true)
	})

	it("leaves shift+wheel and horizontal wheel alone", () => {
		const { el } = mount({ options: { wheel: true } })

		expect(wheel(el, { deltaY: 100, shiftKey: true })).toBe(false)
		expect(wheel(el, { deltaY: 10, deltaX: 50 })).toBe(false)
	})

	it("is ignored on y and both", () => {
		for (const layout of ["y", "both"] as const) {
			const { el } = mount({ layout, options: { wheel: true } })

			expect(wheel(el, { deltaY: 100 })).toBe(false)
			expect([el.scrollLeft, el.scrollTop]).toEqual([0, 0])
		}
	})

	it("is off by default and can be toggled with setOptions", () => {
		const { el, z } = mount()

		expect(wheel(el, { deltaY: 100 })).toBe(false)
		expect(el.scrollLeft).toBe(0)
		z.setOptions({ wheel: true })
		expect(wheel(el, { deltaY: 100 })).toBe(true)
		z.setOptions({ axis: "both" })
		expect(wheel(el, { deltaY: 100 })).toBe(false)
		z.setOptions({ axis: "x", wheel: false })
		expect(wheel(el, { deltaY: 100 })).toBe(false)
	})

	it("settles on the next snap position in the wheel direction", async () => {
		const { el, z } = mount({
			style: "scroll-snap-type:x mandatory;",
			card: "scroll-snap-align:start;",
			options: { wheel: true },
		})

		expect(wheel(el, { deltaY: 40 })).toBe(true)
		await vi.waitFor(() => expect(el.scrollLeft).toBe(200))
		await settled(z, el)
		expect(el.style.scrollSnapType).toBe("x mandatory")
	})
})
