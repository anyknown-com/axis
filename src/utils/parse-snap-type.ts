export function parseSnapType(value: string): { x: boolean; y: boolean } {
	const axis = value.trim().split(/\s+/)[0]

	return {
		x: axis === "x" || axis === "both" || axis === "inline",
		y: axis === "y" || axis === "both" || axis === "block",
	}
}
