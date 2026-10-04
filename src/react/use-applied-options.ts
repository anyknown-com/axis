import { type RefObject, useRef } from "react"
import type { AxisInstance, AxisOptions } from "../axis"
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect"

export function useAppliedOptions(options: AxisOptions, instanceRef: RefObject<AxisInstance | null>) {
	const optionsRef = useRef(options)
	const { axis, momentum, wheel, cursor } = options

	useIsomorphicLayoutEffect(() => {
		optionsRef.current = { axis, momentum, wheel, cursor }
		instanceRef.current?.setOptions(optionsRef.current)
	}, [axis, momentum, wheel, cursor])

	return optionsRef
}
