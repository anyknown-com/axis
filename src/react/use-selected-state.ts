import { useCallback, useRef, useSyncExternalStore } from "react"
import type { AxisInstance, AxisScrollState } from "../axis"
import { EMPTY_STATE, NOOP } from "./constants"

type Selector = ((state: AxisScrollState) => unknown) | undefined

export function useSelectedState(instance: AxisInstance | null, selector: Selector) {
	const subscribe = useCallback((listener: () => void) => instance?.subscribe(listener) ?? NOOP, [instance])
	const snapshotMemo = useRef<{ state: AxisScrollState; selector: Selector; selected: unknown } | null>(null)

	const getSnapshot = useCallback(() => {
		const current = instance?.getState() ?? EMPTY_STATE

		if (snapshotMemo.current?.state !== current || snapshotMemo.current.selector !== selector) {
			snapshotMemo.current = { state: current, selector, selected: selector ? selector(current) : current }
		}

		return snapshotMemo.current.selected
	}, [instance, selector])

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
