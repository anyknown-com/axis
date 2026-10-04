import { act } from "react"
import { createRoot } from "react-dom/client"

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

export let host: HTMLDivElement

export function render(element: React.ReactNode) {
	host = document.createElement("div")
	document.body.append(host)
	const root = createRoot(host)

	act(() => root.render(element))

	return root
}
