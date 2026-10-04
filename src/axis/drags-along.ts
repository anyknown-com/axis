import type { AxisMode, AxisName } from "./types"

export const dragsAlong = (mode: AxisMode, axis: AxisName) => mode === "both" || mode === axis
