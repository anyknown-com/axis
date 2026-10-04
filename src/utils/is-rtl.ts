export const isRtl = (win: Window, el: Element) => win.getComputedStyle(el).direction === "rtl"
