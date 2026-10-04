export const wheel = (el: HTMLElement, init: WheelEventInit) => {
	const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init })

	el.dispatchEvent(event)

	return event.defaultPrevented
}
