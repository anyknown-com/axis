import { type RefObject, useMemo } from "react"
import type { AxisInstance } from "../axis"
import type { AxisApi } from "./types"

export const useStableApi = (instanceRef: RefObject<AxisInstance | null>) =>
	useMemo<AxisApi>(
		() => ({
			scrollPrev: (target) => instanceRef.current?.scrollPrev(target),
			scrollNext: (target) => instanceRef.current?.scrollNext(target),
			scrollTo: (position, scrollOptions) => instanceRef.current?.scrollTo(position, scrollOptions),
			refresh: () => instanceRef.current?.refresh(),
		}),
		[instanceRef],
	)
