import { type AxisMode, type AxisName, createAxis } from "@anyknown/axis"
import { describeAxis } from "./describe-axis"
import { instances } from "./instances"

export function attachWithControls(container: HTMLElement, axis: AxisMode, after: Element = container) {
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
