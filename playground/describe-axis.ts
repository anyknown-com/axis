import type { AxisName, AxisState } from "@anyknown/axis"

export const describeAxis = (name: AxisName, s: AxisState) =>
	`${name}: ${s.scroll.toFixed(0)} / ${s.maxScroll} · ${(s.progress * 100).toFixed(0)}% · prev ${s.canScrollPrev} · next ${s.canScrollNext}`
