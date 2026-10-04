// Runs in node, where there is no window: the server-rendering path of the hook.
import { renderToString } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { createAxis } from "./index"
import { useAxis } from "./react"

function List() {
	const { ref, state } = useAxis<HTMLDivElement>()
	const { state: canScrollNext } = useAxis(undefined, (s) => s.x.canScrollNext)
	return <div ref={ref} data-max={state.x.maxScroll} data-next={String(canScrollNext)} />
}

it("imports and renders without a window, with the empty state", () => {
	expect(typeof window).toBe("undefined")
	expect(typeof createAxis).toBe("function")
	const error = vi.spyOn(console, "error")
	const html = renderToString(<List />)
	expect(html).toBe('<div data-max="0" data-next="false"></div>')
	expect(error).not.toHaveBeenCalled()
})
