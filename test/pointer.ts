export const pointer = (type: string, init: PointerEventInit) =>
	new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: 150, clientY: 50, ...init })
