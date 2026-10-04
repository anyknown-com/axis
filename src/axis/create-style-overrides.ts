import type { StyleOverrides } from "./types"

export function createStyleOverrides(
	el: HTMLElement,
	observer: MutationObserver,
	onMutations: (records: MutationRecord[]) => void,
): StyleOverrides {
	const saved = new Map<string, [value: string, priority: string]>()

	const writeUnobserved = (write: () => void) => {
		const pendingRecords = observer.takeRecords()

		write()
		observer.takeRecords()

		if (pendingRecords.length > 0) queueMicrotask(() => onMutations(pendingRecords))
	}

	const override = (prop: string, value: string, important = false) => {
		if (!saved.has(prop)) {
			saved.set(prop, [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)])
		} else if (el.style.getPropertyValue(prop) === value) return

		writeUnobserved(() => el.style.setProperty(prop, value, important ? "important" : ""))
	}

	const restore = (prop: string) => {
		const original = saved.get(prop)

		if (!original) return

		saved.delete(prop)

		writeUnobserved(() => {
			if (original[0]) el.style.setProperty(prop, original[0], original[1])
			else el.style.removeProperty(prop)
		})
	}

	const restoreAll = () => {
		for (const prop of saved.keys()) restore(prop)
	}

	return { override, restore, restoreAll }
}
