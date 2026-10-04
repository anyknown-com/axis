# @anyknown/axis

A headless scroll primitive for horizontal rows, vertical lists and 2D canvases: **native scroll first, drag as an enhancement.**

You give axis an element with `overflow: auto`. Touch, trackpad, keyboard and scrollbar keep working exactly as the browser makes them work. axis adds mouse drag-scrolling on x, y or both axes, with momentum, snap-aware release, an optional vertical-wheel translation for rows, nested-container hand-off, and an observable scroll state for prev/next buttons and progress indicators.

- No CSS shipped, no required DOM structure, no wrapper elements.
- The native `scrollLeft` / `scrollTop` is the only source of truth. Nothing is moved with `transform`.
- Nested instances (a kanban board of scrolling columns, a carousel inside a page row) share one coordinator and never fight over a drag.
- Framework-agnostic core plus an optional React hook.

## Install

```sh
pnpm add @anyknown/axis
```

## Vanilla

```html
<div class="row">
	<div class="card">1</div>
	<div class="card">2</div>
	<!-- … -->
</div>
<button id="prev">Prev</button>
<button id="next">Next</button>
```

```css
.row {
	display: flex;
	gap: 12px;
	overflow-x: auto;
	/* optional: */
	scroll-snap-type: x mandatory;
}
.card {
	flex: 0 0 240px;
	scroll-snap-align: start;
}
```

```ts
import { createAxis } from "@anyknown/axis"

const row = document.querySelector<HTMLElement>(".row")!
const axis = createAxis(row, { wheel: true })

const prev = document.querySelector<HTMLButtonElement>("#prev")!
const next = document.querySelector<HTMLButtonElement>("#next")!
prev.addEventListener("click", () => axis.scrollPrev())
next.addEventListener("click", () => axis.scrollNext())

axis.subscribe((state) => {
	prev.disabled = !state.x.canScrollPrev
	next.disabled = !state.x.canScrollNext
})

// later
axis.destroy()
```

A vertical list is `createAxis(list, { axis: "y" })`. A pannable canvas is `createAxis(viewport, { axis: "both" })`, where the viewport has `overflow: auto` and one large child.

## React

```tsx
import { useAxis } from "@anyknown/axis/react"

function Row({ items }: { items: string[] }) {
	const { ref, state, api } = useAxis<HTMLDivElement>()
	return (
		<>
			<div ref={ref} className="row">
				{items.map((item) => (
					<div key={item} className="card">
						{item}
					</div>
				))}
			</div>
			<button disabled={!state.x.canScrollPrev} onClick={() => api.scrollPrev()}>
				Prev
			</button>
			<button disabled={!state.x.canScrollNext} onClick={() => api.scrollNext()}>
				Next
			</button>
		</>
	)
}
```

`ref` is a stable callback ref, so it can be merged with your own ref inline (`ref={(el) => { mine.current = el; ref(el) }}`). The instance is created when the element mounts, destroyed when it unmounts, and moved when the ref is attached to another element. Option changes are applied in place. `state` comes from `useSyncExternalStore`, so the component re-renders only when a value changes. `api` (`scrollPrev`, `scrollNext`, `scrollTo`, `refresh`) is stable and does nothing before the element mounts. React (18 or 19) is an optional peer dependency; the core does not import it.

### Selecting part of the state

The full state changes on every scrolled pixel. When a component only needs part of it, pass a selector as the second argument. `state` is then the selector's result, and the component re-renders only when that result changes (compared with `Object.is`):

```tsx
function NextButton() {
	const { ref, state: canScrollNext, api } = useAxis(undefined, (state) => state.x.canScrollNext)
	// canScrollNext: boolean, inferred from the selector
	return (
		<>
			<div ref={ref} className="row">
				{/* … */}
			</div>
			<button disabled={!canScrollNext} onClick={() => api.scrollNext()}>
				Next
			</button>
		</>
	)
}
```

Return a primitive or an existing object from the state (`(state) => state.x`). A selector that builds a new object or array re-renders on every state change. An inline selector is fine; it does not need `useCallback`.

Do not pass type arguments together with a selector: `useAxis<HTMLDivElement>(undefined, selector)` does not compile, because TypeScript cannot infer the selected type once any type argument is given. Leave them out and both the ref and the selected type work: `ref` accepts any HTML element.

## API

### `createAxis(el, options?) => AxisInstance`

