import { act, useEffect } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { host, render } from "../../test/render"
import { Row } from "../../test/row"
import { useAxis, type AxisApi, type AxisScrollState } from "./index"

afterEach(() => {
	host.remove()
})

it("binds through a callback ref, tracks state and cleans up on unmount", async () => {
	let latest: { state: AxisScrollState; api: AxisApi } | undefined
	let renders = 0

	function List({ cursor }: { cursor: boolean }) {
		const { ref, state, api } = useAxis<HTMLDivElement>({ cursor })

		useEffect(() => {
			latest = { state, api }
			renders++
		})

		return (
			<div ref={ref} style={{ display: "flex", width: 300, overflowX: "auto" }}>
				{Array.from({ length: 5 }, (_, i) => (
					<div key={i} style={{ flex: "0 0 200px", height: 50 }} />
				))}
			</div>
		)
	}

	const root = render(<List cursor />)
	const el = host.firstElementChild as HTMLDivElement

	expect(latest!.state).toMatchObject({ x: { maxScroll: 700, canScrollNext: true, canScrollPrev: false } })
	expect(el.style.cursor).toBe("grab")

	const before = renders

	await act(async () => latest!.api.scrollTo({ x: 700 }, { animate: false }))
	await vi.waitFor(() => expect(latest!.state).toMatchObject({ x: { scroll: 700, canScrollNext: false } }))
	expect(renders).toBeGreaterThan(before)

	act(() => root.render(<List cursor={false} />))
	expect(el.style.cursor).toBe("")

	act(() => root.render(<List cursor />))
	expect(el.style.cursor).toBe("grab")
	act(() => root.unmount())
	expect(el.style.cursor).toBe("")
	expect(() => latest!.api.scrollNext()).not.toThrow()
})

it("survives an inline merged callback ref", () => {
	const mine: { current: HTMLDivElement | null } = { current: null }
	let latest: AxisScrollState | undefined

	function List() {
		const { ref, state } = useAxis<HTMLDivElement>()

		useEffect(() => {
			latest = state
		})

		return (
			<Row
				ref={(element) => {
					mine.current = element
					ref(element)
				}}
			/>
		)
	}

	const root = render(<List />)

	expect(mine.current).toBe(host.firstElementChild)
	expect(latest!.x.maxScroll).toBe(700)
	act(() => root.unmount())
})

it("re-renders with a selector only when the selected value changes", async () => {
	const commits = { all: 0, selected: 0 }
	let canScrollNext: boolean | undefined

	function Full() {
		const { ref } = useAxis<HTMLDivElement>()

		useEffect(() => {
			commits.all++
		})

		return <Row ref={ref} />
	}

	function Selected() {
		const { ref, state } = useAxis(undefined, (s) => s.x.canScrollNext)
		const inferredAsBoolean: boolean = state

		useEffect(() => {
			canScrollNext = inferredAsBoolean
			commits.selected++
		})

		return <Row ref={ref} />
	}

	render(
		<>
			<Full />
			<Selected />
		</>,
	)
	const [full, selected] = host.children as unknown as [HTMLDivElement, HTMLDivElement]

	expect(canScrollNext).toBe(true)
	const mounted = { ...commits }
	const nativeScrollFramesEndingAtTheEndEdge = 10

	for (let i = 1; i <= nativeScrollFramesEndingAtTheEndEdge; i++) {
		// oxlint-disable-next-line no-await-in-loop
		await act(async () => {
			full.scrollLeft = i * 70
			selected.scrollLeft = i * 70
			await new Promise((resolve) => requestAnimationFrame(resolve))
		})
	}

	await vi.waitFor(() => expect(canScrollNext).toBe(false))
	expect(commits.all - mounted.all).toBeGreaterThanOrEqual(10)
	expect(commits.selected - mounted.selected).toBe(1)
})
