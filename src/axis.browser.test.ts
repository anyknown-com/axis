import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { register } from "./coordinator"
import { type AxisInstance, type AxisOptions, createAxis } from "./index"

const CARD = 200
// x layout: 300px wide row of ten 200px cards. y layout: 300px tall column of ten 200px cards.
// both layout: 300×300 viewport over a 10×10 grid of 200px cells. Every max scroll is 10 × 200 − 300.
const MAX = 10 * CARD - 300

let cleanups: (() => void)[] = []

afterEach(async () => {
	while (cleanups.length > 0) cleanups.pop()!()
	await commands.mouseUp()
	await commands.reducedMotion(false)
})

const LAYOUTS = {
	x: {
		container: "display:flex;width:300px;height:100px;overflow-x:auto;",
		card: `flex:0 0 ${CARD}px;height:100px;`,
		count: 10,
	},
	y: {
		container: "display:flex;flex-direction:column;width:100px;height:300px;overflow-y:auto;",
		card: `flex:0 0 ${CARD}px;`,
		count: 10,
	},
	both: {
		container: `display:grid;grid-template-columns:repeat(10,${CARD}px);grid-auto-rows:${CARD}px;width:300px;height:300px;overflow:auto;`,
		card: "",
		count: 100,
	},
}

function mount({
	layout = "x",
	style = "",
	card = "",
	inner = (i: number) => `${i}`,
	options,
	dir,
	className = "",
	parent = document.body,
}: {
	layout?: keyof typeof LAYOUTS
	style?: string
	card?: string
	inner?: (i: number) => string
	options?: AxisOptions
	dir?: "ltr" | "rtl"
	className?: string
	parent?: HTMLElement
} = {}) {
	const spec = LAYOUTS[layout]
	const el = document.createElement("div")
	if (dir) el.dir = dir
	el.className = className
	el.setAttribute("style", `${spec.container}scrollbar-width:none;margin:0;${style}`)
	el.innerHTML = Array.from(
		{ length: spec.count },
		(_, i) => `<div class="card" style="${spec.card}${card}">${inner(i)}</div>`,
	).join("")
	document.body.style.margin = "0"
	parent.append(el)
	const z = createAxis(el, { axis: layout, ...options })
	cleanups.push(() => {
		z.destroy()
		el.remove()
	})
	return { el, z }
}

function center(el: Element) {
	const rect = el.getBoundingClientRect()
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** Real mouse drag by (`dx`, `dy`). `hold` pauses before release so no fling velocity remains. */
async function drag(from: { x: number; y: number }, dx: number, { dy = 0, steps = 10, hold = 0 } = {}) {
	await commands.mouseMove(from.x, from.y)
	await commands.mouseDown()
	await commands.mouseMove(from.x + dx, from.y + dy, steps)
	if (hold) await new Promise((resolve) => setTimeout(resolve, hold))
	await commands.mouseUp()
}

/** Waits until the instance is at rest and has handed scroll-snap-type back (its override is `!important`). */
const settled = (z: AxisInstance, el: HTMLElement) =>
	vi.waitFor(
		() => {
			const { isDragging, isMomentum } = z.getState()
			if (isDragging || isMomentum || el.style.getPropertyPriority("scroll-snap-type")) {
				throw new Error("still moving")
			}
		},
		{ timeout: 4000 },
	)

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const pointer = (type: string, init: PointerEventInit) =>
	new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: 150, clientY: 50, ...init })

