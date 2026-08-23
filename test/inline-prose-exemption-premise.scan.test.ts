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
import { DEC_393 } from "../src/decisions";

void DEC_393; // compile-checked dependency marker only (rung 3, wave-42 amendment); text assertions below target the durable doc.

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

export type Verdict = "GROUNDED" | "UNGROUNDED" | "UNVERIFIABLE" | "GROUNDED-BY-DEVIATION";

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

// ---------------------------------------------------------------------------
// Rung 3 (DEC-393 wave-42 amendment): a receipt with no companion class can
// still be GROUNDED-BY-DEVIATION when its reason cites a real DEVIATIONS.md
// section whose own body text names one of the receipt's own `chq-` class
// tokens verbatim. Parsed from the real file on disk (never a fixture copy)
// -- `## N.` headings, extent running to the next heading or EOF.
// ---------------------------------------------------------------------------

export interface DeviationSection {
  number: number;
  body: string;
}

const HEADING_RE = /^## (\d+)\./gm;

export function parseDeviationsSections(text: string): DeviationSection[] {
  const headings: Array<{ number: number; headingStart: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(text)) !== null) {
    headings.push({ number: Number(m[1]), headingStart: m.index, bodyStart: m.index + m[0].length });
  }
  return headings.map((h, i) => ({
    number: h.number,
    body: text.slice(h.bodyStart, i + 1 < headings.length ? headings[i + 1]!.headingStart : text.length),
  }));
}

/** Every `chq-` class token this receipt can claim as "its own": whatever
 * selector it directly decorates, plus any BARE (not `.`- or `#`-prefixed)
 * `chq-` token in its own reason text. A `.`/`#`-prefixed token is always a
 * REFERENCE to some other selector or anchor id (a companion candidate
 * rung 2 already tried, or a destination id like `#chq-cfp-submit-form`
 * mentioned in passing) -- never this receipt's own token. This mirrors the
 * DEC-996 wave-35 authoring convention itself: the receipt's own class is
 * deliberately written bare in these reasons ("chq-cfp-intro-cta-link, no
 * leading dot here -- a dotted literal reads as a grounding claim to this
 * file's own scan, which this receipt deliberately is not") specifically so
 * it is never misread as a companion. */
function ownTokensOf(receipt: InlineReceipt): string[] {
  const out = new Set<string>(receipt.receiptedClasses);
  for (const m of receipt.reason.matchAll(/(?<![.#])\bchq-[\w-]+\b/g)) out.add(m[0]);
  return [...out];
}

const DEVIATIONS_CITATION_RE = /DEVIATIONS\.md['’]?s?\s*(?:§|section\s+)(\d+)/i;

function judgeByDeviation(receipt: InlineReceipt, sections: DeviationSection[]): InlineRosterRow {
  const cite = receipt.reason.match(DEVIATIONS_CITATION_RE);
  if (!cite) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: "reason names no companion .chq-* class and cites no DEVIATIONS.md section number (rung 1/2/3 all fail)",
    };
  }
  const num = Number(cite[1]);
  const section = sections.find((s) => s.number === num);
  if (!section) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: `cites DEVIATIONS.md §${num}, but no such "## ${num}." heading exists in docs/design/DEVIATIONS.md (rung 3 fails: dead section citation)`,
    };
  }
  const tokens = ownTokensOf(receipt);
  const namedToken = tokens.find((t) => section.body.includes(t));
  if (!namedToken) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: `cites DEVIATIONS.md §${num} (a real section), but that section's body names none of this receipt's own chq- class token(s) [${tokens.join(", ") || "none"}] (rung 3 fails: unnamed receipt)`,
    };
  }
  return {
    ...receipt,
    verdict: "GROUNDED-BY-DEVIATION",
    detail: `cites DEVIATIONS.md §${num}, which names this receipt's own .${namedToken} verbatim (rung 3: recorded deviation, DEC-393 wave-35/42 amendments)`,
  };
}

/** Rung 0 (DEC-393 wave-52 amendment): a receipt can ground itself, with no
 * companion at all, when its OWN receipted class(es) -- merged across EVERY
 * rule in the swept corpus whose selector mentions any of those tokens
 * (this codebase's cascade-merge idiom: a base/desktop rule declares
 * flex/centring, a later grouped phone-media rule adds min-height/padding
 * for the SAME selector, and the floor lives in the cascade, not any one
 * rule) -- already satisfy the full 44px-floor grammar (min-height>=44px +
 * centred flex + non-zero horizontal padding). This runs BEFORE the
 * companion-class search (rung 2) and before the UNVERIFIABLE/rung-3
 * fallthrough, because a receipt that floors itself needs no other class's
 * testimony at all. */
