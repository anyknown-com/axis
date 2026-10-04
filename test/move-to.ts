import { pointer } from "./pointer"

export const moveTo = (clientX: number, clientY: number) =>
	window.dispatchEvent(pointer("pointermove", { pointerType: "mouse", buttons: 1, clientX, clientY }))
