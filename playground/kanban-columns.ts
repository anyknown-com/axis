export const kanbanColumns = (titles: readonly string[]) =>
	titles
		.map(
			(title, c) =>
				`<div class="column"><h3>${title}</h3><div class="cards">${Array.from(
					{ length: 6 + c * 2 },
					(_, i) => `<div class="card"><a href="#${title}-${i + 1}">${title} ${i + 1}</a></div>`,
				).join("")}</div></div>`,
		)
		.join("")
