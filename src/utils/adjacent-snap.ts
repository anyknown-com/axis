export function adjacentSnap(
	positions: readonly number[],
	current: number,
	direction: 1 | -1,
): number | undefined {
	if (direction === 1) return positions.find((position) => position > current + 1)

	for (let i = positions.length - 1; i >= 0; i--) if (positions[i]! < current - 1) return positions[i]

	return undefined
}
