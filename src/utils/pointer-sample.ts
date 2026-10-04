import type { Sample } from "./types"

export const pointerSample = (event: PointerEvent): Sample => ({
	t: event.timeStamp,
	x: event.clientX,
	y: event.clientY,
})
