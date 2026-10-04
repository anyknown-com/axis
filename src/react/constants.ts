import type { AxisScrollState } from "../axis"

const EMPTY_AXIS = { scroll: 0, maxScroll: 0, progress: 0, canScrollPrev: false, canScrollNext: false }

export const EMPTY_STATE: AxisScrollState = {
	x: EMPTY_AXIS,
	y: EMPTY_AXIS,
	isDragging: false,
	isMomentum: false,
}

export const NOOP = () => {}