function selfFloored(receipt: InlineReceipt, allChunks: Array<{ selector: string; body: string }>): boolean {
  if (receipt.receiptedClasses.length === 0) return false;
  const bodies: string[] = [];
  for (const token of receipt.receiptedClasses) {
    const tokenRe = new RegExp(`\\.${escapeRe(token)}(?![\\w-])`);
    for (const c of allChunks) {
      if (tokenRe.test(c.selector)) bodies.push(c.body);
    }
  }
  if (bodies.length === 0) return false;
  const merged = bodies.join("\n");
  return hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
}

export function judgeInlineReceipt(
  receipt: InlineReceipt,
  allChunks: Array<{ selector: string; body: string }>,
  allText: string,
  deviationSections: DeviationSection[] = [],
): InlineRosterRow {
  if (selfFloored(receipt, allChunks)) {
    return {
      ...receipt,
      verdict: "GROUNDED",
      detail: `own receipted class(es) [${receipt.receiptedClasses.join(", ")}] satisfy min-height:44px + centred flex + non-zero horizontal padding, merged across every matching rule in the swept corpus (self-floored, no companion needed, DEC-393 wave-52 amendment)`,
    };
  }
  const mentioned = [...receipt.reason.matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string);
  const companion = mentioned.find((c) => !receipt.receiptedClasses.includes(c));
  if (!companion) {
    return judgeByDeviation(receipt, deviationSections);
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
const DEVIATIONS_TEXT = readFileSync(join(REPO_ROOT, "docs/design/DEVIATIONS.md"), "utf8");
const DEVIATIONS_SECTIONS = parseDeviationsSections(DEVIATIONS_TEXT);
const ROSTER: InlineRosterRow[] = RECEIPTS.map((r) => judgeInlineReceipt(r, ALL_CHUNKS, ALL_TEXT, DEVIATIONS_SECTIONS));

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
// RUNG 3 (DEC-393 wave-42 amendment): 11 -> 8. Three of the eleven
// UNVERIFIABLE receipts are exactly the rung-3 outcomes DEVIATIONS.md's
// "## 10. Wave 35 rulings" section records (submit-views.tsx's
// chq-cfp-intro-cta-link and chq-cfp-identity-note-link, tools.css.ts's
// chq-docs-auth-link) -- each now resolves GROUNDED-BY-DEVIATION instead
// of UNVERIFIABLE, once their four wrong "DEVIATIONS.md section 9"
// citations were repaired to the real section 10 (this wave's second,
// independent fix).
// WAVE 44 (task w44-g): 8 -> 1. The remaining eight were the CFP
// intro-cta/identity-note paragraph wrappers (cfp.css.ts), the
// intro-cta-link/identity-note-link declaration rule (cfp.css.ts), two
// "Already have a password? Log in ›" receipts (submit-views.tsx), and
// the two pre-DEC-996 shell-file receipts (theme.ts's .chq-section /
// .chq-card, both describing anchors that now carry their own class
// tokens elsewhere). Seven now resolve: the two paragraph wrappers and
// the declaration rule cite the real DEVIATIONS.md §10 (a digit was
// missing from the declaration rule's own citation, and the two
// wrappers describe the same two anchors §10 already covers); the two
// "Log in to track it" receipts name the confirmation page's own
// same-surface .chq-btn CTA as a floored rung-2 companion; theme.ts's
// .chq-section receipt cites the same §10 third entry as tools.css.ts's
// grounded twin, and its .chq-card receipt names the same
// .chq-portal-version-link rung-2 companion as portal.css.ts's grounded
// twin for the identical anchor. The one true UNVERIFIABLE survivor is
// cfp.css.ts's OTHER "Already have a password? Log in ›" receipt (the
// pending-existing-contact state's classless-anchor CSS rule): its own
// selector's `:not(.chq-btn)` clause makes chq-btn a self-token rather
// than a usable companion for THIS receipt, chq-btn-primary alone
// declares no centred-flex anywhere in the tree, and DEVIATIONS.md
// carries no entry for this specific link.
// WAVE 52 (task w52-b, DEC-393 wave-52 amendment): 1 -> 0. The instrument
// was missing a rung: the survivor's own receipted selector
// (.chq-cfp-confirm-actions a:not(.chq-btn)) is ALSO the selector
// cfp.css.ts's phone media block floors directly (min-height:44px +
// display:inline-flex + align-items:center + padding:0 2px, at
// cfp.css.ts:344) -- the receipt needed no companion's testimony at all,
// it floors ITSELF, merged across its own base (colour) rule and its own
// phone-media rule the same cascade-merge idiom already used for
// companions. Added rung 0 (self-floored): before the companion search
// and before the UNVERIFIABLE/rung-3 fallthrough, check whether the
// receipt's own receiptedClasses tokens, merged across every rule in the
// swept corpus that mentions them, already satisfy the full floor
// grammar. Seeded by forcing this constant to -1, running this file, and
// reading the printed count back -- never by arithmetic.
export const INLINE_PROSE_UNVERIFIABLE_CEILING = 0;

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

  it("every receipt in the population resolves to exactly one of the four verdicts (no receipt is silently dropped)", () => {
    expect(ROSTER.length).toBe(RECEIPTS.length);
    for (const row of ROSTER) {
      expect(["GROUNDED", "UNGROUNDED", "UNVERIFIABLE", "GROUNDED-BY-DEVIATION"]).toContain(row.verdict);
    }
  });

  it("rung 0 positive control: a receipt whose OWN receipted class is floored (merged across its rules, no companion) resolves GROUNDED / self-floored", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.css",
      line: 1,
      reason: "inline-in-prose -- a phrase inside a running sentence, no companion class named here",
      receiptedClasses: ["chq-fake-self-floor"],
    };
    const chunks = [{ selector: ".chq-fake-self-floor", body: "display:flex; align-items:center;" }, { selector: ".chq-fake-self-floor", body: "min-height:44px; padding:0 8px;" }];
    const verdict = judgeInlineReceipt(receipt, chunks, "");
    expect(verdict.verdict).toBe("GROUNDED");
    expect(verdict.detail).toMatch(/self-floored/);
  });

  it("rung 0 negative control: a receipt whose OWN receipted class declares min-height but no flex/padding stays UNVERIFIABLE", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.css",
      line: 1,
      reason: "inline-in-prose -- a phrase inside a running sentence, no companion class named here",
      receiptedClasses: ["chq-fake-self-floor-partial"],
    };
    const chunks = [{ selector: ".chq-fake-self-floor-partial", body: "min-height:44px;" }];
    const verdict = judgeInlineReceipt(receipt, chunks, "");
    expect(verdict.verdict).toBe("UNVERIFIABLE");
  });
});

