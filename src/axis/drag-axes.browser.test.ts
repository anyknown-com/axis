import { afterEach, describe, expect, it, vi } from "vitest"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { MAX } from "../../test/constants"
import { drag } from "../../test/drag"
import { mount } from "../../test/mount"
import { settled } from "../../test/settled"

afterEach(cleanup)

describe("drag on x", () => {
	it("ignores vertical mouse movement", async () => {
		const { el, z } = mount({ layout: "both", options: { axis: "x", momentum: false } })

		await drag(center(el), -100, { dy: -60 })
		expect(el.scrollLeft).toBe(100)
		expect(el.scrollTop).toBe(0)
		const mostlyVertical = { dy: -80 }

		await drag(center(el), -10, mostlyVertical)
		expect(z.getState().isDragging).toBe(false)
		expect(el.scrollLeft).toBe(100)
		expect(el.scrollTop).toBe(0)
	})

	it("glides only along the dragged axis", async () => {
		const { el, z } = mount({ layout: "both", options: { axis: "x" } })

		await drag(center(el), -100, { dy: -60, steps: 5 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		await settled(z, el)
		expect(el.scrollLeft).toBeGreaterThan(150)
		expect(el.scrollTop).toBe(0)
	})
})

describe("drag on y and both", () => {
	it("drags vertically on y and ignores horizontal movement", async () => {
		const { el, z } = mount({ layout: "y", options: { momentum: false } })

		await drag(center(el), -30, { dy: -120 })
		expect(el.scrollTop).toBe(120)
		expect(el.scrollLeft).toBe(0)
		expect(z.getState().y).toMatchObject({ scroll: 120, maxScroll: MAX, canScrollPrev: true })
	})

	it("pans freely in 2D on both", async () => {
		const { el, z } = mount({ layout: "both", options: { momentum: false } })

		await drag(center(el), -120, { dy: -80 })
		expect(el.scrollLeft).toBe(120)
		expect(el.scrollTop).toBe(80)
		await drag(center(el), 30, { dy: -90 })
		expect(el.scrollLeft).toBe(90)
		expect(el.scrollTop).toBe(170)
		expect(z.getState().x.scroll).toBe(90)
		expect(z.getState().y.scroll).toBe(170)
	})

	it("flings along the 2D release velocity", async () => {
		const { el, z } = mount({ layout: "both" })

		await drag(center(el), -60, { dy: -40, steps: 4 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		await settled(z, el)
		expect(el.scrollLeft).toBeGreaterThan(100)
		expect(el.scrollTop).toBeGreaterThan(60)
		expect(el.style.scrollSnapType).toBe("")
		expect(el.style.scrollBehavior).toBe("")
	})
})
