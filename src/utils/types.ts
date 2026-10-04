export interface Vector {
	x: number
	y: number
}

export interface Sample extends Vector {
	t: number
}

export type SnapAlign = "start" | "center" | "end" | "none"

export interface SnapAxis {
	start: number
	size: number
	paddingStart: number
	paddingEnd: number
	scroll: number
	maxScroll: number
	rtl: boolean
}

export interface SnapItem {
	start: number
	size: number
	align: SnapAlign
}
