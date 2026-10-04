import { SCROLL_KEYS } from "./constants"
import { isInsideEditable } from "./is-inside-editable"

export function isScrollKey(event: KeyboardEvent): boolean {
	if (!SCROLL_KEYS.has(event.key)) return false

	return !isInsideEditable(event.target)
}
