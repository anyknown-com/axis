// Pure geometry and physics helpers. No DOM access here, so every function is unit-testable in node.

/** A 2D vector, e.g. a position, a pointer delta or a velocity. */
export interface Vector {
	x: number
	y: number
}

/** A pointer position sample: `t` in ms, `x`/`y` in px. */
export interface Sample extends Vector {
	t: number
}

/** Only the samples from the last VELOCITY_WINDOW ms before release count towards the fling velocity. */
export const VELOCITY_WINDOW = 100
/** Fling speed cap per axis in px/ms, so a jittery sample pair cannot launch the content to the far end. */
export const MAX_VELOCITY = 5
/** Per-frame velocity multiplier for momentum. */
export const DECAY = 0.95
/** Reference frame duration that DECAY is defined against. */
export const FRAME_MS = 1000 / 60
/** Momentum stops below this speed in px/ms. */
export const MIN_VELOCITY = 0.02

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Velocity in px/ms over the last VELOCITY_WINDOW ms, measured up to the newest sample (the release).
 * A pointer that stopped before release has no recent movement and yields ~0.
 */
export function velocityFromSamples(samples: readonly Sample[], window = VELOCITY_WINDOW): Vector {
	const last = samples.at(-1)
	if (!last) return { x: 0, y: 0 }
	let first = last
	for (let i = samples.length - 2; i >= 0; i--) {
		const sample = samples[i]!
		if (last.t - sample.t > window) break
		first = sample
	}
	const dt = last.t - first.t
	if (dt <= 0) return { x: 0, y: 0 }
	return {
		x: clamp((last.x - first.x) / dt, -MAX_VELOCITY, MAX_VELOCITY),
		y: clamp((last.y - first.y) / dt, -MAX_VELOCITY, MAX_VELOCITY),
	}
}

/** Advances a momentum step on one axis: the distance travelled in `dt` ms and the decayed velocity. */
export function momentumStep(velocity: number, dt: number): { distance: number; velocity: number } {
	return { distance: velocity * dt, velocity: velocity * DECAY ** (dt / FRAME_MS) }
}

/** Total distance momentum travels on one axis from `velocity` (px/ms) until it decays to rest. */
export function momentumDistance(velocity: number): number {
	return (velocity * FRAME_MS) / (1 - DECAY)
}

/** The axis a pointer delta mostly moves along. Ties go to x. */
export function dominantAxis(delta: Vector): "x" | "y" {
	return Math.abs(delta.x) >= Math.abs(delta.y) ? "x" : "y"
}

/** Converts a physical `scrollLeft` into a logical offset from the inline start (always >= 0). */
export function toLogical(scrollLeft: number, rtl: boolean): number {
	// Modern browsers report RTL scrollLeft as 0 at the start, going negative towards the end.
	return rtl ? -scrollLeft : scrollLeft
}

/** Converts a logical horizontal offset back into a physical `scrollLeft`. */
export function toPhysical(logical: number, rtl: boolean): number {
	return rtl ? -logical : logical
}

/**
 * Which axes a computed `scroll-snap-type` snaps. `inline` and `block` assume a horizontal writing mode.
 */
export function parseSnapType(value: string): { x: boolean; y: boolean } {
	const axis = value.trim().split(/\s+/)[0]
	return {
		x: axis === "x" || axis === "both" || axis === "inline",
		y: axis === "y" || axis === "both" || axis === "block",
	}
}

export type SnapAlign = "start" | "center" | "end" | "none"

const toAlign = (value: string | undefined): SnapAlign =>
	value === "start" || value === "center" || value === "end" ? value : "none"

/**
 * Per-axis value of a computed `scroll-snap-align` (`"<block> <inline>"`, or one value for both).
 * The inline value applies to x and the block value to y (horizontal writing mode).
 */
export function parseSnapAlign(value: string): { x: SnapAlign; y: SnapAlign } {
	const [block, inline = block] = value.trim().split(/\s+/)
	return { x: toAlign(inline), y: toAlign(block) }
}

/**
 * One axis of a snapport, in viewport px. `start` is the physical low edge (left or top) of the padding box,
 * `size` its length (clientWidth or clientHeight), and the paddings are physical too (left/right, top/bottom).
 */
export interface SnapAxis {
	start: number
	size: number
	paddingStart: number
	paddingEnd: number
	/** The physical scroll offset (scrollLeft or scrollTop). */
	scroll: number
	maxScroll: number
	/** True for x in RTL: logical start is the physical high edge and scrollLeft runs negative. */
	rtl: boolean
}

/** A snap area on one axis in viewport px, already including its scroll-margin. */
export interface SnapItem {
	start: number
	size: number
	align: SnapAlign
}

/**
 * Logical scroll offsets at which each item satisfies its snap alignment on one axis, clamped to the
 * scroll range, sorted ascending and de-duplicated within 1px.
 */
export function snapPositions(axis: SnapAxis, items: readonly SnapItem[]): number[] {
	const { rtl } = axis
	const portLow = axis.start + axis.paddingStart
	const portHigh = axis.start + axis.size - axis.paddingEnd
	const positions: number[] = []
	for (const item of items) {
		if (item.align === "none") continue
		const high = item.start + item.size
		// start/end follow the inline direction, so in RTL "start" is the high (right) edge.
		const delta =
			item.align === "center"
				? (item.start + high) / 2 - (portLow + portHigh) / 2
				: (item.align === "start") !== rtl
					? item.start - portLow
					: high - portHigh
		positions.push(clamp(toLogical(axis.scroll + delta, rtl), 0, axis.maxScroll))
	}
	positions.sort((a, b) => a - b)
	const unique: number[] = []
	for (const position of positions) {
		const previous = unique.at(-1)
		if (previous === undefined || position - previous > 1) unique.push(position)
	}
	return unique
}

/** The snap position closest to `target`, or `target` itself when there are none. */
export function nearestSnap(positions: readonly number[], target: number): number {
	let best = target
	let bestDistance = Infinity
	for (const position of positions) {
		const distance = Math.abs(position - target)
		if (distance < bestDistance) {
			best = position
			bestDistance = distance
		}
	}
	return best
}

/** The first snap position past `current` in `direction` (1 = next, -1 = prev), or undefined. */
export function adjacentSnap(
	positions: readonly number[],
	current: number,
	direction: 1 | -1,
): number | undefined {
	if (direction === 1) return positions.find((position) => position > current + 1)
	for (let i = positions.length - 1; i >= 0; i--) if (positions[i]! < current - 1) return positions[i]
	return undefined
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * Duration in ms of an ease-out-cubic glide over `distance` on one axis. When the release velocity points
 * the same way, the glide starts at that velocity (ease-out-cubic starts at 3 × average speed).
 */
export function glideDuration(distance: number, velocity = 0): number {
	const d = Math.abs(distance)
	if (velocity !== 0 && Math.sign(velocity) === Math.sign(distance)) {
		return clamp((3 * d) / Math.abs(velocity), 180, 900)
	}
	return clamp(200 + d * 0.5, 200, 600)
}
