import * as Rule141 from "./1.4.1.js";
import * as Rule132 from "./1.3.2.js";
import * as Rule133 from "./1.3.3.js";
import * as Rule253 from "./2.5.3.js";

// ... import others

// map for O(1) lookup
export const RULES = {
  [Rule141.id]: Rule141,
  [Rule132.id]: Rule132,
  [Rule133.id]: Rule133,
  [Rule253.id]: Rule253,
  // the rest of the rules will go here - let's try to keep them in numerical order!
};

// array for iterating
export const RULE_LIST = Object.values(RULES);
