import { DEFAULTS } from "./constants"
import type { AxisOptions } from "./types"

export function mergeOptions(base: Required<AxisOptions>, patch: AxisOptions): Required<AxisOptions> {
	const next = { ...base }

	for (const key of Object.keys(DEFAULTS) as (keyof AxisOptions)[]) {
		if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key]
	}

	return next
}
