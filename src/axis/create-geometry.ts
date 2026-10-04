import { isRtl, maxScroll, readScroll, writeScroll } from "../utils"
import type { Geometry } from "./types"

export function createGeometry(win: Window, el: HTMLElement): Geometry {
	const rtl = () => isRtl(win, el)
	const scrollRange = () => maxScroll(el)

	return {
		rtl,
		scrollRange,
		position: (isRtlNow = rtl(), range = scrollRange()) => readScroll(el, isRtlNow, range),
		writePosition: (position, isRtlNow = rtl()) => writeScroll(el, position, isRtlNow),
	}
}
