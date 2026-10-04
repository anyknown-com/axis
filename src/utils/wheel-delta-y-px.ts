import { LINE_HEIGHT } from "./constants"

export function wheelDeltaYPx(event: WheelEvent, pagePx: number) {
	const unitPx = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? pagePx : 1

	return event.deltaY * unitPx
}
