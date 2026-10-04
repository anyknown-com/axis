import { afterEach, describe, expect, it, vi } from "vitest"
import { commands } from "vitest/browser"
import { center } from "../../test/center"
import { cleanup } from "../../test/cleanup"
import { cleanups } from "../../test/cleanups"
import { drag } from "../../test/drag"
import { kanban } from "../../test/kanban"
import { nextFrame } from "../../test/next-frame"
import { createAxis } from "./index"

afterEach(cleanup)

describe("nested instances", () => {
	it("routes a drag by its direction and chains outwards at the edge", async () => {
		const { board, column } = kanban()
		const firstCardOfFirstColumn = column.el.firstElementChild!
		const xCarousel200pxWideWith500pxOfContent = `<div style="display:flex;width:200px;height:100px;overflow-x:auto;scrollbar-width:none">${'<div style="flex:0 0 100px"></div>'.repeat(5)}</div>`

		firstCardOfFirstColumn.innerHTML = xCarousel200pxWideWith500pxOfContent

		const carousel = {
			el: firstCardOfFirstColumn.firstElementChild as HTMLElement,
			z: createAxis(firstCardOfFirstColumn.firstElementChild as HTMLElement),
		}

		cleanups.push(() => carousel.z.destroy())
		const onClick = vi.fn<() => void>()

		carousel.el.addEventListener("click", onClick)

		const start = center(carousel.el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 5, start.y - 40, 10)
		const columnBetweenTwoXInstancesTakesTheVerticalDrag = column.z.getState().isDragging

		expect(columnBetweenTwoXInstancesTakesTheVerticalDrag).toBe(true)
		expect(carousel.z.getState().isDragging).toBe(false)
		expect(board.z.getState().isDragging).toBe(false)
		await commands.mouseUp()
		expect([carousel.el.scrollLeft, column.el.scrollTop, board.el.scrollLeft]).toEqual([0, 40, 0])

		const rightWithEveryXInstanceAtItsStart = 60

		await drag(center(carousel.el), rightWithEveryXInstanceAtItsStart, { holdStillBeforeRelease: 200 })
		expect([carousel.el.scrollLeft, column.el.scrollTop, board.el.scrollLeft]).toEqual([0, 40, 0])
		expect(onClick).not.toHaveBeenCalled()

		const leftOwnedByTheInnermostInstanceThatCanScroll = -50

		await drag(center(carousel.el), leftOwnedByTheInnermostInstanceThatCanScroll, {
			holdStillBeforeRelease: 200,
		})
		expect([carousel.el.scrollLeft, board.el.scrollLeft]).toEqual([50, 0])

		const carouselEnd = 300

		carousel.z.scrollTo({ x: carouselEnd }, { animate: false })
		await drag(center(carousel.el), -60, { holdStillBeforeRelease: 200 })
		expect([carousel.el.scrollLeft, board.el.scrollLeft]).toEqual([300, 60])
	})

	it("does not change hands in the middle of a drag", async () => {
		const { board, column } = kanban()
		const start = center(column.el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x, start.y - 60, 6)
		await commands.mouseMove(start.x - 150, start.y - 60, 10)
		await commands.mouseUp()
		expect(column.el.scrollTop).toBe(60)
		expect(board.el.scrollLeft).toBe(0)
	})

	it("holds every pressed container while the pointer is outside them", async () => {
		const { board, column } = kanban()
		const start = center(column.el)

		await commands.mouseMove(start.x, start.y)
		await commands.mouseDown()
		await commands.mouseMove(start.x - 60, start.y, 6)
		expect(board.z.getState().isDragging).toBe(true)
		const belowTheBoardWhereSafariAutoscrollsThePressedColumn = start.y + 200

		await commands.mouseMove(start.x - 100, belowTheBoardWhereSafariAutoscrollsThePressedColumn, 10)
		const seenEveryFrameBeforePaint = new Set<number>()

		const sample = () => {
			seenEveryFrameBeforePaint.add(column.el.scrollTop)
			frame = requestAnimationFrame(sample)
		}

		let frame = requestAnimationFrame(sample)

		await new Promise((resolve) => setTimeout(resolve, 300))
		cancelAnimationFrame(frame)
		const neverShowsAnUndoneAutoscroll = [0]

		expect([...seenEveryFrameBeforePaint]).toEqual(neverShowsAnUndoneAutoscroll)
		await nextFrame()
		expect([board.el.scrollLeft, board.el.scrollTop, column.el.scrollTop]).toEqual([100, 0, 0])
		await commands.mouseUp()
		await nextFrame()
		expect([board.el.scrollLeft, column.el.scrollTop]).toEqual([100, 0])
	})

	it("swallows exactly one click after a real drag", async () => {
		const { board } = kanban()
		const linkInViewAfterTheBoardScrolls = board.el.children[1]!.querySelector("a")!
		const onClick = vi.fn<(event: MouseEvent) => void>((event) => event.preventDefault())

		document.addEventListener("click", onClick)
		cleanups.push(() => document.removeEventListener("click", onClick))
		await drag(center(linkInViewAfterTheBoardScrolls), -80)
		expect(board.el.scrollLeft).toBe(80)
		expect(onClick).toHaveBeenCalledTimes(0)
		await commands.mouseMove(
			center(linkInViewAfterTheBoardScrolls).x,
			center(linkInViewAfterTheBoardScrolls).y,
		)
		await commands.mouseDown()
		await commands.mouseUp()
		expect(onClick).toHaveBeenCalledTimes(1)
	})
})
