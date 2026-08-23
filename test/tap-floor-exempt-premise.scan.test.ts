// DEC-393 wave-30 amendment: "a tap-floor-exempt reason is a premise about
// the tree, and its verifier must be named in the receipt and executable by
// a scan." The tree carries ~50-100 `tap-floor-exempt:` receipts across
// src/routes/**, src/views/** and app/src/**, none of which any instrument
// checked before this file. Two dominant reason families -- `composition`
// ("this class never appears in markup without its already-floored
// companion") and `inline-*` ("a phrase inside a running sentence; a 44px
// box would break the line box") -- state ASSERTIONS ABOUT THE TREE that
// can rot silently the way an unchecked allowlist does (DEC-725). This scan
// makes both families' premises executable and rosters every receipt this
// wave cannot express a check for (never a silent pass, per the task's own
// clause (c)).
//
// POPULATION (never a hand list, DEC-367/DEC-808): every `.ts`, `.tsx` and
// `.css` file under src/** and app/src/**, excluding `*.test.ts(x)` (test
// infrastructure, not a product sheet) and this campaign's own scan-library
// directories (app/src/phone-tap-target-scan/, app/src/phone-overflow-scan/
// -- their prose ABOUT the `tap-floor-exempt:` grammar contains the literal
// token as documentation, not as a real receipt; verified by hand against
// app/src/phone-tap-target-scan/undeclared.ts:30's `<reason>` placeholder,
// which is exactly the kind of false member DEC-999 warns a naive population
// draws in). A receipt is a real `/* tap-floor-exempt: ... */` (or JSX
// `{/* ... */}`) COMMENT -- extracted via the real (non-nested) comment
// grammar, never a raw substring search, so a `//`-line comment or a JS
// string/regex literal that merely mentions the token in prose (the
// scan-library files above) can never be misread as a receipt.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_393 } from "../src/decisions";
import { stripCssComments } from "./helpers/strip-css-comments";

const REPO_ROOT = join(__dirname, "..");
const ROOTS = ["src", "app/src"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler"]);
const EXTS = [".ts", ".tsx", ".css"];
const SKIP_PATH_FRAGMENTS = ["/phone-tap-target-scan/", "/phone-overflow-scan/"];

interface ProductFile {
  path: string;
  text: string;
}

function listProductFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listProductFiles(full));
    } else if (
      EXTS.some((e) => entry.endsWith(e)) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx") &&
      !SKIP_PATH_FRAGMENTS.some((f) => full.split(sep).join("/").includes(f))
    ) {
      out.push(full);
    }
  }
  return out;
}

