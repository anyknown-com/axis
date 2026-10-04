export function isOnScrollbar(el: Element, event: MouseEvent) {
	const rect = el.getBoundingClientRect()
	const x = event.clientX - rect.left - el.clientLeft
	const y = event.clientY - rect.top - el.clientTop

	return x < 0 || y < 0 || x >= el.clientWidth || y >= el.clientHeight
}
