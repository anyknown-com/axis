import { dominantAxis, type Vector } from "../utils"
import type { DragClient } from "./types"

export function pickOwner(innermostFirst: readonly DragClient[], delta: Vector): DragClient | null {
	const axis = dominantAxis(delta)
	const dragsAlongAxis = innermostFirst.filter((client) => client.accepts(axis))
	const canStillScroll = dragsAlongAxis.find((client) => client.canScroll(delta))

	return canStillScroll ?? dragsAlongAxis[0] ?? null
}
