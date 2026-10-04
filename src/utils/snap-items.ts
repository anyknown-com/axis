import { cssLengthToPx } from "./css-length-to-px"
import { parseSnapAlign } from "./parse-snap-align"
import type { SnapItem } from "./types"

export function snapItems(win: Window, el: Element): Record<"x" | "y", SnapItem[]> {
	const items: Record<"x" | "y", SnapItem[]> = { x: [], y: [] }

	for (const child of el.children) {
		const childStyle = win.getComputedStyle(child)
		const align = parseSnapAlign(childStyle.scrollSnapAlign)

		if (align.x === "none" && align.y === "none") continue

		const box = child.getBoundingClientRect()
		const margin = (side: string) => cssLengthToPx(childStyle.getPropertyValue(`scroll-margin-${side}`), 0)
		const left = margin("left")
		const top = margin("top")

		items.x.push({ start: box.left - left, size: box.width + left + margin("right"), align: align.x })
		items.y.push({ start: box.top - top, size: box.height + top + margin("bottom"), align: align.y })
	}

	return items
}
