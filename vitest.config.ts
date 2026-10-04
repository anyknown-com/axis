import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { commands } from "./test/commands.ts"

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.test.ts"],
					exclude: ["src/**/*.browser.test.{ts,tsx}"],
				},
			},
			{
				test: { name: "ssr", environment: "node", include: ["src/**/*.ssr.test.tsx"] },
			},
			{
				// Pre-bundled up front: discovering them mid-run reloads the page and loads React twice.
				optimizeDeps: { include: ["react", "react/jsx-dev-runtime", "react-dom/client"] },
				test: {
					name: "browser",
					include: ["src/**/*.browser.test.{ts,tsx}"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({
							// Room for the tester iframe at scale 1: WebKit rounds mouse input to whole page pixels.
							contextOptions: { viewport: { width: 1280, height: 1000 } },
							// Headless Chromium hides scrollbars by default; the classic scrollbar test needs them.
							launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
						}),
						instances: [{ browser: "chromium" }, { browser: "webkit" }],
						screenshotFailures: false,
						commands,
					},
				},
			},
		],
	},
})
