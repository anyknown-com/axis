import { commands } from "vitest/browser"

export async function drag(
	from: { x: number; y: number },
	dx: number,
	{ dy = 0, steps = 10, holdStillBeforeRelease = 0 } = {},
) {
	await commands.mouseMove(from.x, from.y)
	await commands.mouseDown()
	await commands.mouseMove(from.x + dx, from.y + dy, steps)

	if (holdStillBeforeRelease) await new Promise((resolve) => setTimeout(resolve, holdStillBeforeRelease))

	await commands.mouseUp()
}
