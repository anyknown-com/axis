import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const src = (file: string) => fileURLToPath(new URL(`../src/${file}`, import.meta.url))

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	resolve: { alias: { "@anyknown/axis": src("index.ts") } },
	server: { port: 5210 },
	build: { outDir: "dist" },
})
