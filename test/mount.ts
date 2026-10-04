import { type AxisOptions, createAxis } from "../src/axis"
import { cleanups } from "./cleanups"
import { LAYOUTS } from "./layouts"

export function mount({
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
