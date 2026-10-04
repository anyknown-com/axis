export function logClicks(section: HTMLElement, root: HTMLElement) {
	const log = section.querySelector<HTMLOutputElement>(".log")!
	let clicks = 0

	root.addEventListener("click", (event) => {
		const target = (event.target as Element).closest("a, button")

		if (!target) return
		if (target instanceof HTMLAnchorElement) event.preventDefault()

		const label = target.querySelector("strong")?.textContent ?? target.textContent

		log.textContent = `#${++clicks} clicked: ${label}`
	})
}
