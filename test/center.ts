export function center(el: Element) {
	const rect = el.getBoundingClientRect()

	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
