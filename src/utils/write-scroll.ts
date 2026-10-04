import { toPhysical } from "./to-physical"
import type { Vector } from "./types"

export function writeScroll(el: Element, position: Partial<Vector>, rtl: boolean) {
	if (position.x !== undefined) el.scrollLeft = toPhysical(position.x, rtl)
	if (position.y !== undefined) el.scrollTop = position.y
}
