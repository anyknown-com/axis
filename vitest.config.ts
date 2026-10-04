import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { commands } from "./test/commands.ts"

const prebundledToAvoidMidRunReloadLoadingReactTwice = ["react", "react/jsx-dev-runtime", "react-dom/client"]
const viewportFittingTesterIframeAtScaleOne = { width: 1280, height: 1000 }
const keepScrollbarsForClassicScrollbarTest = { ignoreDefaultArgs: ["--hide-scrollbars"] }

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
				optimizeDeps: { include: prebundledToAvoidMidRunReloadLoadingReactTwice },
				test: {
					name: "browser",
					include: ["src/**/*.browser.test.{ts,tsx}"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({
							contextOptions: { viewport: viewportFittingTesterIframeAtScaleOne },
							launchOptions: keepScrollbarsForClassicScrollbarTest,
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
