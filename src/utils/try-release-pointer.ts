export function tryReleasePointer(el: Element, pointerId: number) {
	try {
		if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
	} catch {}
}
