import { parseSnapType } from "../utils"
import type { SnapSuspension, StyleOverrides } from "./types"

export function createSnapSuspension(win: Window, el: HTMLElement, styles: StyleOverrides): SnapSuspension {
	const { override, restore } = styles
	let suspendedSnapType: string | null = null

	return {
		suspend() {
			if (suspendedSnapType !== null) return

			suspendedSnapType = win.getComputedStyle(el).scrollSnapType
			override("scroll-snap-type", "none", true)
			override("scroll-behavior", "auto", true)
		},
		resume() {
			if (suspendedSnapType === null) return

			suspendedSnapType = null
			restore("scroll-snap-type")
			restore("scroll-behavior")
		},
		snapAxes: () => parseSnapType(suspendedSnapType ?? win.getComputedStyle(el).scrollSnapType),
		isSuspended: () => suspendedSnapType !== null,
	}
}
