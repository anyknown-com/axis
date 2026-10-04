export function toggle(id: string, apply: (checked: boolean) => void) {
	const input = document.querySelector<HTMLInputElement>(`#${id}`)!

	input.addEventListener("change", () => apply(input.checked))
}
