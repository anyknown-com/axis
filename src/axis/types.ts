import type { Vector } from "../utils"

/** The direction(s) a mouse drag scrolls: horizontal, vertical, or free 2D panning. */
export type AxisMode = "x" | "y" | "both"

/** A single scroll axis. */
export type AxisName = "x" | "y"

/** Options for {@link createAxis}. Every option can be changed later with {@link AxisInstance.setOptions}. */
export interface AxisOptions {
	/**
	 * Which direction a mouse drag scrolls. `"x"` ignores vertical mouse movement, `"y"` ignores horizontal
	 * movement, and `"both"` pans freely in 2D.
	 * @default "x"
	 */
	axis?: AxisMode
	/**
	 * Keep gliding after a fast mouse drag is released. Never applied under `prefers-reduced-motion: reduce`.
	 * @default true
	 */
	momentum?: boolean
	/**
	 * Translate vertical mouse-wheel scrolling into horizontal scrolling. Only used with `axis: "x"`; at either
	 * end the wheel is left alone, so the page keeps scrolling.
	 * @default false
	 */
	wheel?: boolean
	/**
	 * Set `cursor: grab` on the container while it can be dragged, and `grabbing` while dragging.
	 * @default true
	 */
	cursor?: boolean
}

/** Scroll state of one axis. Positions are logical: measured from the start edge, so positive in RTL too. */
export interface AxisState {
	/** Distance scrolled from the start edge, in px (0 to `maxScroll`). */
	scroll: number
	/** Largest possible `scroll`, in px. 0 when the content fits. */
	maxScroll: number
	/** `scroll / maxScroll`, from 0 to 1. 0 when the content fits. */
	progress: number
	/** True when the container is more than 1px away from the start edge. */
	canScrollPrev: boolean
	/** True when the container is more than 1px away from the end edge. */
	canScrollNext: boolean
}

/** Scroll state of both axes, whatever `axis` is set to. */
export interface AxisScrollState {
	x: AxisState
	y: AxisState
	/** True while a mouse drag is scrolling the container. */
	isDragging: boolean
	/** True while the container glides after a drag is released (momentum or settling on a snap position). */
	isMomentum: boolean
}

/** A logical scroll position. Axes that are left out keep their current position. */
export interface AxisPosition {
	x?: number
	y?: number
}

/** Options for {@link AxisInstance.scrollTo}. */
export interface AxisScrollToOptions {
	/** Animate the scroll. Ignored (jumps) under `prefers-reduced-motion: reduce`. @default true */
	animate?: boolean
}

/** An axis instance bound to one scroll container. */
export interface AxisInstance {
	/** The current state. The object is replaced, never mutated, when a value changes. */
	getState(): AxisScrollState
	/** Calls `listener` whenever the state changes. Returns a function that removes the listener. */
	subscribe(listener: (state: AxisScrollState) => void): () => void
	/**
	 * Scrolls `axis` to the previous snap position, or back by 90% of the visible size when it does not snap.
	 * `axis` defaults to the configured axis and is required with `axis: "both"`.
	 */
	scrollPrev(axis?: AxisName): void
	/**
	 * Scrolls `axis` to the next snap position, or forward by 90% of the visible size when it does not snap.
	 * `axis` defaults to the configured axis and is required with `axis: "both"`.
	 */
	scrollNext(axis?: AxisName): void
	/** Scrolls to a logical position (px from the start edge of each axis). */
	scrollTo(position: AxisPosition, options?: AxisScrollToOptions): void
	/** Changes some options. Keys that are left out or `undefined` keep their current value. */
	setOptions(options: AxisOptions): void
	/**
	 * Re-reads the layout: clears the cached snap positions and updates the state. Only needed after a change
	 * axis cannot observe, such as a stylesheet or media query changing snap properties without a resize.
	 */
	refresh(): void
	/** Removes every listener and observer and restores every inline style that axis changed. */
	destroy(): void
}

export type Motion = "idle" | "pressed" | "dragging" | "momentum" | "glide" | "wheel"

export type Glide = "momentum" | "glide"

export interface Geometry {
	rtl(): boolean
	scrollRange(): Vector
	position(rtl?: boolean, range?: Vector): Vector
	writePosition(position: AxisPosition, rtl?: boolean): void
}

export interface AxisCore extends Geometry {
	el: HTMLElement
	win: Window
	options(): Required<AxisOptions>
	motion(): Motion
	setMotion(next: Motion): void
	isDestroyed(): boolean
	snapPoints(): Record<AxisName, number[]>
}

export interface StyleOverrides {
	override(prop: string, value: string, important?: boolean): void
	restore(prop: string): void
	restoreAll(): void
}

export interface SnapSuspension {
	suspend(): void
	resume(): void
	snapAxes(): { x: boolean; y: boolean }
	isSuspended(): boolean
}

export interface Hold {
	holdCurrent(): void
	release(): void
	reset(): void
	yieldDrag(glideHoldsAtItsEnd: boolean): void
	holdIfYielded(): void
	follow(axis: AxisName): void
	undoAutoscroll(): void
}

export interface ScrollDriver {
	stop(): void
	settle(): void
	interrupt(): void
	jump(target: AxisPosition): void
	glideTo(target: AxisPosition, velocity: Vector, kind: Glide): void
	fling(scrollVelocity: Vector): void
	afterWheelPause(settle: () => void): void
	glideTarget(): Vector
}
