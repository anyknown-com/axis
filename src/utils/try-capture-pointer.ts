export function tryCapturePointer(el: Element, pointerId: number) {
	try {
		el.setPointerCapture(pointerId)
	} catch {}
}
