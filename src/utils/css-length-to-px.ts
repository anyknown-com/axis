export function cssLengthToPx(value: string, percentBasis: number) {
	const number = Number.parseFloat(value)

	if (Number.isNaN(number)) return 0

	return value.endsWith("%") ? (percentBasis * number) / 100 : number
}
