import { act, StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import { useAxis, type AxisApi, type AxisScrollState } from "./react"

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
const cleanups: (() => void)[] = []

afterEach(() => {
	while (cleanups.length > 0) cleanups.pop()!()
	host.remove()
})

function render(element: React.ReactNode) {
	host = document.createElement("div")
	document.body.append(host)
	const root = createRoot(host)
	act(() => root.render(element))
	return root
}

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

// Every instance owns exactly one ResizeObserver, so live observers count live instances.
function trackInstances() {
	const Original = window.ResizeObserver
	const live = new Set<ResizeObserver>()
	let created = 0
	window.ResizeObserver = class extends Original {
		constructor(callback: ResizeObserverCallback) {
			super(callback)
			created++
			live.add(this)
		}
		override disconnect() {
			live.delete(this)
			super.disconnect()
		}
	}
	cleanups.push(() => (window.ResizeObserver = Original))
	return { created: () => created, live: () => live.size }
}

/** A 300px row of five 200px cards (max scroll 700). */
function Row(props: React.ComponentProps<"div">) {
	return (
		<div style={{ display: "flex", width: 300, overflowX: "auto", scrollbarWidth: "none" }} {...props}>
			{Array.from({ length: 5 }, (_, i) => (
				<div key={i} style={{ flex: "0 0 200px", height: 50 }} />
			))}
		</div>
	)
}

/** Binds one axis instance to the first or the second of two rows. */
function Switch({ second }: { second: boolean }) {
	const { ref } = useAxis<HTMLDivElement>()
	return (
		<>
			<Row ref={second ? undefined : ref} />
			<Row ref={second ? ref : undefined} />
		</>
	)
}

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
		// The selected type is inferred.
		const value: boolean = state
		useEffect(() => {
			canScrollNext = value
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
	// 10 frames of native scrolling, ending at the end edge.
	for (let i = 1; i <= 10; i++) {
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

it("applies option changes in place and keeps ref and api stable", () => {
	const instances = trackInstances()
	const seen = new Set<unknown>()
	function List({ cursor }: { cursor: boolean }) {
		const { ref, api } = useAxis<HTMLDivElement>({ cursor, axis: cursor ? "x" : "both" })
		useEffect(() => {
			seen.add(ref).add(api)
		})
		return <Row ref={ref} />
	}
	const root = render(<List cursor />)
	const el = host.firstElementChild as HTMLDivElement
	act(() => root.render(<List cursor={false} />))
	expect(el.style.cursor).toBe("")
	act(() => root.render(<List cursor />))
	expect(el.style.cursor).toBe("grab")
	expect(instances.created()).toBe(1)
	expect(seen.size).toBe(2)
	act(() => root.unmount())
	expect(instances.live()).toBe(0)
})

it("moves to a new element when the ref is attached elsewhere", () => {
	const instances = trackInstances()
	const root = render(<Switch second={false} />)
	const [first, second] = host.children as unknown as [HTMLDivElement, HTMLDivElement]
	expect([first.style.cursor, second.style.cursor]).toEqual(["grab", ""])
	act(() => root.render(<Switch second />))
	expect([first.style.cursor, second.style.cursor]).toEqual(["", "grab"])
	expect(instances.created()).toBe(2)
	expect(instances.live()).toBe(1)
	act(() => root.unmount())
	expect(instances.live()).toBe(0)
})

it("leaves exactly one instance behind after StrictMode's double mount", async () => {
	const instances = trackInstances()
	// Scroll listeners per target, so React's own listeners on the root container are not counted.
	const scroll = new Map<EventTarget, number>()
	const count = (target: EventTarget, delta: number) => scroll.set(target, (scroll.get(target) ?? 0) + delta)
	const add = EventTarget.prototype.addEventListener
	const remove = EventTarget.prototype.removeEventListener
	vi.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(function (
		this: EventTarget,
		...args
	) {
		if (args[0] === "scroll") count(this, 1)
		return add.apply(this, args)
	})
	vi.spyOn(EventTarget.prototype, "removeEventListener").mockImplementation(function (
		this: EventTarget,
		...args
	) {
		if (args[0] === "scroll") count(this, -1)
		return remove.apply(this, args)
	})
	cleanups.push(() => vi.restoreAllMocks())
	let latest: AxisScrollState | undefined
	function List() {
		const { ref, state } = useAxis<HTMLDivElement>()
		useEffect(() => {
			latest = state
		})
		return <Row ref={ref} />
	}
	const root = render(
		<StrictMode>
			<List />
		</StrictMode>,
	)
	const el = host.firstElementChild as HTMLDivElement
	expect(instances.live()).toBe(1)
	expect(scroll.get(el)).toBe(1)
	await act(async () => {
		el.scrollLeft = 100
		await vi.waitFor(() => expect(latest!.x.scroll).toBe(100))
	})
	act(() => root.unmount())
	expect(instances.live()).toBe(0)
	expect(scroll.get(el)).toBe(0)
})
