export const prefersReducedMotion = (win: Window) =>
	win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
