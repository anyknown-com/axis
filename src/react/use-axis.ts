import { useRef, useState } from "react"
import type { AxisInstance, AxisOptions, AxisScrollState } from "../axis"
import type { UseAxisResult } from "./types"
import { useAppliedOptions } from "./use-applied-options"
import { useAxisInstance } from "./use-axis-instance"
import { useSelectedState } from "./use-selected-state"
import { useStableApi } from "./use-stable-api"

/**
 * Binds axis to an element through a callback ref. The instance is created when the element mounts and
 * destroyed when it unmounts or changes. Option changes are applied without re-creating the instance.
 *
 * With a `selector`, `state` is `selector(state)` and the component re-renders only when that result changes
 * (compared with `Object.is`).
 */
export function useAxis<T extends HTMLElement = HTMLElement>(options?: AxisOptions): UseAxisResult<T>

export function useAxis<S>(
	options: AxisOptions | undefined,
	selector: (state: AxisScrollState) => S,
): UseAxisResult<HTMLElement, S>

export function useAxis(
	options: AxisOptions = {},
	selector?: (state: AxisScrollState) => unknown,
): UseAxisResult<HTMLElement, unknown> {
	const [element, setElement] = useState<HTMLElement | null>(null)
	const instanceRef = useRef<AxisInstance | null>(null)
	const optionsRef = useAppliedOptions(options, instanceRef)
	const instance = useAxisInstance(element, optionsRef, instanceRef)
	const state = useSelectedState(instance, selector)
	const api = useStableApi(instanceRef)

	return { ref: setElement, state, api }
}
