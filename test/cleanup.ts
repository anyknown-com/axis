import { commands } from "vitest/browser"
import { cleanups } from "./cleanups"

export async function cleanup() {
	while (cleanups.length > 0) cleanups.pop()!()
	await commands.mouseUp()
	await commands.reducedMotion(false)
}
