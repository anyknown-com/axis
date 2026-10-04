import { type AxisInstance, type AxisMode, type AxisName, type AxisState, createAxis } from "@anyknown/axis"

const COUNT = 12
const instances: AxisInstance[] = []

const image = (i: number) => {
	const hue = (i * 37) % 360
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 60%)"/><stop offset="1" stop-color="hsl(${hue + 40} 70% 40%)"/></linearGradient></defs><rect width="220" height="90" fill="url(#g)"/></svg>`
	return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const fill = (container: HTMLElement, count: number, card: (i: number) => string) => {
	container.innerHTML = Array.from({ length: count }, (_, i) => `<div class="card">${card(i)}</div>`).join("")
}

const describeAxis = (name: AxisName, s: AxisState) =>
	`${name}: ${s.scroll.toFixed(0)} / ${s.maxScroll} · ${(s.progress * 100).toFixed(0)}% · prev ${s.canScrollPrev} · next ${s.canScrollNext}`

/** Creates an instance plus prev/next buttons for each draggable axis and a readout of both axes. */
function attach(container: HTMLElement, axis: AxisMode, after: Element = container) {
	const z = createAxis(container, { axis })
	instances.push(z)
	const controls = document.createElement("div")
	controls.className = "controls"
	const buttons: [AxisName, -1 | 1, HTMLButtonElement][] = []
	for (const name of axis === "both" ? (["x", "y"] as const) : [axis]) {
		for (const direction of [-1, 1] as const) {
			const button = document.createElement("button")
			button.type = "button"
			button.textContent = `${direction === -1 ? "Prev" : "Next"}${axis === "both" ? ` ${name}` : ""}`
			button.addEventListener("click", () => (direction === -1 ? z.scrollPrev(name) : z.scrollNext(name)))
			controls.append(button)
			buttons.push([name, direction, button])
		}
	}
	const readout = document.createElement("code")
	readout.className = "state"
	controls.append(readout)
	after.after(controls)

	const render = () => {
		const s = z.getState()
		for (const [name, direction, button] of buttons) {
			button.disabled = direction === -1 ? !s[name].canScrollPrev : !s[name].canScrollNext
		}
		const motion = s.isDragging ? "dragging" : s.isMomentum ? "momentum" : "idle"
		readout.textContent = `${describeAxis("x", s.x)}\n${describeAxis("y", s.y)}\n${motion}`
	}
	z.subscribe(render)
	render()
	return z
}

const logClicks = (section: HTMLElement, root: HTMLElement) => {
	const log = section.querySelector<HTMLOutputElement>(".log")!
	let clicks = 0
	root.addEventListener("click", (event) => {
		const target = (event.target as Element).closest("a, button")
		if (!target) return
		if (target instanceof HTMLAnchorElement) event.preventDefault()
		const label = target.querySelector("strong")?.textContent ?? target.textContent
		log.textContent = `#${++clicks} clicked: ${label}`
	})
}

const section = (demo: string) => document.querySelector<HTMLElement>(`[data-demo="${demo}"]`)!
const part = (demo: string, selector: string) => section(demo).querySelector<HTMLElement>(selector)!

fill(part("plain", ".row"), COUNT, (i) => `<strong>Card ${i + 1}</strong><p>Plain content you can drag.</p>`)
attach(part("plain", ".row"), "x")

fill(part("snap", ".row"), COUNT, (i) => `<strong>Snap ${i + 1}</strong><p>Aligned to start.</p>`)
attach(part("snap", ".row"), "x")

fill(
	part("interactive", ".row"),
	COUNT,
	(i) =>
		`<img src="${image(i)}" alt=""><a href="#card-${i + 1}">Link ${i + 1}</a> <button type="button">Button ${i + 1}</button><input placeholder="Type here" aria-label="Note ${i + 1}">`,
)
attach(part("interactive", ".row"), "x")
logClicks(section("interactive"), part("interactive", ".row"))

fill(part("rtl", ".row"), COUNT, (i) => `<strong>بطاقة ${i + 1}</strong><p>Card ${i + 1}</p>`)
attach(part("rtl", ".row"), "x")

fill(
	part("vertical", ".list"),
	20,
	(i) => `<strong>Row ${i + 1}</strong><p>Snaps to the top of the list.</p>`,
)
attach(part("vertical", ".list"), "y")

// Canvas: cards scattered over a 3000×3000 grid, placed deterministically.
const canvas = part("canvas", ".canvas")
canvas.innerHTML = Array.from({ length: 60 }, (_, i) => {
	const left = (i * 487) % 2780
	const top = (i * 733) % 2860
	return `<button type="button" class="card" style="left:${left}px;top:${top}px"><strong>Note ${i + 1}</strong><p>at ${left}, ${top}</p></button>`
}).join("")
const viewport = part("canvas", ".viewport")
const canvasAxis = attach(viewport, "both")
canvasAxis.scrollTo({ x: 1200, y: 1200 }, { animate: false })
logClicks(section("canvas"), canvas)

// Kanban: an x board of y columns.
const board = part("kanban", ".board")
const titles = ["Backlog", "Todo", "Doing", "Review", "Done"]
board.innerHTML = titles
	.map(
		(title, c) =>
			`<div class="column"><h3>${title}</h3><div class="cards">${Array.from(
				{ length: 6 + c * 2 },
				(_, i) => `<div class="card"><a href="#${title}-${i + 1}">${title} ${i + 1}</a></div>`,
			).join("")}</div></div>`,
	)
	.join("")
attach(board, "x")
for (const cards of board.querySelectorAll<HTMLElement>(".cards")) attach(cards, "y")

const toggle = (id: string, apply: (checked: boolean) => void) => {
	const input = document.querySelector<HTMLInputElement>(`#${id}`)!
	input.addEventListener("change", () => apply(input.checked))
}
toggle("wheel", (wheel) => instances.forEach((z) => z.setOptions({ wheel })))
toggle("momentum", (momentum) => instances.forEach((z) => z.setOptions({ momentum })))
