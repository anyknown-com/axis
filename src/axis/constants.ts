import type { Vector } from "../utils"
import type { AxisOptions, AxisScrollState, AxisState } from "./types"

export const AXES = ["x", "y"] as const
export const EDGE = 1
export const WHEEL_SETTLE_MS = 150
export const DRAGGING_ATTR = "data-axis-dragging"
export const ZERO: Vector = { x: 0, y: 0 }
export const MAX_FRAME_MS = 64
export const PAGE_FRACTION = 0.9

export const EMPTY_AXIS: AxisState = {
	scroll: 0,
	maxScroll: 0,
	progress: 0,
	canScrollPrev: false,
	canScrollNext: false,
}

export const INITIAL_STATE: AxisScrollState = {
	x: EMPTY_AXIS,
	y: EMPTY_AXIS,
	isDragging: false,
	isMomentum: false,
}

export const DEFAULTS: Required<AxisOptions> = { axis: "x", momentum: true, wheel: false, cursor: true }