function productFiles(): ProductFile[] {
  const files = ROOTS.flatMap((r) => listProductFiles(join(REPO_ROOT, r)));
  return files
    .map((full) => ({ path: relative(REPO_ROOT, full).split(sep).join("/"), text: readFileSync(full, "utf8") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export type ReasonFamily = "composition" | "inline" | "modifier" | "scoped" | "render-gate" | "other";
export type Verdict = "VERIFIED" | "UNVERIFIABLE-PREMISE" | "FALSE-PREMISE";

export interface Receipt {
  file: string;
  line: number;
  reason: string;
  receiptedClasses: string[];
  family: ReasonFamily;
}

export interface RosterRow extends Receipt {
  verdict: Verdict;
  detail: string;
}

/** Every real `/* tap-floor-exempt: ... *\/` comment in `text`, matched
 * against the real (non-nested block-comment) grammar -- never a raw
 * substring search, so prose ABOUT the token (a `//` comment, a JS string,
 * a regex literal) is never misread as a receipt. */
function extractReceipts(rel: string, text: string): Receipt[] {
  const commentRe = /\/\*[\s\S]*?\*\//g;
  const out: Receipt[] = [];
  let m: RegExpExecArray | null;
  while ((m = commentRe.exec(text)) !== null) {
    const stripped = m[0].replace(/^\/\*+\s*/, "");
    if (!/^tap-floor-exempt:/.test(stripped)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    const reason = stripped.replace(/^tap-floor-exempt:\s*/, "").replace(/\*\/$/, "").trim();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const selMatch = after.match(/^[\s}]*([^{}\n][^{]*)\{/);
    const receiptedClasses =
      selMatch && selMatch[1] ? [...selMatch[1].matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string) : [];
    const firstWord = reason.trim().split(/\s+/)[0]?.replace(/[,.:;]+$/, "") ?? "";
    // DEC-393 wave-36 (task w36-f): three more named reason families beyond
    // `composition`/`inline-*` are checkable today -- `modifier` and
    // `scoped` both state the SAME premise shape as `composition` (a
    // companion class carries the real floor) and are routed through the
    // unchanged companion floor-grammar tiers below; `render-gate` states a
    // different premise (the component never mounts at phone width) and
    // gets its own two-tier predicate in judgeRenderGate. Everything else
    // still falls to `other` (no predicate this wave, DEC-393 wave-30
    // clause (c)) exactly as before.
    const family: ReasonFamily = /^composition$/i.test(firstWord)
      ? "composition"
      : /^inline/i.test(firstWord)
        ? "inline"
        : /^modifier$/i.test(firstWord)
          ? "modifier"
          : /^scoped$/i.test(firstWord)
            ? "scoped"
            : /^render-gate$/i.test(firstWord)
              ? "render-gate"
              : "other";
    out.push({ file: rel, line, reason, receiptedClasses, family });
  }
  return out;
}

export function allReceipts(files: ProductFile[]): Receipt[] {
  return files.flatMap((f) => extractReceipts(f.path, f.text));
}

/** Comment-stripped CSS regions of a file: the whole text for a `.css`
 * file, or every backtick template-literal body for a `.ts`/`.tsx` file
 * (the surrounding JS -- imports, object literals, control flow -- is not
 * CSS and its braces would desync a brace-based rule walk if scanned as one
 * blob). Comments are stripped first via the SHARED stripper (DEC-613:
 * never a private copy) so a prose comment containing literal `{`/`}` text
 * can't desync selector/body matching either. */
function cssRegionsOf(f: ProductFile): string[] {
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
function ruleChunks(text: string): Array<{ selector: string; body: string }> {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const out: Array<{ selector: string; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ selector: m[1] as string, body: m[2] as string });
  return out;
}

function hasMinHeightFloor(body: string): boolean {
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
function hasFlexCenter(body: string): boolean {
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
function isReplacedContentSelector(selector: string): boolean {
  return /\bimg\b/.test(selector);
}

function maxPxAxis(body: string, prop: "width" | "height"): number {
  let max = -Infinity;
  const plain = new RegExp(`(?<![\\w-])${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "g");
  const min = new RegExp(`min-${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "g");
  for (const m of body.matchAll(plain)) max = Math.max(max, Number(m[1]));
  for (const m of body.matchAll(min)) max = Math.max(max, Number(m[1]));
  return max;
}

function hasWidthHeightFloor(body: string): boolean {
  return maxPxAxis(body, "width") >= 44 && maxPxAxis(body, "height") >= 44;
}

function horizontalPaddingNonZero(body: string): boolean {
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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// DEC-393 wave-36 (task w36-f): the two live 390 sweep rosters a
// `render-gate` claim is falsified against -- read once at module load,
// the same way ALL_TEXT/ALL_CHUNKS below are, so judgeRenderGate's real
// callers never re-touch disk per receipt.
const ADMIN_390_ROSTER = readFileSync(join(REPO_ROOT, "docs/design/audit/admin-390-interactive-offenders-w27.md"), "utf8");
const PUBLIC_390_ROSTER = readFileSync(join(REPO_ROOT, "docs/design/audit/public-390-interactive-offenders-v12.md"), "utf8");

export interface RenderGateDeps {
  exists: (absPath: string) => boolean;
  read: (absPath: string) => string;
  rosterA: string;
  rosterB: string;
}

const REAL_RENDER_GATE_DEPS: RenderGateDeps = {
  exists: existsSync,
  read: (p) => readFileSync(p, "utf8"),
  rosterA: ADMIN_390_ROSTER,
  rosterB: PUBLIC_390_ROSTER,
};

/** DEC-393 wave-36: a `render-gate` claim ("this component never mounts at
 * phone width") is a claim about the TREE's runtime behaviour, not about a
 * CSS floor -- the companion floor-grammar tiers below have nothing to say
 * about it. Two tiers, BOTH required to reach VERIFIED:
 *   (i)  the reason names a real receipt test file that exists on disk and
 *        mentions the gated component by name -- an assertion that the
 *        gate is pinned SOMEWHERE executable, not just asserted in prose;
 *   (ii) FALSIFICATION -- the receipted selector's own class token must NOT
 *        appear in either machine-written 390 roster. An element the live
 *        390 sweep actually rendered contradicts a "never mounts" claim by
 *        construction, so that grades FALSE-PREMISE, never a silent pass
 *        (the task's own worked example: a render-gate whose token DOES
 *        appear in a roster). Dependency-injected (`deps`) so synthetic
 *        controls never have to touch a real file on disk (task's own
 *        instruction: synthetic fixtures, never a live row identity). */
export function judgeRenderGate(receipt: Receipt, deps: RenderGateDeps = REAL_RENDER_GATE_DEPS): RosterRow {
  const testFileMatch = receipt.reason.match(/([\w./-]+\.test\.tsx?)/);
  if (!testFileMatch || !testFileMatch[1]) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason names no receipt test file" };
  }
  const testRelPath = testFileMatch[1];
  const testAbsPath = join(REPO_ROOT, testRelPath);
  if (!deps.exists(testAbsPath)) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `named receipt test file ${testRelPath} does not exist on disk` };
  }
  const componentMatch = receipt.reason.match(/\b([A-Z][A-Za-z0-9]+)\.tsx\b/);
  const component = componentMatch?.[1];
  if (!component) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason names no gated component" };
  }
  const testText = deps.read(testAbsPath);
  if (!testText.includes(component)) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `receipt test file ${testRelPath} does not mention ${component}` };
  }
  const selector = receipt.receiptedClasses[0];
  if (!selector) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "no receipted class token to falsify against the 390 rosters" };
  }
  const tokenRe = new RegExp(`\\b${escapeRe(selector)}\\b`);
  if (tokenRe.test(deps.rosterA) || tokenRe.test(deps.rosterB)) {
    const which = tokenRe.test(deps.rosterA) ? "admin-390-interactive-offenders-w27.md" : "public-390-interactive-offenders-v12.md";
    return {
      ...receipt,
      verdict: "FALSE-PREMISE",
      detail: `.${selector} appears in the live 390 roster ${which} -- the sweep actually rendered it at phone width, so "never mounts here" is false`,
    };
  }
  return {
    ...receipt,
    verdict: "VERIFIED",
    detail: `tier (i): ${testRelPath} exists and mentions ${component}; tier (ii): .${selector} does not appear in either live 390 roster`,
  };
}

// DEC-393 wave-40 (task w40-f, DEC-808): two more floor-grammar tiers for
// the exact two shapes the wave-36 comment named as un-resolvable --
// error-states.css.ts's `modifier` reason (bare ELEMENT TYPES, no `.chq-*`
// companion at all) and submissions/detail.css's `scoped` reason (names the
// receipted selector's OWN token, not a distinct companion).
const ELEMENT_TYPE_WORDS = new Set(["input", "select", "textarea", "fieldset", "button", "a", "label"]);

/** A reason naming bare element types states them as a `/`-joined
 * parenthetical list, e.g. `(input/select/textarea/fieldset)` -- distinct by
 * construction from any OTHER parenthetical group the same reason may carry
 * (a citation like `(phone-tap-target.scan.test.ts SSR_UNFLOORED_TOKENS_
 * CEILING, task w7-e)` is comma/space-joined, never bare `/`-joined lowercase
 * words), so the regex below can never misread a citation as the type list.
 * Returns null when the reason carries no such list at all (the shape this
 * tier does not apply to). */
function extractElementTypeList(reason: string): string[] | null {
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
function hasElementTypeFloor(type: string, allChunks: Array<{ selector: string; body: string }>): boolean {
  const armIsType = (arm: string) => new RegExp(`^${escapeRe(type)}(\\[[^\\]]*\\])?$`).test(arm.trim());
  const matching = allChunks.filter((c) => c.selector.split(",").some(armIsType));
  if (matching.length === 0) return false;
  return hasMinHeightFloor(matching.map((c) => c.body).join("\n"));
}

/** ELEMENT-TYPE tier (DEC-393 wave-40): a reason naming bare element types
 * resolves VERIFIED when EVERY named type is reached by a rule satisfying
 * the 44px grammar; if even one named type is unreached, this tier does
 * NOT resolve the receipt -- it falls back to UNVERIFIABLE-PREMISE, never a
 * silent VERIFIED-by-omission. Returns null (not this shape) only when the
 * reason carries no `/`-joined element-type list at all. */
function judgeElementTypeReason(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>): RosterRow | null {
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

/** Whether the companion floor-grammar (flex+minheight+padding, or the
 * replaced-content width/height tier) is satisfied by every CSS rule in the
 * tree whose selector mentions `token` as a `.chq-*` class -- the SAME
 * merge-and-test shape `judgeReceipt`'s companion path already uses below,
 * factored out so `judgeSelfScoped` can apply it per-candidate-token. */
function tokenReachesFloor(token: string, allChunks: Array<{ selector: string; body: string }>): { floored: boolean; ruleCount: number } {
  const tokenRe = new RegExp(`\\.${escapeRe(token)}(?![\\w-])`);
  const matchingChunks = allChunks.filter((c) => tokenRe.test(c.selector));
  if (matchingChunks.length === 0) return { floored: false, ruleCount: 0 };
  const merged = matchingChunks.map((c) => c.body).join("\n");
  const flexFloored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  const replacedContent = matchingChunks.some((c) => isReplacedContentSelector(c.selector));
  const widthHeightFloored = replacedContent && hasWidthHeightFloor(merged);
  return { floored: flexFloored || widthHeightFloored, ruleCount: matchingChunks.length };
}

/** SELF-SCOPED tier (DEC-393 wave-40): a `scoped` reason that names only a
 * token already present in `receiptedClasses` (no DISTINCT companion) is
 * checked against the receipted selector's OWN classes -- not just the
 * self-named one, since a compound selector's OTHER class (e.g. `.chq-link-
 * button` alongside `.chq-detail-participant-row-actions`) may carry the
 * real floor elsewhere in the tree. VERIFIED the moment any receipted class
 * reaches the floor grammar and appears in real markup; otherwise REFUTED
 * to FALSE-PREMISE -- not silently accepted -- when none of them declare a
 * floor anywhere. */
function judgeSelfScoped(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>, allText: string): RosterRow {
  for (const token of receipt.receiptedClasses) {
    const { floored, ruleCount } = tokenReachesFloor(token, allChunks);
    const present = new RegExp(`\\b${token}\\b`).test(allText);
    if (floored && present) {
      return {
        ...receipt,
        verdict: "VERIFIED",
        detail: `self-scoped tier: the receipted selector's own class .${token} declares the 44px floor (merged across ${ruleCount} rule(s)) and appears in real markup`,
      };
    }
  }
  return {
    ...receipt,
    verdict: "FALSE-PREMISE",
    detail: `self-scoped tier: none of the receipted selector's own classes (${receipt.receiptedClasses.map((c) => `.${c}`).join(", ")}) declare a 44px floor anywhere in the tree -- REFUTED, not silently accepted`,
  };
}

export function judgeReceipt(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>, allText: string): RosterRow {
  if (receipt.family === "other") {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c))" };
  }
  if (receipt.family === "render-gate") {
    return judgeRenderGate(receipt);
  }
  const mentioned = [...receipt.reason.matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string);
  const companion = mentioned.find((c) => !receipt.receiptedClasses.includes(c));
  if (!companion) {
    // DEC-393 wave-40: two more shapes get a real predicate before falling
    // to the generic "no companion class named" verdict.
    if (mentioned.length === 0) {
      const elementTypeRow = judgeElementTypeReason(receipt, allChunks);
      if (elementTypeRow) return elementTypeRow;
    } else if (receipt.family === "scoped") {
      return judgeSelfScoped(receipt, allChunks, allText);
    }
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "no companion class named in the reason (distinct from the receipted selector itself)" };
  }
  const tokenRe = new RegExp(`\\.${escapeRe(companion)}(?![\\w-])`);
  const matchingChunks = allChunks.filter((c) => tokenRe.test(c.selector));
  const bodies = matchingChunks.map((c) => c.body);
  if (bodies.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `companion .${companion} has no discoverable CSS rule` };
  }
  // Merge every rule body mentioning the companion token: this codebase's
  // idiom declares display:flex/align-items:center on a base (desktop) rule
  // and adds min-height/padding on a later grouped phone-media rule for the
  // SAME selector -- the floor is the CASCADE, not any one rule in isolation.
  const merged = bodies.join("\n");
  const flexFloored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  // Second tier (DEC-393 wave-34): a companion the sheet itself styles
  // alongside an `img` element selector carries no text to centre or pad
  // around, so its own width/height (or min-width/min-height) rules reaching
  // >=44px on BOTH axes satisfies the hit-box floor without flex/padding.
  const replacedContent = matchingChunks.some((c) => isReplacedContentSelector(c.selector));
  const widthHeightFloored = replacedContent && hasWidthHeightFloor(merged);
  const floored = flexFloored || widthHeightFloored;
  const present = new RegExp(`\\b${companion}\\b`).test(allText);
  if (floored && present) {
    const detail = flexFloored
      ? `companion .${companion} declares min-height:44px + centred flex + non-zero horizontal padding (merged across ${bodies.length} rule(s)) and appears in real markup`
      : `companion .${companion} is a replaced-content box (co-styled with an img selector) whose own width/height rules put both axes at >=44px (merged across ${bodies.length} rule(s)) and appears in real markup`;
    return { ...receipt, verdict: "VERIFIED", detail };
  }
  if (!floored) {
    return { ...receipt, verdict: "FALSE-PREMISE", detail: `companion .${companion} found (${bodies.length} rule(s), merged) but does not satisfy the 44px-floor grammar (min-height:44px + centred flex + non-zero horizontal padding, or, for a replaced-content companion, own width/height >=44px on both axes)` };
  }
  return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `companion .${companion} is floored but was not found in any product markup source` };
}

