import { EDITABLE } from "../utils"
import type { Coordinator } from "./types"

export const DRAG_THRESHOLD = 5
export const CLICK_SUPPRESS_MS = 100
export const NO_DRAG = `${EDITABLE}, [data-axis-no-drag]`
export const coordinators = new WeakMap<Window, Coordinator>()
