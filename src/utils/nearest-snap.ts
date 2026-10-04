export function nearestSnap(positions: readonly number[], target: number): number {
	let best = target
	let bestDistance = Infinity

	for (const position of positions) {
		const distance = Math.abs(position - target)

		if (distance < bestDistance) {
			best = position
			bestDistance = distance
		}
	}

	return best
}