describe("rung 3: GROUNDED-BY-DEVIATION (DEC-393 wave-42 amendment)", () => {
  const sections: DeviationSection[] = [
    { number: 10, body: "This section discusses `.chq-fake-devlink` at length." },
  ];

  it("a receipt citing a real section that names its own chq- token resolves GROUNDED-BY-DEVIATION", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.tsx",
      line: 1,
      reason: "inline-in-prose -- recorded as DEVIATIONS.md §10's first entry (rung 3). chq-fake-devlink carries its own token.",
      receiptedClasses: [],
    };
    const verdict = judgeInlineReceipt(receipt, [], "", sections);
    expect(verdict.verdict).toBe("GROUNDED-BY-DEVIATION");
  });

  it("the same receipt citing a real section that does NOT name its token stays UNVERIFIABLE", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.tsx",
      line: 1,
      reason: "inline-in-prose -- recorded as DEVIATIONS.md §10's first entry (rung 3). chq-some-other-token here.",
      receiptedClasses: [],
    };
    const verdict = judgeInlineReceipt(receipt, [], "", sections);
    expect(verdict.verdict).toBe("UNVERIFIABLE");
    expect(verdict.detail).toMatch(/names none of this receipt's own chq- class token/);
  });

  it("the same receipt citing a non-existent section number stays UNVERIFIABLE", () => {
    const receipt: InlineReceipt = {
      file: "synthetic.tsx",
      line: 1,
      reason: "inline-in-prose -- recorded as DEVIATIONS.md §999's first entry (rung 3). chq-fake-devlink here.",
      receiptedClasses: [],
    };
    const verdict = judgeInlineReceipt(receipt, [], "", sections);
    expect(verdict.verdict).toBe("UNVERIFIABLE");
    expect(verdict.detail).toMatch(/no such "## 999\." heading/);
  });

  it("parseDeviationsSections on the real DEVIATIONS.md finds section 10 (the wave-35 rulings section)", () => {
    expect(DEVIATIONS_SECTIONS.some((s) => s.number === 10)).toBe(true);
  });
});
