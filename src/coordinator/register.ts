import { coordinators } from "./constants"
import { createCoordinator } from "./create-coordinator"
import type { DragClient } from "./types"

export function register(client: DragClient): () => void {
	const win = client.el.ownerDocument.defaultView ?? window
	let coordinator = coordinators.get(win)

	if (!coordinator) {
		coordinator = createCoordinator(win)
		coordinators.set(win, coordinator)
	}

	return coordinator.add(client)
}
