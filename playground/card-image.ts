export function cardImage(i: number) {
	const hue = (i * 37) % 360
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 60%)"/><stop offset="1" stop-color="hsl(${hue + 40} 70% 40%)"/></linearGradient></defs><rect width="220" height="90" fill="url(#g)"/></svg>`

	return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
