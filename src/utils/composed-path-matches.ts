export function composedPathMatches(path: readonly EventTarget[], selector: string, boundary: EventTarget) {
	for (const node of path) {
		if (node === boundary) return false
		if ((node as Node).nodeType === 1 && (node as Element).matches(selector)) return true
	}

	return false
}
