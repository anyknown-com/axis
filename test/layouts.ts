import { CARD, CARD_COUNT, VIEWPORT } from "./constants"

export const LAYOUTS = {
	x: {
		container: `display:flex;width:${VIEWPORT}px;height:100px;overflow-x:auto;`,
		card: `flex:0 0 ${CARD}px;height:100px;`,
		count: CARD_COUNT,
	},
	y: {
		container: `display:flex;flex-direction:column;width:100px;height:${VIEWPORT}px;overflow-y:auto;`,
		card: `flex:0 0 ${CARD}px;`,
		count: CARD_COUNT,
	},
	both: {
		container: `display:grid;grid-template-columns:repeat(${CARD_COUNT},${CARD}px);grid-auto-rows:${CARD}px;width:${VIEWPORT}px;height:${VIEWPORT}px;overflow:auto;`,
		card: "",
		count: CARD_COUNT * CARD_COUNT,
	},
}
