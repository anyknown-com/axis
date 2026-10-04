export const supportedUserSelect = (style: CSSStyleDeclaration) =>
	"userSelect" in style ? "user-select" : "-webkit-user-select"
