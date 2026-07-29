import normal from "./normal/index.mjs"
import empty from "./empty/index.mjs"
import single from "./single/index.mjs"
import partial from "./partial/index.mjs"
import inconsistent from "./inconsistent/index.mjs"
import edgeValues from "./edge-values/index.mjs"

export const fixtureCatalog = Object.freeze({
  normal,
  empty,
  single,
  partial,
  inconsistent,
  "edge-values": edgeValues,
})