const wheel = (el: HTMLElement, init: WheelEventInit) => {
	const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init })
	el.dispatchEvent(event)
	return event.defaultPrevented
}

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
		const onClick = vi.fn()
		el.addEventListener("click", onClick)
		await drag(center(el), 4, { steps: 4 })
		expect(onClick).toHaveBeenCalledTimes(1)
		expect(el.scrollLeft).toBe(0)
		expect(z.getState().isDragging).toBe(false)
	})

	it("lets the next press click even if the drag produced no click", () => {
		const { el } = mount({ options: { momentum: false } })
		const onClick = vi.fn()
		el.addEventListener("click", onClick)
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
		// Right away, well within the 100ms suppression: the new press means the drag's click is not coming.
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse" }))
		el.click()
		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it("keeps following the pointer outside the container", async () => {
		// Safari autoscrolls towards a pointer held outside the container, against the drag.
		// Indented, so the pointer leaves the container but stays inside the page.
		const { el } = mount({ style: "margin-left:100px;", options: { momentum: false } })
		const start = center(el)
		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 160, start.y, 10)
		await new Promise((resolve) => setTimeout(resolve, 300))
		// An autoscroll is undone on the next scroll event, so read after a frame.
		await nextFrame()
		expect(el.scrollLeft).toBe(160)
		await commands.mouseUp()
		await nextFrame()
		expect(el.scrollLeft).toBe(160)
	})

	it("releases where the drag is, even right after an autoscroll", () => {
		const { el, z } = mount({ options: { momentum: false } })
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		// What a Safari autoscroll does, with the release coming before the scroll event that would undo it.
		el.scrollLeft = 10
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
		// The scrollbar takes layout space, so a press on it is outside the padding box.
		await vi.waitFor(() => expect(el.offsetHeight - el.clientHeight).toBe(16))
		// Synthetic input: once a real scrollbar has the press, browsers send no pointer moves to the page.
		const rect = el.getBoundingClientRect()
		const press = (clientY: number) => {
			const at = { pointerType: "mouse", button: 0, clientY }
			el.dispatchEvent(pointer("pointerdown", { ...at, clientX: rect.left + 10 }))
			window.dispatchEvent(pointer("pointermove", { ...at, buttons: 1, clientX: rect.left + 70 }))
			const dragging = z.getState().isDragging
			window.dispatchEvent(pointer("pointerup", { ...at, clientX: rect.left + 70 }))
			return dragging
		}
		expect(press(rect.bottom - 4)).toBe(false)
		// The same press on the content above it is a drag.
		expect(press(rect.bottom - 20)).toBe(true)
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

	it("ignores vertical mouse movement", async () => {
		const { el, z } = mount({ layout: "both", options: { axis: "x", momentum: false } })
		await drag(center(el), -100, { dy: -60 })
		expect(el.scrollLeft).toBe(100)
		expect(el.scrollTop).toBe(0)
		// A mostly vertical movement is not an x drag at all.
		await drag(center(el), -10, { dy: -80 })
		expect(z.getState().isDragging).toBe(false)
		expect(el.scrollLeft).toBe(100)
		expect(el.scrollTop).toBe(0)
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

	it("does not fling when the pointer stopped before release", async () => {
		const { el, z } = mount()
		await drag(center(el), -100, { steps: 5, hold: 200 })
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
		// wheel, touchstart and scrolling keys all run the same interrupt. A key stands for them: Safari
		// scrolls natively on a synthetic wheel event, which would move the container after the stop.
		const { el, z } = mount()
		await drag(center(el), -100, { steps: 5 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		// Only keys that scroll take over: a modifier does not.
		el.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }))
		expect(z.getState().isMomentum).toBe(true)
		el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
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
		// The coordinator is not stuck: another instance drags normally.
		const other = mount({ options: { momentum: false } })
		const { y: clientY } = center(other.el)
		other.el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0, clientY }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100, clientY }))
		expect(other.z.getState().isDragging).toBe(true)
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
	})

	it("leaves an instance alone once a listener destroyed it during the press", async () => {
		const { el, z } = mount()
		// Synthetic fling with real time between the events, so it has a velocity.
		const wait = () => new Promise((resolve) => setTimeout(resolve, 16))
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		for (const clientX of [140, 100]) {
			await wait()
			window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX }))
		}
		await wait()
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 60 }))
		expect(z.getState().isMomentum).toBe(true)
		// The press stops the momentum, which notifies this listener.
		z.subscribe((state) => {
			if (!state.isMomentum) z.destroy()
		})
		el.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }))
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 100 }))
		expect(el.hasAttribute("data-axis-dragging")).toBe(false)
		expect(el.style.userSelect).toBe("")
		window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
	})

	it("ends a cancelled drag without momentum or click suppression", async () => {
		const { el, z } = mount()
		const onClick = vi.fn()
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

	it("glides only along the dragged axis", async () => {
		const { el, z } = mount({ layout: "both", options: { axis: "x" } })
		await drag(center(el), -100, { dy: -60, steps: 5 })
		await vi.waitFor(() => expect(z.getState().isMomentum).toBe(true))
		await settled(z, el)
		expect(el.scrollLeft).toBeGreaterThan(150)
		expect(el.scrollTop).toBe(0)
	})

	it("stops gliding at the edge", async () => {
		const { el, z } = mount()
		el.scrollLeft = MAX - 120
		await vi.waitFor(() => expect(z.getState().x.scroll).toBe(MAX - 120))
		await drag(center(el), -100, { steps: 5 })
		await vi.waitFor(() => expect(el.scrollLeft).toBe(MAX))
		// The glide ends when it hits the edge, not when its speed has decayed.
		expect(z.getState().isMomentum).toBe(false)
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

describe("scroll-snap", () => {
	const snap = { style: "scroll-snap-type:x mandatory;", card: "scroll-snap-align:start;" }
	// A snapping row that rests at 0 with its snap positions cached (scrollPrev measures them, goes nowhere).
	const cached = (className: string) => {
		const row = mount({ ...snap, className })
		row.z.scrollPrev()
		return row
	}

	it("settles a slow drag on the snap position nearest the release point", async () => {
		const { el, z } = mount({ ...snap })
		await drag(center(el), -130, { hold: 200 })
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
		await drag(center(el), -150, { hold: 200 })
		await settled(z, el)
		expect(el.scrollLeft).toBe(180)
		const centered = mount({ ...snap, card: "scroll-snap-align:center;" })
		centered.z.scrollNext()
		await vi.waitFor(() => expect(centered.el.scrollLeft).toBe(150))
	})

	it("honours scroll-margin", async () => {
		const { el, z } = mount({ ...snap, card: "scroll-snap-align:start;scroll-margin-left:20px;" })
		await drag(center(el), -150, { hold: 200 })
		await settled(z, el)
		expect(el.scrollLeft).toBe(180)
		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(380))
	})

	it("aligns ends against scroll-padding-right and scroll-padding-bottom", async () => {
		// Card ends at 200, 400, …; the port ends 20px before the right edge: 0 (clamped), 120, 320, …
		const row = mount({
			style: "scroll-snap-type:x mandatory;scroll-padding-right:20px;",
			card: "scroll-snap-align:end;",
		})
		row.z.scrollNext()
		await vi.waitFor(() => expect(row.el.scrollLeft).toBe(120))
		row.z.scrollNext()
		await vi.waitFor(() => expect(row.el.scrollLeft).toBe(320))
		// 10px of bottom padding in a 300px port: 0 (clamped), 110, 310, …
		const column = mount({
			layout: "y",
			style: "scroll-snap-type:y mandatory;scroll-padding-bottom:10px;",
			card: "scroll-snap-align:end;",
		})
		column.z.scrollNext()
		await settled(column.z, column.el)
		// The browser keeps it there once the snap type is back, so it agrees on the position.
		expect(column.el.scrollTop).toBe(110)
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
		await drag(center(el), layout === "x" ? -130 : 0, { dy: layout === "y" ? -130 : 0, hold: 200 })
		await settled(z, el)
		expect(layout === "x" ? el.scrollLeft : el.scrollTop).toBe(200)
	})

	it("re-measures snap positions after a resize, an attribute change or refresh()", async () => {
		const sheet = document.createElement("style")
		document.head.append(sheet)
		cleanups.push(() => sheet.remove())
		const resized = cached("resized")
		const classed = cached("")
		const refreshed = cached("refreshed")
		// The first snap position after 0 moves from 200 to 260 (wider first card) or 180 (20px padding). A
		// stylesheet change resizes a child without any mutation, and pads the refreshed row without a resize.
		sheet.textContent = `.resized > :first-child { flex-basis: 260px !important }
			.padded, .refreshed { scroll-padding-left: 20px }`
		classed.el.classList.add("padded")
		refreshed.z.refresh()
		await nextFrame()
		await nextFrame()
		for (const [row, target] of [
			[resized, 260],
			[classed, 180],
			[refreshed, 180],
		] as const) {
			row.z.scrollNext()
			await vi.waitFor(() => expect(row.el.scrollLeft).toBe(target))
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
		await drag(center(el), 0, { dy: -120, hold: 200 })
		await settled(z, el)
		expect(el.scrollTop).toBe(190)
		z.scrollNext()
		await vi.waitFor(() => expect(el.scrollTop).toBe(390))
	})

	it("snaps both axes independently and glides there together", async () => {
		const { el, z } = mount({
			layout: "both",
			style: "scroll-snap-type:both mandatory;",
			// block start, inline center
			card: "scroll-snap-align:start center;",
		})
		await drag(center(el), -130, { dy: -130, hold: 200 })
		await settled(z, el)
		// x centers a 200px cell in a 300px port: 0 (clamped), 150, 350, …; y aligns starts: 0, 200, …
		expect(el.scrollLeft).toBe(150)
		expect(el.scrollTop).toBe(200)
		z.scrollNext("x")
		await vi.waitFor(() => expect(el.scrollLeft).toBe(350))
		expect(el.scrollTop).toBe(200)
	})
})

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
		// prev/next during a glide continue from its target, so an unclamped target would show here.
		z.scrollTo({ x: 99999 })
		z.scrollPrev()
		await vi.waitFor(() => expect(el.scrollLeft).toBe(MAX - 270))
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
		// The drag continues from where the glide was, instead of jumping back to the press position (50).
		expect(at).toBeGreaterThan(60)
		// Longer than the glide would have taken.
		await new Promise((resolve) => setTimeout(resolve, 700))
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

// A kanban board: an x board of three 200px columns in a 300px viewport (max x 300), each column a y
// container 300px tall holding ten 100px cards (max y 700).
function kanban() {
	const board = document.createElement("div")
	board.setAttribute("style", "display:flex;width:300px;height:300px;overflow-x:auto;scrollbar-width:none")
	document.body.append(board)
	const columns = Array.from({ length: 3 }, () => {
		const column = document.createElement("div")
		column.setAttribute(
			"style",
			"flex:0 0 200px;height:300px;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none",
		)
		column.innerHTML = Array.from(
			{ length: 10 },
			(_, i) => `<div style="flex:0 0 100px"><a href="#c${i}">card ${i}</a></div>`,
		).join("")
		board.append(column)
		return { el: column, z: createAxis(column, { axis: "y", momentum: false }) }
	})
	const outer = { el: board, z: createAxis(board, { axis: "x", momentum: false }) }
	cleanups.push(() => {
		outer.z.destroy()
		for (const column of columns) column.z.destroy()
		board.remove()
	})
	return { board: outer, column: columns[0]! }
}

describe("nested instances", () => {
	it("routes a drag by its direction and chains outwards at the edge", async () => {
		const { board, column } = kanban()
		// An x carousel in the first card of the first column: 200px wide, 500px of content.
		const card = column.el.firstElementChild!
		card.innerHTML = `<div style="display:flex;width:200px;height:100px;overflow-x:auto;scrollbar-width:none">${'<div style="flex:0 0 100px"></div>'.repeat(5)}</div>`
		const carousel = {
			el: card.firstElementChild as HTMLElement,
			z: createAxis(card.firstElementChild as HTMLElement),
		}
		cleanups.push(() => carousel.z.destroy())
		const onClick = vi.fn()
		carousel.el.addEventListener("click", onClick)

		// Vertical: neither the carousel nor the board drags y, so the column between them takes it.
		const start = center(carousel.el)
		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 5, start.y - 40, 10)
		expect(column.z.getState().isDragging).toBe(true)
		expect(carousel.z.getState().isDragging).toBe(false)
		expect(board.z.getState().isDragging).toBe(false)
		await commands.mouseUp()
		expect([carousel.el.scrollLeft, column.el.scrollTop, board.el.scrollLeft]).toEqual([0, 40, 0])

		// Right, with every x instance at its start: nothing scrolls, but the gesture is still not a click.
		await drag(center(carousel.el), 60, { hold: 200 })
		expect([carousel.el.scrollLeft, column.el.scrollTop, board.el.scrollLeft]).toEqual([0, 40, 0])
		expect(onClick).not.toHaveBeenCalled()

		// Left: the innermost instance that can scroll that way owns the drag.
		await drag(center(carousel.el), -50, { hold: 200 })
		expect([carousel.el.scrollLeft, board.el.scrollLeft]).toEqual([50, 0])

		// At its end, the carousel hands the drag on to the board.
		carousel.z.scrollTo({ x: 300 }, { animate: false })
		await drag(center(carousel.el), -60, { hold: 200 })
		expect([carousel.el.scrollLeft, board.el.scrollLeft]).toEqual([300, 60])
	})

	it("does not change hands in the middle of a drag", async () => {
		const { board, column } = kanban()
		const start = center(column.el)
		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x, start.y - 60, 6)
		await commands.mouseMove(start.x - 150, start.y - 60, 10)
		await commands.mouseUp()
		expect(column.el.scrollTop).toBe(60)
		expect(board.el.scrollLeft).toBe(0)
	})

	it("holds every pressed container while the pointer is outside them", async () => {
		// Safari autoscrolls the pressed column towards a pointer below the board, while the board owns the drag.
		const { board, column } = kanban()
		const start = center(column.el)
		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 60, start.y, 6)
		expect(board.z.getState().isDragging).toBe(true)
		await commands.mouseMove(start.x - 100, start.y + 200, 10)
		// Sampled every frame before paint: an undone autoscroll must never show.
		const seen = new Set<number>()
		const sample = () => {
			seen.add(column.el.scrollTop)
			frame = requestAnimationFrame(sample)
		}
		let frame = requestAnimationFrame(sample)
		await new Promise((resolve) => setTimeout(resolve, 300))
		cancelAnimationFrame(frame)
		expect([...seen]).toEqual([0])
		await nextFrame()
		expect([board.el.scrollLeft, board.el.scrollTop, column.el.scrollTop]).toEqual([100, 0, 0])
		await commands.mouseUp()
		await nextFrame()
		expect([board.el.scrollLeft, column.el.scrollTop]).toEqual([100, 0])
	})

	it("swallows exactly one click after a real drag", async () => {
		const { board } = kanban()
		// A link in the second column, so it stays in view after the board scrolls.
		const link = board.el.children[1]!.querySelector("a")!
		const onClick = vi.fn((event: MouseEvent) => event.preventDefault())
		document.addEventListener("click", onClick)
		cleanups.push(() => document.removeEventListener("click", onClick))
		await drag(center(link), -80)
		expect(board.el.scrollLeft).toBe(80)
		expect(onClick).toHaveBeenCalledTimes(0)
		await commands.mouseMove(center(link).x, center(link).y)
		await commands.mouseDown()
		await commands.mouseUp()
		expect(onClick).toHaveBeenCalledTimes(1)
	})
})

describe("holding scroll positions", () => {
	const click = async (point: { x: number; y: number }, ms: number) => {
		await commands.mouseMove(point.x, point.y)
		await commands.mouseDown()
		await new Promise((resolve) => setTimeout(resolve, ms))
		await commands.mouseUp()
	}

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
		// A block container, where browsers anchor: content added above keeps the visible content in place.
		const el = document.createElement("div")
		el.setAttribute("style", "width:100px;height:300px;overflow-y:auto;scrollbar-width:none")
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
		const added = document.createElement("div")
		added.style.height = "200px"
		el.prepend(added)
		await nextFrame()
		await nextFrame()
		await commands.mouseUp()
		await nextFrame()
		expect(el.scrollTop).toBe(600)
	})

	it("forgets a press released over an iframe", async () => {
		// The window never sees that pointerup. Moving back with no button down must not drag.
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
		await commands.mouseUp()
		await commands.mouseMove(x - 120, top - 30, 10)
		expect(z.getState().isDragging).toBe(false)
		expect(el.scrollLeft).toBe(0)
		el.scrollLeft = 200
		await nextFrame()
		expect(el.scrollLeft).toBe(200)
	})

	it("ends a drag released over an iframe", async () => {
		// No momentum: Playwright's moves come within a few ms in WebKit, so the release would fling.
		const { el, z } = mount({ options: { momentum: false } })
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
		// Neither the drag nor its hold is still there.
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX: 20 }))
		expect(el.scrollLeft).toBe(50)
		el.scrollLeft = 300
		await nextFrame()
		expect(el.scrollLeft).toBe(300)
	})

	// Synthetic drags, by default on the first kanban column: (150, 200) is inside it. A press must land inside
	// the target's padding box, or it counts as a press on its scrollbar.
	const press = (target: HTMLElement, { x, y } = { x: 150, y: 200 }) =>
		target.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0, clientX: x, clientY: y }))
	const moveTo = (clientX: number, clientY: number) =>
		window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX, clientY }))
	const release = () => window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))

	it("undoes a last autoscroll on the instances that did not own the drag", () => {
		const { board, column } = kanban()
		press(column.el)
		moveTo(100, 200)
		expect(board.z.getState().isDragging).toBe(true)
		// A Safari autoscroll of the held column, with the release coming before the scroll event.
		column.el.scrollTop = 50
		release()
		expect(column.el.scrollTop).toBe(0)
	})

	// An x row with momentum whose second card holds a y column: a vertical drag on the column leaves the row
	// out. `visible` is a point on the part of the column the row shows, where a real press could land.
	const rowWithColumn = () => {
		const row = mount({
			inner: (i) =>
				i === 1
					? `<div style="height:100px;overflow-y:auto;scrollbar-width:none">${'<div style="height:100px"></div>'.repeat(5)}</div>`
					: `${i}`,
		})
		const el = row.el.querySelector<HTMLElement>(".card > div")!
		const column = { el, z: createAxis(el, { axis: "y", momentum: false }) }
		cleanups.push(() => column.z.destroy())
		const visible = () => {
			const outer = row.el.getBoundingClientRect()
			const inner = el.getBoundingClientRect()
			const x = (Math.max(outer.left, inner.left) + Math.min(outer.right, inner.right)) / 2
			return { x, y: inner.top + inner.height / 2 }
		}
		return { row, column, visible }
	}

	it("freezes the momentum of an outer instance and holds it while an inner one owns the drag", async () => {
		const { row, column, visible } = rowWithColumn()
		// A horizontal fling on the column, which the row takes.
		await drag({ x: 250, y: 50 }, -100, { steps: 5 })
		await vi.waitFor(() => expect(row.z.getState().isMomentum).toBe(true))
		const at = visible()
		press(column.el, at)
		expect(row.z.getState().isMomentum).toBe(false)
		moveTo(at.x, at.y - 40)
		expect(column.z.getState().isDragging).toBe(true)
		const held = row.el.scrollLeft
		row.el.scrollLeft = held + 40
		await nextFrame()
		await nextFrame()
		expect(row.el.scrollLeft).toBe(held)
		release()
		await settled(row.z, row.el)
		expect(row.el.scrollLeft).toBe(held)
	})

	it("lets an outer instance's scrollTo glide run through a drag it does not own", async () => {
		const { row, column, visible } = rowWithColumn()
		row.z.scrollTo({ x: 600 })
		const at = visible()
		press(column.el, at)
		moveTo(at.x, at.y - 40)
		expect(column.z.getState().isDragging).toBe(true)
		release()
		await vi.waitFor(() => expect(row.el.scrollLeft).toBe(600))
	})

	it("reports an outer instance's glide while an inner one owns the drag", async () => {
		const { row, column, visible } = rowWithColumn()
		const reported: number[] = []
		row.z.subscribe((state) => reported.push(state.x.scroll))
		row.z.scrollTo({ x: 400 })
		await nextFrame()
		const at = visible()
		press(column.el, at)
		moveTo(at.x, at.y - 40)
		expect(column.z.getState().isDragging).toBe(true)
		// Nothing holds the gliding row back, so its state follows the glide to the end.
		await vi.waitFor(() => expect(row.z.getState().x.scroll).toBe(400))
		expect(row.el.scrollLeft).toBe(400)
		expect(new Set(reported).size).toBeGreaterThan(3)
		release()
	})

	it("holds an outer instance where its glide ended, until the drag ends", async () => {
		const { row, column, visible } = rowWithColumn()
		row.z.scrollTo({ x: 400 })
		await nextFrame()
		const at = visible()
		press(column.el, at)
		moveTo(at.x, at.y - 40)
		await vi.waitFor(() => expect(row.z.getState().x.scroll).toBe(400))
		await settled(row.z, row.el)
		// A Safari autoscroll of the row after its glide ended, while the column is still dragged.
		row.el.scrollLeft = 700
		await nextFrame()
		await nextFrame()
		expect(row.el.scrollLeft).toBe(400)
		release()
		await nextFrame()
		expect(row.el.scrollLeft).toBe(400)
	})

	it("skips an instance a listener destroyed while the drag ended", () => {
		// Fake instances straight on the coordinator, so every call it makes is visible.
		const outer = document.createElement("div")
		const inner = document.createElement("div")
		outer.append(inner)
		document.body.append(outer)
		const fake = (el: HTMLElement) => ({
			el,
			onScrollbar: () => false,
			accepts: () => true,
			canScroll: () => true,
			press: vi.fn(),
			yield: vi.fn(),
			start: vi.fn(),
			move: vi.fn(),
			pass: vi.fn(),
			end: vi.fn(),
			interrupt: vi.fn(),
		})
		const owner = fake(inner)
		const other = fake(outer)
		const unregisterOther = register(other)
		const unregisterOwner = register(owner)
		cleanups.push(() => {
			unregisterOwner()
			unregisterOther()
			outer.remove()
		})
		// Ending the drag notifies the owner's listeners, and one of them destroys the outer instance.
		owner.end.mockImplementation(() => unregisterOther())
		press(inner)
		moveTo(100, 200)
		expect(owner.start).toHaveBeenCalled()
		release()
		expect(owner.end).toHaveBeenCalled()
		expect(other.pass).not.toHaveBeenCalled()
	})

	it.each([
		["wheel", () => document.body.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))],
		[
			"ArrowRight",
			() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
		],
	])("lets go of every hold on %s outside the instances", async (_, input) => {
		const { board, column } = kanban()
		press(column.el)
		moveTo(100, 200)
		expect(board.z.getState().isDragging).toBe(true)
		input()
		column.el.scrollTop = 30
		await nextFrame()
		expect(column.el.scrollTop).toBe(30)
		release()
	})
})

