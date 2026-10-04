import type { AxisInstance, AxisScrollState } from "../axis"

/** Imperative scroll controls returned by {@link useAxis}. Safe to call before the element mounts (no-op). */
export type AxisApi = Pick<AxisInstance, "scrollPrev" | "scrollNext" | "scrollTo" | "refresh">

/** What {@link useAxis} returns. */
export interface UseAxisResult<T extends HTMLElement = HTMLElement, S = AxisScrollState> {
	/** Callback ref for the scroll container. Stable. */
	ref: (element: T | null) => void
	/** The scroll state of both axes, or what the selector picked from it. Re-renders only when it changes. */
	state: S
	/** Stable scroll controls. */
	api: AxisApi
}
