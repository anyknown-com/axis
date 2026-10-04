import { clamp } from "./clamp"
import { toLogical } from "./to-logical"
import type { Vector } from "./types"

export const readScroll = (el: Element, rtl: boolean, max: Vector): Vector => ({
	x: clamp(toLogical(el.scrollLeft, rtl), 0, max.x),
	y: clamp(el.scrollTop, 0, max.y),
})
