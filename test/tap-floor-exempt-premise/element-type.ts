// Contention decomposition (custodian, wave 44): the element-type tier,
// extracted verbatim from test/tap-floor-exempt-premise.scan.test.ts, no
// behavior change.
import type { Receipt, RosterRow } from "./receipts";
import { escapeRe, hasMinHeightFloor } from "./css-grammar";

// DEC-393 wave-40 (task w40-f, DEC-808): a floor-grammar tier for the exact
// shape the wave-36 comment named as un-resolvable -- error-states.css.ts's
// `modifier` reason (bare ELEMENT TYPES, no `.chq-*` companion at all).
export const ELEMENT_TYPE_WORDS = new Set(["input", "select", "textarea", "fieldset", "button", "a", "label"]);

/** A reason naming bare element types states them as a `/`-joined
 * parenthetical list, e.g. `(input/select/textarea/fieldset)` -- distinct by
 * construction from any OTHER parenthetical group the same reason may carry
 * (a citation like `(phone-tap-target.scan.test.ts SSR_UNFLOORED_TOKENS_
 * CEILING, task w7-e)` is comma/space-joined, never bare `/`-joined lowercase
 * words), so the regex below can never misread a citation as the type list.
 * Returns null when the reason carries no such list at all (the shape this
 * tier does not apply to). */
export function extractElementTypeList(reason: string): string[] | null {
  const m = reason.match(/\(([a-z]+(?:\/[a-z]+)+)\)/);
  if (!m || !m[1]) return null;
  const words = m[1].split("/");
  if (!words.every((w) => ELEMENT_TYPE_WORDS.has(w))) return null;
  return words;
}

/** Whether a bare HTML element TYPE (never a class, and never as part of a
 * DESCENDANT chain -- `.chq-settings-panel fieldset label` names `fieldset`
 * as an ANCESTOR of the thing actually reaching 44px, not the fieldset's own
 * box, so a substring match would misread it as "fieldset is floored") is
 * reached, anywhere in the tree, by a rule declaring min-height:44px on a
 * selector-list ARM that is the bare type itself, optionally with exactly
 * one attribute selector (`input[type=text]`) -- the same grammar
 * theme.ts's own base/phone-media rules use for these types. */
export function hasElementTypeFloor(type: string, allChunks: Array<{ selector: string; body: string }>): boolean {
  const armIsType = (arm: string) => new RegExp(`^${escapeRe(type)}(\\[[^\\]]*\\])?$`).test(arm.trim());
  const matching = allChunks.filter((c) => c.selector.split(",").some(armIsType));
  if (matching.length === 0) return false;
  return hasMinHeightFloor(matching.map((c) => c.body).join("\n"));
}

/** ELEMENT-TYPE tier (DEC-393 wave-40): a reason naming bare element types
 * resolves VERIFIED when EVERY named type is reached by a rule satisfying
 * the 44px grammar; if even one named type is unreached, this tier does NOT
 * resolve the receipt -- it falls back to UNVERIFIABLE-PREMISE, never a
 * silent VERIFIED-by-omission. Returns null (not this shape) only when the
 * reason carries no `/`-joined element-type list at all. */
export function judgeElementTypeReason(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>): RosterRow | null {
  const types = extractElementTypeList(receipt.reason);
  if (!types) return null;
  const unreached = types.filter((t) => !hasElementTypeFloor(t, allChunks));
  if (unreached.length > 0) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE-PREMISE",
      detail: `element-type tier: named element type(s) ${unreached.join(", ")} are not reached by any rule declaring min-height:44px anywhere in the tree`,
    };
  }
  return {
    ...receipt,
    verdict: "VERIFIED",
    detail: `element-type tier: every named element type (${types.join("/")}) is reached by a rule declaring min-height:44px somewhere in the tree`,
  };
}
