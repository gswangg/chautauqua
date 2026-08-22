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
import { readFileSync, readdirSync, statSync } from "node:fs";
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

export type ReasonFamily = "composition" | "inline" | "other";
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
    const family: ReasonFamily = /^composition$/i.test(firstWord)
      ? "composition"
      : /^inline/i.test(firstWord)
        ? "inline"
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

export function judgeReceipt(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>, allText: string): RosterRow {
  if (receipt.family === "other") {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c))" };
  }
  const mentioned = [...receipt.reason.matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string);
  const companion = mentioned.find((c) => !receipt.receiptedClasses.includes(c));
  if (!companion) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "no companion class named in the reason (distinct from the receipted selector itself)" };
  }
  const tokenRe = new RegExp(`\\.${escapeRe(companion)}(?![\\w-])`);
  const bodies = allChunks.filter((c) => tokenRe.test(c.selector)).map((c) => c.body);
  if (bodies.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `companion .${companion} has no discoverable CSS rule` };
  }
  // Merge every rule body mentioning the companion token: this codebase's
  // idiom declares display:flex/align-items:center on a base (desktop) rule
  // and adds min-height/padding on a later grouped phone-media rule for the
  // SAME selector -- the floor is the CASCADE, not any one rule in isolation.
  const merged = bodies.join("\n");
  const floored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  const present = new RegExp(`\\b${companion}\\b`).test(allText);
  if (floored && present) {
    return { ...receipt, verdict: "VERIFIED", detail: `companion .${companion} declares min-height:44px + centred flex + non-zero horizontal padding (merged across ${bodies.length} rule(s)) and appears in real markup` };
  }
  if (!floored) {
    return { ...receipt, verdict: "FALSE-PREMISE", detail: `companion .${companion} found (${bodies.length} rule(s), merged) but does not satisfy the 44px-floor grammar (min-height:44px + centred flex + non-zero horizontal padding)` };
  }
  return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `companion .${companion} is floored but was not found in any product markup source` };
}

const FILES = productFiles();
const ALL_TEXT = FILES.map((f) => f.text).join("\n");
const ALL_CHUNKS = FILES.flatMap((f) => cssRegionsOf(f).flatMap((region) => ruleChunks(region)));
const RECEIPTS = allReceipts(FILES);
const ROSTER: RosterRow[] = RECEIPTS.map((r) => judgeReceipt(r, ALL_CHUNKS, ALL_TEXT));

// Ratchets (DEC-393 wave-30 amendment, task w30-b). Seeded by measuring the
// real corpus once (98 receipts: 19 composition, 11 inline, 68 other) --
// docs/design/audit/tap-floor-exempt-premise-v12.md is the full roster.
// UNVERIFIABLE-PREMISE is expected to be large this wave (every `other`
// reason, and every composition/inline receipt this instrument's
// necessarily-narrow companion-name heuristic cannot resolve) -- it is a
// roster count, not a defect count, and is two-sided only so a future wave
// narrowing the instrument (or widening its grammar) re-measures honestly
// rather than drifting silently. FALSE-PREMISE is a real 44px defect count;
// the one instance this wave found (cards.css.ts:239, .chq-pub-headshot-
// fallback) is a REPLACED-CONTENT sizing claim -- an img/fallback box filled
// by width/height, not this lens's flex+padding grammar -- so it is a
// predicate-grammar mismatch, not a missing CSS rule, and is recorded for
// the next wave rather than mis-repaired here (see the audit doc).
export const TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING = 86;
export const TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING = 1;

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
