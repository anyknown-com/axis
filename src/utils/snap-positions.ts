import { clamp } from "./clamp"
import { toLogical } from "./to-logical"
import type { SnapAxis, SnapItem } from "./types"

export function snapPositions(axis: SnapAxis, items: readonly SnapItem[]): number[] {
	const { rtl } = axis
	const portLow = axis.start + axis.paddingStart
	const portHigh = axis.start + axis.size - axis.paddingEnd
	const positions: number[] = []

	for (const item of items) {
		if (item.align === "none") continue

		const high = item.start + item.size
		const alignsLowEdge = (item.align === "start") !== rtl

		const delta =
			item.align === "center"
				? (item.start + high) / 2 - (portLow + portHigh) / 2
				: alignsLowEdge
					? item.start - portLow
					: high - portHigh

		positions.push(clamp(toLogical(axis.scroll + delta, rtl), 0, axis.maxScroll))
	}

	positions.sort((a, b) => a - b)
	const unique: number[] = []

	for (const position of positions) {
		const previous = unique.at(-1)

		if (previous === undefined || position - previous > 1) unique.push(position)
	}

	return unique
}
