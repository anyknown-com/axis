import { vi } from "vitest"
import type { AxisInstance } from "../src/axis"

export const settled = (z: AxisInstance, el: HTMLElement) =>
	vi.waitFor(
		() => {
			const { isDragging, isMomentum } = z.getState()

			const snapTypeStillOverriddenImportant =
				el.style.getPropertyPriority("scroll-snap-type") === "important"

			if (isDragging || isMomentum || snapTypeStillOverriddenImportant) {
				throw new Error("still moving")
			}
		},
		{ timeout: 4000 },
	)
