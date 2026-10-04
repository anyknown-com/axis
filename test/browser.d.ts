import "vitest/browser"

declare module "vitest/browser" {
	interface BrowserCommands {
		mouseMove(x: number, y: number, steps?: number): Promise<void>
		mouseDown(): Promise<void>
		mouseUp(): Promise<void>
		reducedMotion(enabled: boolean): Promise<void>
	}
}
