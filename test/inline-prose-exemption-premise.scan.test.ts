// DEC-393 wave-35 amendment: "an `inline-in-prose` tap-floor exemption is a
// GROUNDING claim, and the ladder for an ungrounded one is floor / twin /
// DEVIATIONS -- never silence." test/tap-floor-exempt-premise.scan.test.ts
// (DEC-393 wave-30 amendment) already makes a `composition` receipt's
// premise executable (does the named companion class carry a real 44px
// floor?) but treats every `inline-*` receipt as UNVERIFIABLE-PREMISE by
// construction, because the wave-30 predicate never looks past whether the
// reason names a companion CLASS -- and only one `inline-*` receipt in the
// whole tree (src/routes/public/css/agenda.css.ts's day-footer link) ever
// does. That is exactly the gap the wave-35 amendment closes: the day-footer
// receipt's own reason text names `.chq-pub-day-pill` as the sibling that
// "build[s] their href from the SAME agendaQs(current, {day}) helper" -- a
// GROUNDING CLAIM the wave-30 instrument's companion-floor check already
// happens to verify, it just never asked the question for the `inline`
// family. This file asks it, as its own sibling instrument (this task does
// not edit test/tap-floor-exempt-premise.scan.test.ts -- owned by in-flight
// v12m-w32-e / v12m-w34-h).
//
// POPULATION (derived, never hand-listed -- DEC-180/DEC-808): every real
// `tap-floor-exempt: ...` comment (CSS `/* ... */` and JSX `{/* ... */}`
// both, matched via the real non-nested block-comment grammar -- never a
// raw substring search, so a `//` line or a string/regex literal that
// merely mentions the token is never misread as a receipt) under src/** and
// app/src/**, excluding `*.test.ts(x)` and this campaign's own scan-library
// directories (app/src/phone-tap-target-scan/, app/src/phone-overflow-scan/
// -- their prose ABOUT the grammar contains the literal token as
// documentation, not a real receipt, the same exclusion the wave-30 sibling
// already verified by hand), whose REASON's first word starts with `inline`
// (case-insensitive, trailing punctuation stripped) -- the `inline-in-prose`
// family and any future `inline-*` variant.
//
// GRADING (DEC-393 wave-35 amendment): a receipt is GROUNDED when its
// reason text names a companion `.chq-[\w-]+` class (distinct from any
// selector the receipt itself decorates) that (a) is discoverable in a real
// CSS rule somewhere in the swept population, (b) that rule -- merged
// across EVERY rule mentioning the selector, the same merge idiom the
// wave-30 sibling uses because this codebase's idiom splits a base
// (desktop) declaration from a later grouped phone-media one for the same
// selector -- satisfies the full 44px floor grammar (min-height>=44px +
// centred flex + non-zero horizontal padding), and (c) the companion class
// token actually appears in real markup/CSS text. UNGROUNDED is reserved
// for a receipt that DOES name a companion class but that companion fails
// the floor grammar (a real, checkable defect). A receipt whose reason
// names NO companion class token is UNVERIFIABLE -- this instrument (like
// its wave-30 sibling) has no destination-reachability predicate for a bare
// English claim ("Sign in to the speaker portal", "Create an account", the
// filename-row link) with no `.chq-*` grounding reference in its own text;
// it is a roster row, never a silent pass (clause (c)'s discipline, ported
// unchanged).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
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

export type Verdict = "GROUNDED" | "UNGROUNDED" | "UNVERIFIABLE";

export interface InlineReceipt {
  file: string;
  line: number;
  reason: string;
  receiptedClasses: string[];
}

export interface InlineRosterRow extends InlineReceipt {
  verdict: Verdict;
  detail: string;
}

/** Every real `/* tap-floor-exempt: ... *\/` (or `{/* ... *\/}`) comment
 * whose reason's first word starts with `inline` -- matched against the
 * real (non-nested block-comment) grammar, never a raw substring search
 * (same discipline as the wave-30 sibling instrument). */
