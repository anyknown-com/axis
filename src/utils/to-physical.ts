export function toPhysical(logical: number, rtl: boolean): number {
	return rtl ? -logical : logical
}
