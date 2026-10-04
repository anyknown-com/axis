import type { Sample, Vector } from "../utils"

export interface DragClient {
	readonly el: HTMLElement
	onScrollbar(event: PointerEvent): boolean
	accepts(axis: "x" | "y"): boolean
	canScroll(delta: Vector): boolean
	press(): void
	yield(): void
	start(pointerId: number): void
	move(delta: Vector): void
	pass(): void
	end(pointerVelocity: Vector | null): void
	interrupt(): void
}

export interface Session {
	pointerId: number
	start: Vector
	chain: DragClient[]
	owner: DragClient | null
	samples: Sample[]
}

export interface Coordinator {
	add(client: DragClient): () => void
}