function extractInlineReceipts(rel: string, text: string): InlineReceipt[] {
  const commentRe = /\/\*[\s\S]*?\*\//g;
  const out: InlineReceipt[] = [];
  let m: RegExpExecArray | null;
  while ((m = commentRe.exec(text)) !== null) {
    const stripped = m[0].replace(/^\/\*+\s*/, "");
    if (!/^tap-floor-exempt:/.test(stripped)) continue;
    const reason = stripped.replace(/^tap-floor-exempt:\s*/, "").replace(/\*\/$/, "").trim();
    const firstWord = reason.trim().split(/\s+/)[0]?.replace(/[,.:;]+$/, "") ?? "";
    if (!/^inline/i.test(firstWord)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const selMatch = after.match(/^[\s}]*([^{}\n][^{]*)\{/);
    const receiptedClasses =
      selMatch && selMatch[1] ? [...selMatch[1].matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string) : [];
    out.push({ file: rel, line, reason, receiptedClasses });
  }
  return out;
}

export function allInlineReceipts(files: ProductFile[]): InlineReceipt[] {
  return files.flatMap((f) => extractInlineReceipts(f.path, f.text));
}

/** Comment-stripped CSS regions of a file: the whole text for a `.css`
 * file, or every backtick template-literal body for a `.ts`/`.tsx` file.
 * Comments are stripped via the SHARED stripper (DEC-613: never a private
 * copy). */
function cssRegionsOf(f: ProductFile): string[] {
  if (f.path.endsWith(".css")) return [stripCssComments(f.text)];
  const regions: string[] = [];
  const re = /`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f.text)) !== null) regions.push(stripCssComments(m[1] as string));
  return regions;
}

/** Non-nested `selector { body }` matcher (same shape as the wave-30
 * sibling and app/src/phone-tap-target-scan/core.ts's narrowMediaRules). */
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
 * align-items/justify-content centring this lens cares about (same
 * reasoning as the wave-30 sibling: a strict `flex`-only test would
 * wrongly fail this codebase's `inline-flex` pill/chip controls). */
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

export function judgeInlineReceipt(
  receipt: InlineReceipt,
  allChunks: Array<{ selector: string; body: string }>,
  allText: string,
): InlineRosterRow {
  const mentioned = [...receipt.reason.matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string);
  const companion = mentioned.find((c) => !receipt.receiptedClasses.includes(c));
  if (!companion) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: "reason names no companion .chq-* class or destination-grounding reference this instrument can check (roster row, DEC-393 wave-35 amendment)",
    };
  }
  const tokenRe = new RegExp(`\\.${escapeRe(companion)}(?![\\w-])`);
  const bodies = allChunks.filter((c) => tokenRe.test(c.selector)).map((c) => c.body);
  if (bodies.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE", detail: `named companion .${companion} has no discoverable CSS rule` };
  }
  const merged = bodies.join("\n");
  const floored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  const present = new RegExp(`\\b${companion}\\b`).test(allText);
  if (floored && present) {
    return {
      ...receipt,
      verdict: "GROUNDED",
      detail: `named companion .${companion} declares min-height:44px + centred flex + non-zero horizontal padding (merged across ${bodies.length} rule(s)) and reaches the same destination on the same surface`,
    };
  }
  if (!floored) {
    return { ...receipt, verdict: "UNGROUNDED", detail: `named companion .${companion} found (${bodies.length} rule(s), merged) but does not satisfy the 44px-floor grammar` };
  }
  return { ...receipt, verdict: "UNVERIFIABLE", detail: `named companion .${companion} is floored but was not found in any product markup source` };
}

const FILES = productFiles();
const ALL_TEXT = FILES.map((f) => f.text).join("\n");
const ALL_CHUNKS = FILES.flatMap((f) => cssRegionsOf(f).flatMap((region) => ruleChunks(region)));
const RECEIPTS = allInlineReceipts(FILES);
const ROSTER: InlineRosterRow[] = RECEIPTS.map((r) => judgeInlineReceipt(r, ALL_CHUNKS, ALL_TEXT));

// Ratchets (DEC-393 wave-35 amendment, task v12m-w35-a). Seeded by forcing
// both to -1, running this file, and reading the printed roster back --
// never by arithmetic. docs/design/audit/inline-prose-exemption-v12.md is
// the full roster. UNVERIFIABLE is a roster count (an instrument-coverage
// fact), not a defect count -- every `inline-*` receipt whose reason names
// no companion `.chq-*` class falls here, including the several receipts
// an independent reviewer measured live as sub-floor (submit-views.tsx's
// "Create an account" / "Sign in to the speaker portal" / "Log in" links,
// portal/tasks/views.tsx's filename row) -- this wave's instrument has no
// predicate for a bare-English grounding claim with no class token in its
// own reason text, so it rosters rather than silently passing them
// (clause (c) discipline, ported unchanged from the wave-30 sibling). Only
// one receipt in the whole population names a companion class in its own
// reason text (src/routes/public/css/agenda.css.ts's day-footer link,
// `.chq-pub-day-pill`) and it resolves GROUNDED. UNGROUNDED is a real
// defect count and currently reads 0 because no receipt that DOES name a
// companion class fails the floor check.
export const INLINE_PROSE_UNGROUNDED_CEILING = 0;
// MEGABATCH COMPOSITION (wave-36 thunderdome): 10 -> 11. w35-a seeded this
// at 10 against a tree that did not yet carry w35-b's grounding work; w35-b
// then added new `inline-in-prose` tap-floor-exempt receipts (the CFP
// intro-cta/identity-note anchors and the docs /login reference) which this
// sibling instrument also enumerates, and which name no companion class, so
// they land UNVERIFIABLE here exactly as they do in the wave-30 sibling.
// Neither branch's number is right for the merged tree; 11 is the merged
// suite's own printed count.
export const INLINE_PROSE_UNVERIFIABLE_CEILING = 11;

describe("inline-in-prose tap-floor-exempt receipts are grounding claims (DEC-393 wave-35 amendment)", () => {
  it("population sanity: walked a non-trivial number of real inline receipts (vacuous-population tripwire, DEC-999)", () => {
    expect(RECEIPTS.length).toBeGreaterThanOrEqual(8);
  });

  it("positive control: an inline receipt whose named companion IS floored resolves GROUNDED", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.css",
      line: 1,
      reason: "inline-in-prose -- .chq-fake-companion reaches the same destination",
      receiptedClasses: ["chq-fake-target"],
    };
    const chunks = [{ selector: ".chq-fake-companion", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeInlineReceipt(receipt, chunks, '<a class="chq-fake-companion">x</a>');
    expect(verdict.verdict).toBe("GROUNDED");
  });

  it("negative control: an inline receipt whose named companion is NOT floored resolves UNGROUNDED", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.css",
      line: 1,
      reason: "inline-in-prose -- .chq-fake-companion reaches the same destination",
      receiptedClasses: ["chq-fake-target"],
    };
    const chunks = [{ selector: ".chq-fake-companion", body: "color: red;" }];
    const verdict = judgeInlineReceipt(receipt, chunks, '<a class="chq-fake-companion">x</a>');
    expect(verdict.verdict).toBe("UNGROUNDED");
  });

  it("negative control: an inline receipt naming no companion class resolves UNVERIFIABLE, never a silent pass", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.css",
      line: 1,
      reason: "inline-in-prose -- a phrase inside a running sentence",
      receiptedClasses: ["chq-fake-target"],
    };
    const verdict = judgeInlineReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE");
  });

  it("the worked example: agenda.css.ts's day-footer inline receipt names its floored day-pill sibling and resolves GROUNDED", () => {
    const row = ROSTER.find((r) => r.file === "src/routes/public/css/agenda.css.ts" && r.reason.startsWith("inline-in-prose -- DEC-393 wave-30"));
    expect(row, "the day-footer inline receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("GROUNDED");
  });

  it(`UNGROUNDED ceiling: at most ${INLINE_PROSE_UNGROUNDED_CEILING} receipt(s) name a companion whose floor claim is false`, () => {
    const offenders = ROSTER.filter((r) => r.verdict === "UNGROUNDED");
    if (offenders.length > INLINE_PROSE_UNGROUNDED_CEILING) {
      throw new Error(
        `${offenders.length} UNGROUNDED receipt(s), above INLINE_PROSE_UNGROUNDED_CEILING=${INLINE_PROSE_UNGROUNDED_CEILING}:\n` +
          offenders.map((o) => `  ${o.file}:${o.line} — ${o.detail}`).join("\n"),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(INLINE_PROSE_UNGROUNDED_CEILING);
  });

  it("the UNGROUNDED ceiling is not stale (two-sided ratchet, DEC-808)", () => {
    const offenders = ROSTER.filter((r) => r.verdict === "UNGROUNDED");
    expect(offenders.length).toBe(INLINE_PROSE_UNGROUNDED_CEILING);
  });

  it(`UNVERIFIABLE ceiling: exactly ${INLINE_PROSE_UNVERIFIABLE_CEILING} receipt(s) are roster rows this wave's instrument cannot settle (two-sided ratchet)`, () => {
    const roster = ROSTER.filter((r) => r.verdict === "UNVERIFIABLE");
    expect(roster.length).toBe(INLINE_PROSE_UNVERIFIABLE_CEILING);
  });

  it("every receipt in the population resolves to exactly one of the three verdicts (no receipt is silently dropped)", () => {
    expect(ROSTER.length).toBe(RECEIPTS.length);
    for (const row of ROSTER) {
      expect(["GROUNDED", "UNGROUNDED", "UNVERIFIABLE"]).toContain(row.verdict);
    }
  });
});
