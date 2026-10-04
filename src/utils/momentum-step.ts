import { DECAY, FRAME_MS } from "./constants"

export function momentumStep(velocity: number, dt: number): { distance: number; velocity: number } {
	return { distance: velocity * dt, velocity: velocity * DECAY ** (dt / FRAME_MS) }
}
