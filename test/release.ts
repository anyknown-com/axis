import { pointer } from "./pointer"

export const release = () =>
	window.dispatchEvent(pointer("pointerup", { pointerType: "mouse", clientX: 100 }))
