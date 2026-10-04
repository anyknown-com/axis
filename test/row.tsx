const ROW_WIDTH = 300
const CARD_COUNT = 5
const CARD_WIDTH = 200

export function Row(props: React.ComponentProps<"div">) {
	return (
		<div style={{ display: "flex", width: ROW_WIDTH, overflowX: "auto", scrollbarWidth: "none" }} {...props}>
			{Array.from({ length: CARD_COUNT }, (_, i) => (
				<div key={i} style={{ flex: `0 0 ${CARD_WIDTH}px`, height: 50 }} />
			))}
		</div>
	)
}
