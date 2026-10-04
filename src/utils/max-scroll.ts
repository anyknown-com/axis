import type { Vector } from "./types"

export const maxScroll = (el: Element): Vector => ({
	x: Math.max(0, el.scrollWidth - el.clientWidth),
	y: Math.max(0, el.scrollHeight - el.clientHeight),
})