const FILES = productFiles();
const ALL_TEXT = FILES.map((f) => f.text).join("\n");
const ALL_CHUNKS = FILES.flatMap((f) => cssRegionsOf(f).flatMap((region) => ruleChunks(region)));
const RECEIPTS = allReceipts(FILES);
const ROSTER: RosterRow[] = RECEIPTS.map((r) => judgeReceipt(r, ALL_CHUNKS, ALL_TEXT));

// Ratchets (DEC-393 wave-30 amendment, task w30-b; re-measured wave-34,
// task w34-h; re-measured again wave-35, task w35-b). Seeded by measuring
// the real corpus once (98 receipts: 19 composition, 11 inline, 68 other) --
// docs/design/audit/tap-floor-exempt-premise-v12.md is the full roster.
// UNVERIFIABLE-PREMISE is expected to be large this wave (every `other`
// reason, and every composition/inline receipt this instrument's
// necessarily-narrow companion-name heuristic cannot resolve) -- it is a
// roster count, not a defect count, and is two-sided only so a future wave
// narrowing the instrument (or widening its grammar) re-measures honestly
// rather than drifting silently.
// FALSE-PREMISE is a real 44px defect count. Wave 30 found one instance
// (cards.css.ts:239, .chq-pub-headshot-fallback) and recorded it as a
// predicate-grammar mismatch rather than a missing CSS rule: a
// REPLACED-CONTENT companion (an img/fallback box filled by width/height)
// satisfies DESIGN-RULINGS' hit-box floor with no text to centre or pad
// around, which this instrument's flex+padding-only grammar could not see.
// Wave 34 gives the instrument a second, width/height-based floor-grammar
// tier for exactly that shape (a companion co-styled with an `img` element
// selector whose own width/height rules put both axes at >=44px) -- forced
// to -1 and re-measured, the row now resolves VERIFIED and the ceiling
// drops to 0.
//
// Wave 35 (task w35-b, DEC-393 wave-35 amendment): grounding the CFP
// intro-cta/identity-note inline links added two new `inline-in-prose`
// receipts -- src/routes/public/cfp.css.ts (one comment, two TOKEN-scoped
// empty rules for both anchors) and src/routes/tools.css.ts (one, for the
// docs /login reference) -- each a real, named exemption the
// SSR_UNFLOORED_TOKENS_CEILING scan (app/src/phone-tap-target-ssr.scan.test.ts)
// requires, but neither names a companion class (DEVIATIONS.md is the
// grounding authority for these three, not another floored control), so
// both resolve UNVERIFIABLE-PREMISE exactly like the population's `other`
// rows -- 98 receipts -> 100, 86 -> 88.
//
// Wave 36 (task w36-f, DEC-393 wave-36 amendment) gives three more of the
// UNVERIFIABLE-PREMISE receipts a real predicate: `modifier` (5),
// `scoped` (2) and `render-gate` (6), 13 receipts total, all previously
// filed under `other` purely because classifyFamily's first-word regex
// didn't recognise their reason's opening word. `modifier`/`scoped` route
// through the SAME unchanged companion floor-grammar tiers; `render-gate`
// gets its own two-tier predicate (named+existing receipt test, then
// falsified against both live 390 rosters). Forced to -1 and re-measured on
// its own branch: 10 of the 13 resolve VERIFIED (the 6 agenda.css
// render-gate receipts, the 2 docs-site.css.ts modifier receipts, the 2
// theme.ts modifier receipts); 2 stay UNVERIFIABLE-PREMISE
// (error-states.css.ts:46's modifier reason names element types --
// input/select/textarea/fieldset -- not a `.chq-*` companion class, so the
// companion predicate has nothing to resolve; submissions/detail.css:278's
// scoped reason names its OWN compound selector's own receipted class, not
// a distinct companion, for the same reason).
//
// One of the 13 -- contacts.css:596's `scoped` receipt -- resolves
// FALSE-PREMISE: it names .chq-contacts-drawer-actions as the container
// that "only ever renders <button> children", but that container itself
// declares no min-height/padding floor (it is a pure flex layout wrapper;
// the floor lives on its .chq-btn children, which the companion predicate
// does not follow transitively). This is a REAL 44px-floor-grammar defect
// in the receipt's premise, not an instrument bug -- recorded in
// docs/design/audit/tap-floor-exempt-premise-v12.md with the offending
// selector named, per that task's own instruction (do not repair product
// CSS in that lane). FALSE-PREMISE ceiling moves 0 -> 1.
//
// SUPERSEDED (DEC-393 wave-39, task w39-a): "do not repair product CSS in
// that lane" is retracted for this one row -- it was the campaign's last
// unowned non-zero exit-predicate ceiling, so this wave repairs the
// receipt in place (option (a): re-point the `scoped to` clause) rather
// than filing another roster row. The premise was false as written
// because it named `.chq-contacts-drawer-actions` (the pure flex
// wrapper, no floor of its own) as the floored companion; the real floor
// is `.chq-btn`, which carries a shared base rule (display:inline-flex;
// align-items:center; padding:10px 16px, app/src/styles.css) plus this
// file's own phone-media `.chq-contacts-drawer-actions-right .chq-btn`
// rule (min-height:48px; padding:0 16px). The receipt at contacts.css
// (immediately above `.chq-contacts-drawer-actions-right`) now names
// `.chq-btn` as the companion instead, and re-measuring resolves it
// VERIFIED. FALSE-PREMISE ceiling moves 1 -> 0.
//
// MEGABATCH COMPOSITION (wave-36 thunderdome): w35-b and w36-f both moved
// this constant from the same wave-34 base of 86, along disjoint axes --
// w35-b ADDED 2 rows to the roster (86 -> 88, two new inline-in-prose
// receipts in reason families w36-f never touches), w36-f REMOVED 11 from
// the roster (86 -> 75, the VERIFIED + FALSE-PREMISE rows that actually
// left). Neither branch's number is right for the merged tree: composing
// the two disjoint deltas gives 88 - 11 = 77. FALSE-PREMISE takes w36-f's
// 1 unchanged (w35-b introduced none; wave 34's replaced-content grammar
// tier had already resolved the population's only prior instance).
//
// Wave 40 (task w40-f, DEC-808): the two remaining named shapes get their
// own tiers. ELEMENT-TYPE (`judgeElementTypeReason`): a reason naming a
// `/`-joined list of bare HTML element types resolves VERIFIED only when
// EVERY named type is reached by a selector-list arm that IS that bare type
// (never a descendant chain merely containing it) declaring
// min-height:44px somewhere in the tree; falls back to UNVERIFIABLE-PREMISE,
// never a silent VERIFIED, the moment one named type is unreached.
// SELF-SCOPED (`judgeSelfScoped`): a `scoped` reason naming only a token
// already in its own `receiptedClasses` (no distinct companion) is checked
// against ALL of the receipted compound selector's own classes, not just
// the self-named one -- REFUTED to FALSE-PREMISE, not silently accepted,
// the moment none of them declare a floor anywhere.
//
// Forced to -1 and re-measured standalone (never by arithmetic on the
// wave-36 composition -- the exact trap this constant already fell into
// once): 76, down from 77 by exactly one row.
// - `error-states.css.ts:46` STAYS UNVERIFIABLE-PREMISE: `input`/`select`/
//   `textarea` are each reached by theme.ts's own bare-type phone-media
//   rule (`min-height: 44px`), but `fieldset` is reached by NO rule
//   anywhere in the tree at all (a fieldset is a grouping container, never
//   itself a tap target -- `.chq-settings-panel fieldset label` reaches
//   44px, but that 44px belongs to the LABEL, not the fieldset, and the arm
//   grammar correctly refuses to credit it). The reason's own premise is
//   broader than the tree supports; this is an honest gap, not an
//   instrument miss -- recorded in the audit doc below.
// - `submissions/detail.css:278` now resolves VERIFIED: its receipted
//   compound selector is `.chq-detail-participant-row-actions
//   .chq-link-button`, and while the reason names only the container
//   (already in `receiptedClasses`, so the OLD companion search found
//   nothing), the OTHER receipted class -- `.chq-link-button` -- carries a
//   real floor in `app/src/styles.css`'s phone-media block (`min-height:
//   44px; min-width: 44px; display: flex; align-items: center; padding: 0
//   6px;`), a sheet the receipt's own file never touches. The self-scoped
//   tier's "check ALL receipted classes, not just the named one" rule is
//   exactly what finds it.
// UNVERIFIABLE-PREMISE: 77 -> 76. FALSE-PREMISE: neither new tier touched
// that ceiling; it sits at 0 because the DEC-393 wave-39 repair above
// re-pointed contacts.css's `scoped` receipt at `.chq-btn`, which the
// self-scoped tier likewise resolves VERIFIED.
export const TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING = 76;
export const TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING = 0;