| Method                            | Description                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `getState()`                      | Current state. The object is replaced (never mutated) when a value changes.                                              |
| `subscribe(listener)`             | Calls `listener(state)` on every change. Returns an unsubscribe function.                                                |
| `scrollPrev(axis?)`               | Previous snap position on `axis`, or back by 90% of the visible size when that axis does not snap.                      |
| `scrollNext(axis?)`               | Next snap position on `axis`, or forward by 90% of the visible size when that axis does not snap.                       |
| `scrollTo({ x?, y? }, { animate })` | Scroll to a logical position in px from the start edge of each axis. Missing axes stay put. `animate` defaults to `true`. |
| `setOptions(partial)`             | Change options. Missing or `undefined` keys keep their value.                                                            |
| `refresh()`                       | Re-read the layout: clear the cached snap positions and update the state now. Rarely needed; see Limitations.            |
| `destroy()`                       | Remove every listener and observer, and restore every inline style and attribute axis changed.                           |

`scrollPrev` and `scrollNext` default to the configured axis. With `axis: "both"` there is no default, and calling them without `"x"` or `"y"` throws an error.

### Options

| Option     | Default | Description                                                                                                                         |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `axis`     | `"x"`   | `"x"` drags horizontally and ignores vertical mouse movement, `"y"` drags vertically, `"both"` pans freely in 2D.                   |
| `momentum` | `true`  | Keep gliding after a fast mouse drag is released, along the release velocity vector. Never applied under `prefers-reduced-motion`.  |
| `wheel`    | `false` | Translate vertical mouse-wheel scrolling into horizontal scrolling. **Only used with `axis: "x"`**; see below.                       |
| `cursor`   | `true`  | Set `cursor: grab` while the container can be dragged and `grabbing` while dragging.                                                |

### State

```ts
interface AxisScrollState {
	x: AxisState
	y: AxisState
	isDragging: boolean // a mouse drag is scrolling the container
	isMomentum: boolean // the container glides after a drag (momentum, or settling on a snap point)
}

interface AxisState {
	scroll: number // logical distance from the start edge, 0 to maxScroll
	maxScroll: number // 0 when the content fits
	progress: number // scroll / maxScroll, 0 to 1 (0 when the content fits)
	canScrollPrev: boolean // more than 1px away from the start edge
	canScrollNext: boolean // more than 1px away from the end edge
}
```

Both axes are always reported, whatever `axis` is set to. State updates come from `scroll` events, a `ResizeObserver` on the container and its children, and a `MutationObserver` for added or removed children, `class`, `style` and `dir` changes on the container or anything inside it, and `dir` changes on its ancestors. Listeners are not called when nothing changed, and an axis object that did not change keeps its identity.

## Behaviour

**Only the mouse is taken over.** A drag starts only for `pointerType === "mouse"` with the primary button, and only after the pointer moves more than 5px. Below that it is an ordinary click. Touch and pen keep native scrolling, and presses on either scrollbar are left to the browser.

**The axis decides what a drag means.** When the movement passes the threshold, its dominant direction is compared with `axis`. An `"x"` instance takes mostly horizontal drags and ignores the vertical part of the movement; a mostly vertical drag is not an `"x"` drag at all, so text selection and the page behave natively. `"y"` is the mirror image. `"both"` takes any direction and follows the pointer in 2D without locking.

**Form controls are left alone.** A press inside `input`, `textarea`, `select`, `[contenteditable]` or any element with `data-axis-no-drag` never starts a drag.

**While dragging**, the container gets `data-axis-dragging`, `cursor: grabbing` and `user-select: none`. Native `dragstart` (images, links) is cancelled while the mouse is down. Pointer capture keeps the drag going outside the element. Once the movement passes the threshold, every axis container under the pointer (the one that owns the drag and the ones around it) holds its scroll position on both axes, except the axes being dragged, so Safari's selection autoscroll cannot move them when the pointer leaves them. Until then the press may still be a click and nothing is held: `scrollIntoView`, focus scrolling and scroll anchoring work as usual. While the drag lasts, the page's own programmatic scrolling of those containers is undone too. A wheel event or a scrolling key anywhere (arrows, Page Up/Down, Home, End, Space, outside text fields) lets go of every hold, so scrolling on purpose still works; modifier keys do not. A drag also ends without a `pointerup` when the window loses focus, the tab is hidden, a context menu opens, or the button turns out to be up (a release over an iframe).

**Clicks after a drag are swallowed once.** After a real drag, the next `click` is stopped in the capture phase (`preventDefault` + `stopPropagation`), so releasing over a link or button does not activate it. This happens once per drag, also with nested instances. The suppression ends after 100ms or at the next press, whichever comes first, so it never eats a later click (Safari fires no click at all when the press and the release hit different elements).

