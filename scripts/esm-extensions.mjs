import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const RESOLVED = /\.(js|mjs|cjs|json|css)$/

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) yield* walk(path)
		else yield path
	}
}

for await (const file of walk("dist")) {
	if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue
	const source = await readFile(file, "utf8")
	const next = source.replace(SPECIFIER, (match, keyword, quote, specifier) =>
		RESOLVED.test(specifier) ? match : `${keyword}${quote}${specifier}.js${quote}`,
	)
	if (next !== source) await writeFile(file, next)
}
