// Contention decomposition (custodian, wave 44): the shared 44px
// floor-grammar primitives (rule chunking, min-height/flex/padding/
// width-height predicates, companion-token resolution), extracted verbatim
// from test/tap-floor-exempt-premise.scan.test.ts, no behavior change.
import type { ProductFile } from "./population";
import { stripCssComments } from "../helpers/strip-css-comments";

/** Comment-stripped CSS regions of a file: the whole text for a `.css`
 * file, or every backtick template-literal body for a `.ts`/`.tsx` file
 * (the surrounding JS -- imports, object literals, control flow -- is not
 * CSS and its braces would desync a brace-based rule walk if scanned as one
 * blob). Comments are stripped first via the SHARED stripper (DEC-613:
 * never a private copy) so a prose comment containing literal `{`/`}` text
 * can't desync selector/body matching either. */
export function cssRegionsOf(f: ProductFile): string[] {
  if (f.path.endsWith(".css")) return [stripCssComments(f.text)];
  const regions: string[] = [];
  const re = /`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f.text)) !== null) regions.push(stripCssComments(m[1] as string));
  return regions;
}

/** Non-nested `selector { body }` matcher, the same shape
 * app/src/phone-tap-target-scan/core.ts's narrowMediaRules uses internally:
 * applied to comment-stripped text, an `@media (...) {` opener is simply
 * skipped as unconsumed leading text before the first real leaf rule inside
 * it -- correct because this codebase's CSS never nests a rule inside a
 * rule, only inside at most one level of `@media`. */
export function ruleChunks(text: string): Array<{ selector: string; body: string }> {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const out: Array<{ selector: string; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ selector: m[1] as string, body: m[2] as string });
  return out;
}

export function hasMinHeightFloor(body: string): boolean {
  const re = /min-height\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) if (Number(m[1]) >= 44) return true;
  return false;
}

/** `display:flex` OR `display:inline-flex` both establish the same
 * align-items/justify-content centring this lens cares about -- a stricter
 * `flex`-only test (as some SIBLING lenses in this campaign use, for a
 * DIFFERENT population) would wrongly fail this codebase's several
 * `inline-flex` pill/chip controls, which centre their content identically. */
export function hasFlexCenter(body: string): boolean {
  return /display\s*:\s*(inline-)?flex/.test(body) && /align-items\s*:\s*center/.test(body);
}

/** DEC-393 wave-34: a SECOND floor-grammar tier, for a REPLACED-CONTENT
 * companion (an `<img>` or an element the sheet itself styles alongside an
 * `img` element selector, e.g. `.chq-foo img, .chq-foo-fallback { ... }`).
 * There is no text content to centre or pad around, so DESIGN-RULINGS.md's
 * hit-box floor is reached by the companion's OWN resolved width/height (or
 * min-width/min-height) rules putting BOTH axes at >=44px -- independent of
 * display:flex / align-items / padding, which this tier never requires.
 * Derived from the sheet's own rules (which selectors co-occur with `img`,
 * what px sizes those rules declare), never a hand-listed selector
 * allowlist (DEC-367/DEC-808: a directory, and by extension an allowlist,
 * is not a population). */
export function isReplacedContentSelector(selector: string): boolean {
  return /\bimg\b/.test(selector);
}

export function maxPxAxis(body: string, prop: "width" | "height"): number {
  let max = -Infinity;
  const plain = new RegExp(`(?<![\\w-])${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "g");
  const min = new RegExp(`min-${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "g");
  for (const m of body.matchAll(plain)) max = Math.max(max, Number(m[1]));
  for (const m of body.matchAll(min)) max = Math.max(max, Number(m[1]));
  return max;
}

export function hasWidthHeightFloor(body: string): boolean {
  return maxPxAxis(body, "width") >= 44 && maxPxAxis(body, "height") >= 44;
}

export function horizontalPaddingNonZero(body: string): boolean {
  const nonZero = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t !== "" && t !== "0" && t !== "0px";
  };
  for (const m of body.matchAll(/padding-(?:left|right|inline)\s*:\s*([^;]+)/g)) {
    if (nonZero(m[1])) return true;
  }
  for (const m of body.matchAll(/(?<![\w-])padding\s*:\s*([^;]+)/g)) {
    const parts = (m[1] ?? "").trim().split(/\s+/).filter(Boolean);
    const horiz = parts.length <= 1 ? [parts[0]] : parts.length === 2 || parts.length === 3 ? [parts[1]] : [parts[1], parts[3]];
    if (horiz.some((v) => nonZero(v))) return true;
  }
  return false;
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether the companion floor-grammar (flex+minheight+padding, or the
 * replaced-content width/height tier) is satisfied by every CSS rule in the
 * tree whose selector mentions `token` as a `.chq-*` class -- the SAME
 * merge-and-test shape `judgeReceipt`'s companion path already uses,
 * factored out so `judgeSelfScoped` can apply it per-candidate-token. */
export function tokenReachesFloor(token: string, allChunks: Array<{ selector: string; body: string }>): { floored: boolean; ruleCount: number } {
  const tokenRe = new RegExp(`\\.${escapeRe(token)}(?![\\w-])`);
  const matchingChunks = allChunks.filter((c) => tokenRe.test(c.selector));
  if (matchingChunks.length === 0) return { floored: false, ruleCount: 0 };
  const merged = matchingChunks.map((c) => c.body).join("\n");
  const flexFloored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  const replacedContent = matchingChunks.some((c) => isReplacedContentSelector(c.selector));
  const widthHeightFloored = replacedContent && hasWidthHeightFloor(merged);
  return { floored: flexFloored || widthHeightFloored, ruleCount: matchingChunks.length };
}
