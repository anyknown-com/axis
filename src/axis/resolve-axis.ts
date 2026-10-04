import type { AxisMode, AxisName } from "./types"

export function resolveAxis(method: string, axis: AxisName | undefined, mode: AxisMode): AxisName {
	if (axis) return axis

	if (mode === "both") {
		throw new Error(`axis: ${method}() needs an axis ("x" or "y") when the instance uses axis: "both"`)
	}

	return mode
}
