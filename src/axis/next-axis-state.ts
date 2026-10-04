import { EDGE } from "./constants"
import type { AxisState } from "./types"

export function nextAxisState(scroll: number, max: number, previous: AxisState): AxisState {
	const next: AxisState = {
		scroll,
		maxScroll: max,
		progress: max > 0 ? scroll / max : 0,
		canScrollPrev: scroll > EDGE,
		canScrollNext: scroll < max - EDGE,
	}

	for (const key of Object.keys(next) as (keyof AxisState)[]) if (next[key] !== previous[key]) return next

	return previous
}
