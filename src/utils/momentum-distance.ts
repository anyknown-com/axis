import { DECAY, FRAME_MS } from "./constants"

export function momentumDistance(velocity: number): number {
	return (velocity * FRAME_MS) / (1 - DECAY)
}
