import { type RefObject, useState } from "react"
import { type AxisInstance, type AxisOptions, createAxis } from "../axis"
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect"

export function useAxisInstance(
	element: HTMLElement | null,
	optionsRef: RefObject<AxisOptions>,
	instanceRef: RefObject<AxisInstance | null>,
) {
	const [instance, setInstance] = useState<AxisInstance | null>(null)

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

	return instance
}
