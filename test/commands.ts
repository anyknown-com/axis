import type { BrowserCommand, BrowserCommandContext } from "vitest/node"

async function toPage(context: BrowserCommandContext, x: number, y: number) {
	if (context.provider.name !== "playwright") throw new Error("mouse commands need the playwright provider")

	const box = await context.iframe.owner().boundingBox()

	if (!box) throw new Error("tester iframe is not visible")

	const width = await context.frame().then((frame) => frame.evaluate(() => window.innerWidth))
	const scale = box.width / width

	return { x: box.x + x * scale, y: box.y + y * scale }
}

const mouseMove: BrowserCommand<[x: number, y: number, steps?: number]> = async (
	context,
	x,
	y,
	steps = 1,
) => {
	const point = await toPage(context, x, y)

	await context.page.mouse.move(point.x, point.y, { steps })
}

const mouseDown: BrowserCommand<[]> = async (context) => {
	await context.page.mouse.down()
}

const mouseUp: BrowserCommand<[]> = async (context) => {
	await context.page.mouse.up()
}

const reducedMotion: BrowserCommand<[enabled: boolean]> = async (context, enabled) => {
	await context.page.emulateMedia({ reducedMotion: enabled ? "reduce" : "no-preference" })
}

export const commands = { mouseMove, mouseDown, mouseUp, reducedMotion }
