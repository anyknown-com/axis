import { cssLengthToPx } from "./css-length-to-px"
import { maxScroll } from "./max-scroll"
import { snapItems } from "./snap-items"
import { snapPositions } from "./snap-positions"

export function measureSnaps(win: Window, el: Element): Record<"x" | "y", number[]> {
	const style = win.getComputedStyle(el)
	const rect = el.getBoundingClientRect()
	const max = maxScroll(el)
	const items = snapItems(win, el)

	const padding = (side: string, basis: number) =>
		cssLengthToPx(style.getPropertyValue(`scroll-padding-${side}`), basis)

	return {
		x: snapPositions(
			{
				start: rect.left + el.clientLeft,
				size: el.clientWidth,
				paddingStart: padding("left", el.clientWidth),
				paddingEnd: padding("right", el.clientWidth),
				scroll: el.scrollLeft,
				maxScroll: max.x,
				rtl: style.direction === "rtl",
			},
			items.x,
		),
		y: snapPositions(
			{
				start: rect.top + el.clientTop,
				size: el.clientHeight,
				paddingStart: padding("top", el.clientHeight),
				paddingEnd: padding("bottom", el.clientHeight),
				scroll: el.scrollTop,
				maxScroll: max.y,
				rtl: false,
			},
			items.y,
		),
	}
}
