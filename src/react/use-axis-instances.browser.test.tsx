import { act, StrictMode, useEffect } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { host, render } from "../../test/render"
import { Row } from "../../test/row"
import { useAxis, type AxisScrollState } from "./index"

const cleanups: (() => void)[] = []

afterEach(() => {
	while (cleanups.length > 0) cleanups.pop()!()
	host.remove()
})

function countInstancesByTheirOneResizeObserver() {
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

function OneInstanceOnFirstOrSecondRow({ second }: { second: boolean }) {
	const { ref } = useAxis<HTMLDivElement>()

	return (
		<>
			<Row ref={second ? undefined : ref} />
			<Row ref={second ? ref : undefined} />
		</>
	)
}

it("applies option changes in place and keeps ref and api stable", () => {
	const instances = countInstancesByTheirOneResizeObserver()
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
	const instances = countInstancesByTheirOneResizeObserver()
	const root = render(<OneInstanceOnFirstOrSecondRow second={false} />)
	const [first, second] = host.children as unknown as [HTMLDivElement, HTMLDivElement]

	expect([first.style.cursor, second.style.cursor]).toEqual(["grab", ""])
	act(() => root.render(<OneInstanceOnFirstOrSecondRow second />))
	expect([first.style.cursor, second.style.cursor]).toEqual(["", "grab"])
	expect(instances.created()).toBe(2)
	expect(instances.live()).toBe(1)
	act(() => root.unmount())
	expect(instances.live()).toBe(0)
})

it("leaves exactly one instance behind after StrictMode's double mount", async () => {
	const instances = countInstancesByTheirOneResizeObserver()
	const scrollListenersPerTarget = new Map<EventTarget, number>()

	const count = (target: EventTarget, delta: number) =>
		scrollListenersPerTarget.set(target, (scrollListenersPerTarget.get(target) ?? 0) + delta)

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
	expect(scrollListenersPerTarget.get(el)).toBe(1)
	await act(async () => {
		el.scrollLeft = 100
		await vi.waitFor(() => expect(latest!.x.scroll).toBe(100))
	})
	act(() => root.unmount())
	expect(instances.live()).toBe(0)
	expect(scrollListenersPerTarget.get(el)).toBe(0)
})
