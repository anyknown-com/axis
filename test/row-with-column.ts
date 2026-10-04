import { createAxis } from "../src/axis"
import { cleanups } from "./cleanups"
import { mount } from "./mount"

const CARD_HOLDING_THE_COLUMN = 1

export const rowWithColumn = () => {
	const row = mount({
		inner: (i) =>
			i === CARD_HOLDING_THE_COLUMN
				? `<div style="height:100px;overflow-y:auto;scrollbar-width:none">${'<div style="height:100px"></div>'.repeat(5)}</div>`
				: `${i}`,
	})

	const el = row.el.querySelector<HTMLElement>(".card > div")!
	const column = { el, z: createAxis(el, { axis: "y", momentum: false }) }

	cleanups.push(() => column.z.destroy())

	const pressablePointOnColumn = () => {
		const outer = row.el.getBoundingClientRect()
		const inner = el.getBoundingClientRect()
		const x = (Math.max(outer.left, inner.left) + Math.min(outer.right, inner.right)) / 2

		return { x, y: inner.top + inner.height / 2 }
	}

	return { row, column, pressablePointOnColumn }
}
