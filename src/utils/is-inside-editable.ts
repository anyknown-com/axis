import { EDITABLE } from "./constants"

export const isInsideEditable = (target: EventTarget | null) =>
	!!(target as Element | null)?.closest?.(EDITABLE)
