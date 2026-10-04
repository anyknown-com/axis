import type { Vector } from "../utils"
import type { Hold } from "./types"

export function createHold(el: HTMLElement): Hold {
	let held: Vector | null = null
	let yielded = false

	const holdCurrent = () => {
		held = { x: el.scrollLeft, y: el.scrollTop }
	}

	return {
		holdCurrent,
		release() {
			held = null
		},
		reset() {
			held = null
			yielded = false
		},
		yieldDrag(glideHoldsAtItsEnd) {
			yielded = true

			if (!glideHoldsAtItsEnd) holdCurrent()
		},
		holdIfYielded() {
			if (yielded) holdCurrent()
		},
		follow(axis) {
			if (held) held[axis] = axis === "x" ? el.scrollLeft : el.scrollTop
		},
		undoAutoscroll() {
			if (!held) return
			if (Math.abs(el.scrollLeft - held.x) >= 1) el.scrollLeft = held.x
			if (Math.abs(el.scrollTop - held.y) >= 1) el.scrollTop = held.y
		},
	}
}
