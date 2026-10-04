export function toLogical(scrollLeft: number, rtl: boolean): number {
	return rtl ? -scrollLeft : scrollLeft
}
