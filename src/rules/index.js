import * as Rule141 from "./1.4.1.js";
import * as Rule145 from "./1.4.5.js";
import * as Rule132 from "./1.3.2.js";
import * as Rule133 from "./1.3.3.js";
import * as Rule253 from "./2.5.3.js";
import * as Rule222 from "./2.2.2.js";
import * as Rule322 from "./3.2.2.js";
import * as Rule332 from "./3.3.2.js";
import * as Rule134L from "./1.3.4-landscape.js";
import * as Rule134P from "./1.3.4-portrait.js";
import * as Rule1410 from "./1.4.10.js";
import * as Rule1412 from "./1.4.12.js";
import * as Rule245 from "./2.4.5.js";

export const RULES = {
  [Rule132.id]: Rule132,
  [Rule133.id]: Rule133,
  [Rule134L.id]: Rule134L,
  [Rule134P.id]: Rule134P,
  [Rule141.id]: Rule141,
  [Rule145.id]: Rule145,
  [Rule1410.id]: Rule1410,
  [Rule1412.id]: Rule1412,
  [Rule222.id]: Rule222,
  [Rule245.id]: Rule245,
  [Rule253.id]: Rule253,
  [Rule322.id]: Rule322,
  [Rule332.id]: Rule332,
};

export const RULE_LIST = Object.values(RULES);
