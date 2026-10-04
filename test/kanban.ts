import { createAxis } from "../src/axis"
import { cleanups } from "./cleanups"

const BOARD_SIZE = 300
const COLUMN_COUNT = 3
const COLUMN_WIDTH = 200
const CARDS_PER_COLUMN = 10
const CARD_HEIGHT = 100

export function kanban() {
	const board = document.createElement("div")

	board.setAttribute(
		"style",
		`display:flex;width:${BOARD_SIZE}px;height:${BOARD_SIZE}px;overflow-x:auto;scrollbar-width:none`,
	)
	document.body.append(board)

	const columns = Array.from({ length: COLUMN_COUNT }, () => {
		const column = document.createElement("div")

		column.setAttribute(
			"style",
			`flex:0 0 ${COLUMN_WIDTH}px;height:${BOARD_SIZE}px;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none`,
		)
		column.innerHTML = Array.from(
			{ length: CARDS_PER_COLUMN },
			(_, i) => `<div style="flex:0 0 ${CARD_HEIGHT}px"><a href="#c${i}">card ${i}</a></div>`,
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
