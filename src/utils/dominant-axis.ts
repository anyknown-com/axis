import type { Vector } from "./types"

export function dominantAxis(delta: Vector): "x" | "y" {
	return Math.abs(delta.x) >= Math.abs(delta.y) ? "x" : "y"
}
