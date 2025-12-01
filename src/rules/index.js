import * as Rule141 from "./1.4.1.js";
import * as Rule132 from "./1.3.2.js";
import * as Rule133 from "./1.3.3.js";
import * as Rule253 from "./2.5.3.js";
import * as Rule222 from "./2.2.2.js";
import * as Rule322 from "./3.2.2.js";
import * as Rule134 from "./1.3.4.js";
import * as Rule1410 from "./1.4.10.js";

export const RULES = {
  [Rule141.id]: Rule141,
  [Rule132.id]: Rule132,
  [Rule133.id]: Rule133,
  [Rule134.id]: Rule134,
  [Rule222.id]: Rule222,
  [Rule253.id]: Rule253,
  [Rule322.id]: Rule322,
  [Rule1410.id]: Rule1410,
};

export const RULE_LIST = Object.values(RULES);
