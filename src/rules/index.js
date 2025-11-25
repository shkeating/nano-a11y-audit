import * as Rule132 from "./1.3.2.js";
import * as Rule141 from "./1.4.1.js";
// ... import others

// map for O(1) lookup
export const RULES = {
  [Rule132.id]: Rule132,
  [Rule141.id]: Rule141,
  // ...
};

// Or an array if you just want to iterate
export const RULE_LIST = Object.values(RULES);