describe("tap-floor-exempt receipt premises are executable (DEC-393 wave-30 amendment)", () => {
  it("this instrument is DEC-393's own wave-30 amendment build (durable decision doc, cited by directory per DEC-976 -- a DEC_NNN registry constant is mutable and asserts nothing durable)", () => {
    void DEC_393; // compile-checked dependency marker only; text assertions below target the durable doc.
    const ruling = readFileSync(join(__dirname, "..", "src", "decisions-data", "DEC-393.md"), "utf8");
    expect(ruling).toContain(
      "## Amendment (wave 30): a tap-floor-exempt reason is a premise about the tree, and its verifier must be named in the receipt and executable by a scan",
    );
    expect(ruling).toContain(
      "a tap-floor-exempt reason is a premise about the tree, and its verifier must be named in the receipt and executable by a scan",
    );
  });

  it("population sanity: walked a non-trivial number of real receipts (vacuous-population tripwire, DEC-999)", () => {
    expect(RECEIPTS.length).toBeGreaterThanOrEqual(90);
  });

  it("positive control: a composition receipt whose named companion IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-companion is floored",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-companion", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-companion">x</a>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control: a composition receipt whose named companion is NOT floored resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-companion is floored",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-companion", body: "color: red;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-companion">x</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("negative control: a receipt naming no companion class resolves UNVERIFIABLE-PREMISE, never a silent pass", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- always paired with its parent, no class named",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const verdict = judgeReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("negative control: a receipt whose family has no predicate this wave (`other`) is UNVERIFIABLE-PREMISE, never VERIFIED by omission", () => {
    const receipt: Receipt = { file: "synthetic.css", line: 1, reason: "render-gate -- never mounts here", receiptedClasses: [], family: "other" };
    const verdict = judgeReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("the worked example: agenda.css.ts's day-footer inline receipt now names its floored sibling and resolves VERIFIED", () => {
    const row = ROSTER.find((r) => r.file === "src/routes/public/css/agenda.css.ts" && r.reason.startsWith("inline-in-prose -- DEC-393 wave-30"));
    expect(row, "the rewritten day-footer receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
  });

  it("the wave-34 worked example: cards.css.ts's headshot-link composition receipt names its replaced-content companion and now resolves VERIFIED", () => {
    const row = ROSTER.find((r) => r.file === "src/routes/public/css/cards.css.ts" && r.receiptedClasses.includes("chq-pub-headshot-link"));
    expect(row, "the headshot-link receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
    expect(row?.detail).toMatch(/replaced-content/);
  });

  it("positive control (DEC-393 wave-34, second tier): a replaced-content companion (co-styled with an img selector) reaching >=44px on both axes resolves VERIFIED with no flex/padding at all", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-replaced-companion carries the box",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-wrap img, .chq-fake-replaced-companion", body: "width:64px; height:64px; object-fit:cover;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-replaced-companion"></div>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (i, DEC-393 wave-34): a replaced-content companion sized under 44px on an axis still resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-small-replaced-companion carries the box",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-wrap img, .chq-fake-small-replaced-companion", body: "width:40px; height:40px; object-fit:cover;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-small-replaced-companion"></div>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("negative control (ii, DEC-393 wave-34): a TEXT-BEARING companion sized >=44px with no flex/padding and no img pairing still resolves FALSE-PREMISE -- the new tier never weakens the existing grammar for text controls", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-text-companion carries the box",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-text-companion", body: "width:100px; height:100px; font-size:14px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-text-companion">Some label text</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  // DEC-393 wave-36 (task w36-f): three more reason families get a real
  // predicate. `modifier` and `scoped` are routed through the SAME
  // unchanged companion floor-grammar tiers exercised above -- these
  // controls prove the family label alone (not the reason text) is what
  // used to fall to `other`, and now doesn't. `render-gate` gets its own
  // two-tier predicate (judgeRenderGate), exercised via dependency
  // injection so no synthetic control ever touches a real file on disk.

  it("positive control (modifier): a modifier receipt whose named base class IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto .chq-fake-modifier-base, which already carries the 44px floor",
      receiptedClasses: ["chq-fake-modifier-target"],
      family: "modifier",
    };
    const chunks = [{ selector: ".chq-fake-modifier-base", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-modifier-base">x</a>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (modifier): a modifier receipt whose named base class is NOT floored resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto .chq-fake-unfloored-base, which already carries the 44px floor",
      receiptedClasses: ["chq-fake-modifier-target-2"],
      family: "modifier",
    };
    const chunks = [{ selector: ".chq-fake-unfloored-base", body: "color: red;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-unfloored-base">x</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("positive control (scoped): a scoped receipt whose named container IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-scoped-container, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-scoped-target"],
      family: "scoped",
    };
    const chunks = [{ selector: ".chq-fake-scoped-container", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-scoped-container">x</div>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (scoped): naming a nonexistent container stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-nonexistent-container, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-scoped-target-2"],
      family: "scoped",
    };
    const verdict = judgeReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("positive control (render-gate): a real test file mentioning the component, token absent from both rosters, resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "render-gate -- FakeGate.tsx never mounts at phone width; verified by fake/fake-render-gate.receipt.test.ts.",
      receiptedClasses: ["chq-fake-render-gate-target"],
      family: "render-gate",
    };
    const verdict = judgeRenderGate(receipt, {
      exists: () => true,
      read: () => "describe('FakeGate.tsx never mounts on phone', () => {});",
      rosterA: "some other selector .chq-unrelated-thing appears here",
      rosterB: "another unrelated roster body",
    });
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (render-gate): a real test file mentioning the component, but the token DOES appear in a live 390 roster, resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "render-gate -- FakeGate.tsx never mounts at phone width; verified by fake/fake-render-gate.receipt.test.ts.",
      receiptedClasses: ["chq-fake-render-gate-target"],
      family: "render-gate",
    };
    const verdict = judgeRenderGate(receipt, {
      exists: () => true,
      read: () => "describe('FakeGate.tsx never mounts on phone', () => {});",
      rosterA: "the 390 sweep found .chq-fake-render-gate-target rendered at phone width",
      rosterB: "another unrelated roster body",
    });
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("negative control (render-gate): a receipt test file that does not exist on disk stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "render-gate -- FakeGate.tsx never mounts at phone width; verified by fake/nonexistent.receipt.test.ts.",
      receiptedClasses: ["chq-fake-render-gate-target-3"],
      family: "render-gate",
    };
    const verdict = judgeRenderGate(receipt, { exists: () => false, read: () => "", rosterA: "", rosterB: "" });
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("the wave-36 worked example: all six agenda.css render-gate receipts (DayGrid/SessionCard) resolve VERIFIED against the real receipt test and the real live 390 rosters", () => {
    const rows = ROSTER.filter((r) => r.file === "app/src/pages/agenda/agenda.css" && r.family === "render-gate");
    expect(rows.length).toBe(6);
    for (const row of rows) {
      expect(row.verdict, `${row.file}:${row.line} -- ${row.detail}`).toBe("VERIFIED");
    }
  });

  // DEC-393 wave-40 (task w40-f): two more floor-grammar tiers, for the
  // exact two shapes the wave-36 comment named as un-resolvable.

  it("positive control (element-type): a modifier reason naming element types ALL reached by a min-height:44px rule resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto a real form control (input/select), which already carries its own height/floor -- a per-token text scan can't follow that composition (fake-citation.test.ts SOME_CEILING, task fake)",
      receiptedClasses: ["chq-fake-invalid"],
      family: "modifier",
    };
    const chunks = [
      { selector: "input[type=text], select", body: "padding: 0.4rem 0.6rem;" },
      { selector: "input[type=text], select", body: "min-height: 44px;" },
    ];
    const verdict = judgeReceipt(receipt, chunks, "");
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (element-type): a modifier reason naming a type NO rule reaches does not resolve -- stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto a real form control (input/select), which already carries its own height/floor -- a per-token text scan can't follow that composition (fake-citation.test.ts SOME_CEILING, task fake)",
      receiptedClasses: ["chq-fake-invalid-2"],
      family: "modifier",
    };
    const chunks = [{ selector: "input[type=text]", body: "min-height: 44px;" }]; // "select" is never reached
    const verdict = judgeReceipt(receipt, chunks, "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
    expect(verdict.detail).toMatch(/select/);
  });

  it("the worked example (element-type): error-states.css.ts's modifier reason names element types, not a companion class", () => {
    const row = ROSTER.find((r) => r.file === "src/views/error-states.css.ts" && r.family === "modifier");
    expect(row, "the element-type receipt must still be in the swept population").toBeDefined();
    // `fieldset` never gets a min-height:44px rule anywhere in the tree (a
    // fieldset is a grouping container, not itself a tap target) -- so this
    // tier honestly cannot resolve it, and it stays UNVERIFIABLE-PREMISE
    // rather than being forced to a verdict the tree does not support.
    expect(row?.verdict).toBe("UNVERIFIABLE-PREMISE");
    expect(row?.detail).toMatch(/element-type tier/);
  });

  it("positive control (self-scoped): a scoped reason naming its OWN receipted token resolves VERIFIED when that token's own merged rule declares the floor", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-self-scoped-target, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-self-scoped-target"],
      family: "scoped",
    };
    const chunks = [{ selector: ".chq-fake-self-scoped-target", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-self-scoped-target">x</div>');
    expect(verdict.verdict).toBe("VERIFIED");
    expect(verdict.detail).toMatch(/self-scoped tier/);
  });

  it("positive control (self-scoped, compound): the OTHER class in the receipted compound selector carries the floor, even though the reason names only the self token", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-scoped-wrap, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-scoped-wrap", "chq-fake-scoped-child"],
      family: "scoped",
    };
    const chunks = [
      { selector: ".chq-fake-scoped-wrap", body: "display:flex; gap:12px;" },
      { selector: ".chq-fake-scoped-wrap .chq-fake-scoped-child", body: "display:flex; align-items:center; min-height:44px; padding:0 6px;" },
    ];
    const verdict = judgeReceipt(receipt, chunks, '<button class="chq-fake-scoped-child">x</button>');
    expect(verdict.verdict).toBe("VERIFIED");
    expect(verdict.detail).toMatch(/chq-fake-scoped-child/);
  });

  it("negative control (self-scoped): none of the receipted selector's own classes declare a floor anywhere -- REFUTED to FALSE-PREMISE, never silently accepted", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-unfloored-scoped-target, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-unfloored-scoped-target"],
      family: "scoped",
    };
    const chunks = [{ selector: ".chq-fake-unfloored-scoped-target", body: "display:flex; gap:12px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-unfloored-scoped-target">x</div>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
    expect(verdict.detail).toMatch(/self-scoped tier/);
  });

  it("the worked example (self-scoped): submissions/detail.css's scoped reason resolves VERIFIED via its compound selector's OTHER class (.chq-link-button, floored in app/src/styles.css)", () => {
    const row = ROSTER.find((r) => r.file === "app/src/pages/submissions/detail.css" && r.family === "scoped");
    expect(row, "the self-scoped receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
    expect(row?.detail).toMatch(/self-scoped tier/);
  });

  it(`FALSE-PREMISE ceiling: at most ${TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING} receipt(s) claim a companion floor that isn't real`, () => {
    const offenders = ROSTER.filter((r) => r.verdict === "FALSE-PREMISE");
    if (offenders.length > TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING) {
      throw new Error(
        `${offenders.length} FALSE-PREMISE receipt(s), above TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING=` +
          `${TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING}:\n` +
          offenders.map((o) => `  ${o.file}:${o.line} — ${o.detail}`).join("\n"),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING);
  });

  it("the FALSE-PREMISE ceiling is not stale (two-sided ratchet, DEC-808)", () => {
    const offenders = ROSTER.filter((r) => r.verdict === "FALSE-PREMISE");
    expect(offenders.length).toBe(TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING);
  });

  it(`UNVERIFIABLE-PREMISE ceiling: exactly ${TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING} receipt(s) are roster rows this wave's instrument cannot settle (two-sided ratchet)`, () => {
    const roster = ROSTER.filter((r) => r.verdict === "UNVERIFIABLE-PREMISE");
    expect(roster.length).toBe(TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING);
  });

  it("every receipt in the population resolves to exactly one of the three verdicts (no receipt is silently dropped)", () => {
    expect(ROSTER.length).toBe(RECEIPTS.length);
    for (const row of ROSTER) {
      expect(["VERIFIED", "UNVERIFIABLE-PREMISE", "FALSE-PREMISE"]).toContain(row.verdict);
    }
  });
});
