import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { type AxisInstance, type AxisOptions, type AxisScrollState, createAxis } from "./axis"

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

const EMPTY_AXIS = { scroll: 0, maxScroll: 0, progress: 0, canScrollPrev: false, canScrollNext: false }
const EMPTY_STATE: AxisScrollState = { x: EMPTY_AXIS, y: EMPTY_AXIS, isDragging: false, isMomentum: false }

const noop = () => {}

// useLayoutEffect, without React 18's warning during server rendering (where effects never run anyway).
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

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
	const [instance, setInstance] = useState<AxisInstance | null>(null)
	const instanceRef = useRef<AxisInstance | null>(null)
	const optionsRef = useRef(options)

	// Declared before the instance effect, so a new instance is created with the options of the same render.
	const { axis, momentum, wheel, cursor } = options
	useIsomorphicLayoutEffect(() => {
		optionsRef.current = { axis, momentum, wheel, cursor }
		instanceRef.current?.setOptions(optionsRef.current)
	}, [axis, momentum, wheel, cursor])

	useIsomorphicLayoutEffect(() => {
		if (!element) return
		const created = createAxis(element, optionsRef.current)
		instanceRef.current = created
		setInstance(created)
		return () => {
			created.destroy()
			instanceRef.current = null
			setInstance(null)
		}
	}, [element])

	const subscribe = useCallback((listener: () => void) => instance?.subscribe(listener) ?? noop, [instance])
	// Memoised on the state object and the selector, so the snapshot is stable until either changes.
	const memo = useRef<{ state: AxisScrollState; selector: typeof selector; selected: unknown } | null>(null)
	const getSnapshot = useCallback(() => {
		const current = instance?.getState() ?? EMPTY_STATE
		if (memo.current?.state !== current || memo.current.selector !== selector) {
			memo.current = { state: current, selector, selected: selector ? selector(current) : current }
		}
		return memo.current.selected
	}, [instance, selector])
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	const api = useMemo<AxisApi>(
		() => ({
			scrollPrev: (target) => instanceRef.current?.scrollPrev(target),
			scrollNext: (target) => instanceRef.current?.scrollNext(target),
			scrollTo: (position, scrollOptions) => instanceRef.current?.scrollTo(position, scrollOptions),
			refresh: () => instanceRef.current?.refresh(),
		}),
		[],
	)

	return { ref: setElement, state, api }
}

export type {
	AxisMode,
	AxisName,
	AxisOptions,
	AxisPosition,
	AxisScrollState,
	AxisScrollToOptions,
	AxisState,
} from "./axis"
