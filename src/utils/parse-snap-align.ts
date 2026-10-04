import type { SnapAlign } from "./types"

const toAlign = (value: string | undefined): SnapAlign =>
	value === "start" || value === "center" || value === "end" ? value : "none"

export function parseSnapAlign(value: string): { x: SnapAlign; y: SnapAlign } {
	const [block, inline = block] = value.trim().split(/\s+/)

	return { x: toAlign(inline), y: toAlign(block) }
}
