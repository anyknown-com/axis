import { pointer } from "./pointer"

const INSIDE_FIRST_KANBAN_COLUMN_PADDING_BOX = { x: 150, y: 200 }

export const press = (target: HTMLElement, { x, y } = INSIDE_FIRST_KANBAN_COLUMN_PADDING_BOX) =>
	target.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0, clientX: x, clientY: y }))
