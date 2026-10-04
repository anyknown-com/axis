export const scatteredCanvasCards = (count: number) =>
	Array.from({ length: count }, (_, i) => {
		const left = (i * 487) % 2780
		const top = (i * 733) % 2860

		return `<button type="button" class="card" style="left:${left}px;top:${top}px"><strong>Note ${i + 1}</strong><p>at ${left}, ${top}</p></button>`
	}).join("")
