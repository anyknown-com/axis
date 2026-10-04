import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { MAX } from "../../test/constants"
import { drag } from "../../test/drag"
import { mount } from "../../test/mount"
import { nextFrame } from "../../test/next-frame"
import { settled } from "../../test/settled"

afterEach(cleanup)

describe("drag on x", () => {
	it("does not fling when the pointer stopped before release", async () => {
		const { el, z } = mount()

		await drag(center(el), -100, { steps: 5, holdStillBeforeRelease: 200 })
		await settled(z, el)
		expect(el.scrollLeft).toBe(100)
	})

	it("skips momentum under prefers-reduced-motion", async () => {
		await commands.reducedMotion(true)
		const { el, z } = mount()

		await drag(center(el), -100, { steps: 5 })
		expect(z.getState().isMomentum).toBe(false)
		expect(el.scrollLeft).toBe(100)
	})

	it("stops momentum on native input", async () => {
		const { el, z } = mount()

		await drag(center(el), -100, { steps: 5 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		const modifierThatDoesNotScroll = new KeyboardEvent("keydown", { key: "Shift" })

		el.dispatchEvent(modifierThatDoesNotScroll)
		expect(z.getState().isMomentum).toBe(true)
		const scrollKeyRunningTheWheelAndTouchInterrupt = new KeyboardEvent("keydown", { key: "ArrowRight" })

		el.dispatchEvent(scrollKeyRunningTheWheelAndTouchInterrupt)
		expect(z.getState().isMomentum).toBe(false)
		const stoppedAt = el.scrollLeft

		await nextFrame()
		await nextFrame()
		expect(el.scrollLeft).toBe(stoppedAt)
	})

	it("stops a glide when the mouse is pressed", async () => {
		const { el, z } = mount()

		await drag(center(el), -100, { steps: 5 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		await commands.mouseDown()
		expect(z.getState().isMomentum).toBe(false)
		const stoppedAt = el.scrollLeft

		await nextFrame()
		await nextFrame()
		expect(el.scrollLeft).toBe(stoppedAt)
		await commands.mouseUp()
		await settled(z, el)
		expect(el.scrollLeft).toBe(stoppedAt)
	})

	it("stops gliding at the edge", async () => {
		const { el, z } = mount()

		el.scrollLeft = MAX - 120
		await vi.waitFor(() => expect(z.getState().x.scroll).toBe(MAX - 120))
		await drag(center(el), -100, { steps: 5 })
		await vi.waitFor(() => expect(el.scrollLeft).toBe(MAX))
		const { isMomentum: stillGlidingOnceTheEdgeIsHit } = z.getState()

		expect(stillGlidingOnceTheEdgeIsHit).toBe(false)
	})
})
