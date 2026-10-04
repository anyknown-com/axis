import { attachWithControls } from "./attach"
import { cardImage } from "./card-image"
import { part, section } from "./demo"
import { fill } from "./fill"
import { instances } from "./instances"
import { kanbanColumns } from "./kanban-columns"
import { logClicks } from "./log-clicks"
import { scatteredCanvasCards } from "./scattered-canvas-cards"
import { toggle } from "./toggle"

const COUNT = 12

fill(part("plain", ".row"), COUNT, (i) => `<strong>Card ${i + 1}</strong><p>Plain content you can drag.</p>`)
attachWithControls(part("plain", ".row"), "x")

fill(part("snap", ".row"), COUNT, (i) => `<strong>Snap ${i + 1}</strong><p>Aligned to start.</p>`)
attachWithControls(part("snap", ".row"), "x")

fill(
	part("interactive", ".row"),
	COUNT,
	(i) =>
		`<img src="${cardImage(i)}" alt=""><a href="#card-${i + 1}">Link ${i + 1}</a> <button type="button">Button ${i + 1}</button><input placeholder="Type here" aria-label="Note ${i + 1}">`,
)

attachWithControls(part("interactive", ".row"), "x")
logClicks(section("interactive"), part("interactive", ".row"))

fill(part("rtl", ".row"), COUNT, (i) => `<strong>بطاقة ${i + 1}</strong><p>Card ${i + 1}</p>`)
attachWithControls(part("rtl", ".row"), "x")

fill(
	part("vertical", ".list"),
	20,
	(i) => `<strong>Row ${i + 1}</strong><p>Snaps to the top of the list.</p>`,
)
attachWithControls(part("vertical", ".list"), "y")

const canvas = part("canvas", ".canvas")

canvas.innerHTML = scatteredCanvasCards(60)
const canvasAxis = attachWithControls(part("canvas", ".viewport"), "both")

canvasAxis.scrollTo({ x: 1200, y: 1200 }, { animate: false })
logClicks(section("canvas"), canvas)

const board = part("kanban", ".board")

board.innerHTML = kanbanColumns(["Backlog", "Todo", "Doing", "Review", "Done"])
attachWithControls(board, "x")
for (const cards of board.querySelectorAll<HTMLElement>(".cards")) attachWithControls(cards, "y")

toggle("wheel", (wheel) => instances.forEach((z) => z.setOptions({ wheel })))
toggle("momentum", (momentum) => instances.forEach((z) => z.setOptions({ momentum })))
