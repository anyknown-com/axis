export const section = (demo: string) => document.querySelector<HTMLElement>(`[data-demo="${demo}"]`)!

export const part = (demo: string, selector: string) => section(demo).querySelector<HTMLElement>(selector)!