**Momentum** uses the 2D pointer velocity from roughly the last 100ms before release and decays with friction on `requestAnimationFrame`, only on the axes the instance drags. Any `wheel`, `pointerdown`, `touchstart` or scrolling key stops it at once: a mouse press stops the momentum of every axis container under the pointer, like grabbing a flung list. A glide your code started (`scrollTo`, prev/next, wheel snapping) is not momentum: a mouse press that can start a drag leaves it running, and it only stops when that container itself is dragged. A press that cannot start a drag (touch, pen, another button, a scrollbar, or a press in a form field or `data-axis-no-drag` content) stops it like any other native input. A container whose glide is running when another one takes the drag is not held until that glide ends. A pointer that stopped before release does not fling.

**scroll-snap works on both axes.** axis reads `scroll-snap-type` (`x`, `y`, `both`, `inline`, `block`), the two values of each child's `scroll-snap-align` (block, then inline), `scroll-padding` and `scroll-margin` on all four sides. While axis drives the scroll it sets `scroll-snap-type: none` and `scroll-behavior: auto` inline. On release it predicts where momentum would land, picks the nearest snap position on each snapping axis independently, glides there on both axes together with its own animation, and only then restores the original inline values. It does not rely on the browser re-snapping when the snap type comes back, because Safari does not do that reliably.

**prev/next** go to the adjacent snap position on that axis when it snaps, otherwise by 90% of the visible size. Pressing again during the glide continues from where the glide is heading. Under `prefers-reduced-motion: reduce` they jump.

**Wheel translation is for rows only.** With `axis: "x"` and `wheel: true`, a mostly vertical, non-shift wheel event scrolls horizontally (line and page delta modes are normalised). At the edge in the wheel's direction the event is left alone, so the page scrolls on. With snap, it settles on the next snap position in the wheel's direction after the wheel goes quiet. With `axis: "y"` or `"both"` the option is ignored: native wheel and trackpad scrolling already cover those directions, and taking them over would only make scrolling worse.

**RTL.** With `direction: rtl`, browsers report `scrollLeft` from `0` down to negative values. axis converts x to logical positions: `state.x.scroll`, `progress`, `canScrollPrev/Next`, `scrollTo` and prev/next all count from the inline start. y is not affected.

## Nested containers

All instances in a window share one small coordinator. A press does not pick an owner. When the movement passes the 5px threshold, the coordinator takes its dominant direction and walks the instances under the pointer from the innermost outwards. The drag goes to the first instance whose `axis` covers that direction and that can still scroll the way the pointer pushes. An instance that is already at its edge in that direction hands the drag to the next instance out, like native overscroll chaining. If none of them can scroll, the innermost instance whose `axis` covers the direction keeps the gesture, so the drag still does not turn into a click. If no instance covers the direction, the browser handles the movement. `"both"` instances cover both directions. The owner does not change for the rest of that drag.

A kanban board is an `axis: "x"` board whose columns are `axis: "y"` containers: vertical drags scroll the column under the pointer, horizontal drags scroll the board.

## How this differs from Embla, Keen Slider and other transform-based carousels

Transform-based carousels own the position. They intercept every pointer (touch included), move a track with `transform: translate`, and re-implement physics, snapping, looping and accessibility on top. That gives full control (loops, custom easing, slide effects), but scrolling is no longer real scrolling: the browser's touch physics, trackpad momentum, keyboard scrolling, scrollbars, `scroll-snap`, find-in-page and scroll-linked CSS all have to be emulated or are lost.

axis does the opposite. The container is a real scroll container and stays one. The browser handles every input except a primary-button mouse drag, which desktop browsers do not offer natively. axis fills that gap and gives you state for building controls.

Choose axis when you want native-feeling rows, lists or canvases that also drag with a mouse. Choose a transform-based carousel when you need looping, slide transitions, or full control over the motion on touch devices.

## Browser support

Tested in Chromium and WebKit (Safari's engine) on every change. Firefox is expected to work but is not part of the test run.

## Limitations

- Only the direct children of the container are read as snap areas.
- Snap positions are cached. The cache is cleared when the container or a child resizes, children are added or removed, a `class`, `style` or `dir` attribute changes on the container or anything inside it, a `dir` attribute changes on an ancestor, or `setOptions` is called. Call `refresh()` only when snap properties change in a way none of these see: a `class` change on an ancestor, or a stylesheet or media query that changes `scroll-padding`, `scroll-margin` or `scroll-snap-align` without resizing anything.
- Overlay scrollbars (macOS default) cannot be told apart from content, so a mouse press on an overlay scrollbar thumb starts a drag instead.
- `proximity` snapping is settled like `mandatory`: a drag release always lands on the nearest snap position.
- Horizontal writing modes only: `inline` means x and `block` means y. RTL targets the modern `scrollLeft` model (0 to negative), supported in all current browsers.

## License

MIT
