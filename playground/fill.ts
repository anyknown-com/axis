export function fill(container: HTMLElement, count: number, card: (i: number) => string) {
	container.innerHTML = Array.from({ length: count }, (_, i) => `<div class="card">${card(i)}</div>`).join("")
}