describe("keys that do not scroll", () => {
	it("keep the holds: modifiers, and Space in a text field", async () => {
		const { board, column } = kanban()
		const field = document.createElement("input")
		document.body.append(field)
		cleanups.push(() => field.remove())
		column.el.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				pointerId: 7,
				pointerType: "mouse",
				clientX: 150,
				clientY: 200,
			}),
		)
		window.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerId: 7,
				pointerType: "mouse",
				buttons: 1,
				clientX: 100,
				clientY: 200,
			}),
		)
		expect(board.z.getState().isDragging).toBe(true)
		document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }))
		field.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
		column.el.scrollTop = 30
		await nextFrame()
		expect(column.el.scrollTop).toBe(0)
		window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "mouse" }))
	})
})

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
		const listener = vi.fn()
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
		// A 0×0 child that only adds a flex gap.
		const empty = document.createElement("div")
		empty.style.height = "0"
		el.append(empty)
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(maxScroll + 10))
		// A child's margin, which changes no box size at all.
		;(el.firstElementChild as HTMLElement).style.marginLeft = "50px"
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
		// setOptions writes the cursor style between the two mutations, which defers the removal record.
		child.remove()
		z.setOptions({ cursor: false })
		el.append(child)
		await nextFrame()
		await nextFrame()
		// Only the resize observer on the child can see this.
		sheet.textContent = ".grows { flex-basis: 600px !important }"
		await vi.waitFor(() => expect(z.getState().x.maxScroll).toBe(MAX + 400))
	})

	it("leaves the cursor alone with cursor: false", () => {
		const { el } = mount({ options: { cursor: false } })
		expect(el.style.cursor).toBe("")
	})
})

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
			// Let the first resize observations come and go, so nothing but the flip itself can tell.
			await nextFrame()
			await nextFrame()
			flip(el)
			el.scrollLeft = -500
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

describe("destroy", () => {
	it("restores inline styles mid-drag and removes every listener", async () => {
		const style = "scroll-snap-type:x mandatory;cursor:pointer;"
		const { el, z } = mount({ style, card: "scroll-snap-align:start;" })
		const reference = document.createElement("div")
		reference.setAttribute("style", el.getAttribute("style")!.replace("cursor: grab", "cursor: pointer"))
		const listener = vi.fn()
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
		const onClick = vi.fn()
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
