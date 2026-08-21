// DEC-976 amendment (wave-153 -> task w9-ke): "grade audit gap rows against
// the tree; repair the stale ones." `docs/design/audit/*.md`'s own stated
// contract (see review-v12.md's header) is that a finding recorded there is
// a claim about the tree, and once it stops reproducing it must be
// rewritten RESOLVED with a drift-proof citation. Nothing enforced that
// contract before this file -- an audit row could go stale (the fix landed
// elsewhere) and sit there forever, forever telling the next reader a gap
// exists that does not.
//
// POPULATION (DEC-808: enumerated via readdirSync, never a hand-listed
// file list): every `docs/design/audit/**/*.md` file, every line in it.
//
// GAP-VERDICT LINE: a line whose text contains one of GAP_PHRASES --
// derived from this task's own brief plus a hand-audit of the two files it
// named (`phone-tap-floor-links.md`'s "Unsatisfied"/"no phone rule found",
// review-tap-floor-v12.md's "still measures under 44px on a phone frame").
// A RESOLVED row does not repeat these phrases (verified by re-reading both
// files after repair), so a repaired row naturally drops out of the
// population -- no RESOLVED/CLOSED keyword needs to be excluded by hand.
//
// OFFENDER: a gap-verdict line naming a `chq-*` token for which SOME
// `@media (max-width: ...)` rule in `app/src/**/*.css` declares
// `min-height: NNpx` with NN >= 44 for a selector naming that token on a
// class boundary (`.token` not preceded/followed by an identifier
// character) -- i.e. the finding's own claim ("no phone rule found" /
// "still measures under 44px") no longer matches the tree.
//
// Reuses the tree's canonical comment-stripper and rule-parser
// (`stripComments`/`parseAllRules`, exported by
// app/src/cancelled-padding-gap.scan.test.ts) rather than authoring a sixth
// private copy (DEC-613).
//
// NOTE for the planner (design gap, narrowest reading taken): the task
// brief also names a `ruleNamesClass` export on that file as importable.
// No such export exists there (checked by grep across app/src and src) --
// only `stripComments`/`parseAllRules`/`findCancelledPaddingRules`/etc are
// exported. The class-boundary selector match below is therefore written
// locally in this file rather than imported; it is small (a single regex
// test per rule) and does not duplicate the comment-stripping/rule-parsing
// logic DEC-613 is actually guarding.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_613, DEC_808, DEC_967, DEC_976 } from "../src/decisions";
import { parseAllRules, stripComments, type ParsedRule } from "../app/src/cancelled-padding-gap.scan.test";
import { enumerateSourceFiles, normalizeSource, labelIsMatched } from "./frame-source-corpus";

void DEC_976; // this file's whole reason to exist: grade audit gap rows against the tree
void DEC_808; // population enumerated via readdirSync, never a hand-listed file list
void DEC_613; // reuses the canonical stripComments/parseAllRules rather than a sixth copy
void DEC_967; // wave-27 amendment: one gap grammar certifies every OTHER stale-row shape as fresh -- widened below

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const AUDIT_ROOT = join(REPO_ROOT, "docs", "design", "audit");
const APP_SRC_ROOT = join(REPO_ROOT, "app", "src");
const SRC_ROOT = join(REPO_ROOT, "src");

/** Phrases that mark a line as asserting an unresolved phone tap-floor gap.
 * Derived by hand-auditing the two files this task named for their EXACT
 * pre-repair wording, not the task brief's loose paraphrase of them --
 * "unfloored" and "no phone rule" (without "found") were tried first and
 * rejected: both also appear inside unrelated, non-stale prose elsewhere in
 * phone-tap-floor-links.md (`chq-overview-link-inline`'s "deliberately
 * unfloored" design-intent note is not a gap; a base-class row's "no phone
 * rule in styles.css" prose describing what changed is not a gap either),
 * so the loose forms produced false offenders once this file's own repair
 * prose was added. The three phrases below are quoted verbatim from the
 * actual stale rows and do not recur outside them. */
const GAP_PHRASES = ["Unsatisfied", "no phone rule found", "still measures under 44px"];

/** Every `docs/design/audit/**\/*.md` file, enumerated (DEC-808). */
function auditMarkdownFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(AUDIT_ROOT, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CHQ_TOKEN_RE = /chq-[a-z0-9-]+/g;

interface GapLine {
  file: string;
  lineNo: number;
  line: string;
  tokens: string[];
}

/** Every line in `text` carrying a GAP_PHRASES hit, with its `chq-*` tokens. */
function extractGapLines(file: string, text: string): GapLine[] {
  const out: GapLine[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!GAP_PHRASES.some((p) => line.includes(p))) continue;
    const tokens = [...line.matchAll(CHQ_TOKEN_RE)].map((m) => m[0]);
    if (tokens.length === 0) continue;
    out.push({ file, lineNo: i + 1, line, tokens });
  }
  return out;
}

// -- Second detector class (DEC-967 wave-27 amendment): the ORIGINAL
// GAP_PHRASES grammar reads one line at a time, which is exactly right for
// a table-row's single-line "Unsatisfied" clause but wrong for hand-written
// prose paragraphs, which the audit docs wrap at ~80 columns -- the very
// two stale rows this task found on main have their claim's key phrase
// split across a line break ("...anywhere in\nthe codebase.") or their
// named token on the line AFTER the "still open"/"still mounts" phrase.
// Both new classes therefore work over blank-line-delimited PARAGRAPHS
// (a markdown paragraph or list-item block), joining its lines with a
// single space before matching, so a phrase or token that a prose wrap
// split across two source lines is still read as the one claim it is.

interface Paragraph {
  file: string;
  startLine: number;
  text: string;
}

/** Splits `text` into blank-line-delimited blocks (paragraphs / list items),
 * each carrying the 1-indexed line its first line sits on. */
function extractParagraphs(file: string, text: string): Paragraph[] {
  const lines = text.split("\n");
  const out: Paragraph[] = [];
  let cur: string[] = [];
  let curStart = 0;
  const flush = () => {
    if (cur.length > 0) {
      out.push({ file, startLine: curStart + 1, text: cur.join(" ") });
      cur = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (cur.length === 0) curStart = i;
    cur.push(line);
  }
  flush();
  return out;
}

interface ClaimHit {
  file: string;
  lineNo: number;
  text: string;
  token: string;
}

/** ABSENCE claims: "there is no `X`", "no `X` exists", or "no `X` ...
 * anywhere in the codebase" -- an OFFENDER when `X` now occurs in the
 * normalized app/src + src corpus. Only backtick literals directly
 * adjacent to the absence phrase are captured (not every backtick literal
 * in the paragraph, most of which are the surrounding prose's own accurate
 * citations, e.g. the component file that DOES exist and is not what the
 * row claims is missing). The "exists"/"anywhere in the codebase" forms
 * require the trigger word to sit close to the literal (same clause, no
 * intervening comma/period) -- a looser `[^.]*?` window was tried first
 * and rejected: it fired on density-pairing-v12.md's "No `dense`/`roomy`-
 * named pair **exists** here" (an axis-classification note, not a
 * codebase-absence claim) purely because "exists" occurred somewhere
 * later in the same sentence. */
const ABSENCE_CAPTURE_RES = [
  /there is no `([^`]+)`/gi,
  /no `([^`]+)`\s+exists\b/gi,
  /no `([^`]+)`[^,.]*?\banywhere in the codebase\b/gi,
];

function extractAbsenceClaims(paragraphs: Paragraph[]): ClaimHit[] {
  const seen = new Set<string>();
  const out: ClaimHit[] = [];
  for (const p of paragraphs) {
    for (const re of ABSENCE_CAPTURE_RES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p.text)) !== null) {
        const token = m[1]!;
        const key = `${p.file}:${p.startLine}:${token}`;
        if (seen.has(key)) continue; // same claim caught by >1 pattern -- one hit, not two
        seen.add(key);
        out.push({ file: p.file, lineNo: p.startLine, text: p.text, token });
      }
    }
  }
  return out;
}

const PERSISTENCE_PHRASES = ["still open", "still mounts", "still renders"];

/** PERSISTENCE claims: a paragraph carrying one of PERSISTENCE_PHRASES and
 * naming a `chq-*` token -- an OFFENDER when some rule for that token
 * inside a `@media (max-width: ...)` block now declares `display: none`
 * (i.e. the control the row says still ships has since been hidden on
 * phone, so the row's "still" claim no longer holds). */
function extractPersistenceClaims(paragraphs: Paragraph[]): ClaimHit[] {
  const out: ClaimHit[] = [];
  for (const p of paragraphs) {
    if (!PERSISTENCE_PHRASES.some((ph) => p.text.includes(ph))) continue;
    const tokens = [...p.text.matchAll(CHQ_TOKEN_RE)].map((m) => m[0]);
    for (const token of tokens) {
      out.push({ file: p.file, lineNo: p.startLine, text: p.text, token });
    }
  }
  return out;
}

/** The rightmost simple-selector segment of each comma-branch of `selector`
 * -- i.e. the actual element the rule styles, not an ancestor named earlier
 * in a descendant combinator. `.chq-worklist .chq-table td:nth-child(1)`
 * styles the `td`, not `.chq-worklist` or `.chq-table`; crediting an
 * ancestor's name with a descendant's `display: none` is exactly the
 * "first flat match, not the actual styled element" trap DEC-393 already
 * names for the tap-floor detector, one level out. */
function rightmostSelectorSegments(selector: string): string[] {
  return selector
    .split(",")
    .map((branch) => {
      const segments = branch.trim().split(/[\s>+~]+/).filter(Boolean);
      return segments[segments.length - 1] ?? "";
    })
    .filter((s) => s.length > 0);
}

/** True when `rules` contain a narrow (`mediaMaxWidth` non-null) rule that
 * directly targets `token` (on a class boundary, in the rule's OWN
 * rightmost selector segment, not merely as an ancestor) with `display:
 * none`, AND no narrow rule directly targeting `token` the same way ever
 * sets `display` back to something other than `none` -- a token toggled
 * hidden/shown by a state class (e.g. `.chq-x-selecting .chq-bulkbar`
 * re-showing what `.chq-x .chq-bulkbar` hides by default) is not "hidden
 * on phone", it is conditional, and a persistence row naming it is not
 * stale just because ONE of its state rules hides it. */
function isTokenHiddenOnPhone(rules: ParsedRule[], token: string): boolean {
  const boundaryRe = new RegExp(`\\.${token}(?![a-zA-Z0-9_-])`);
  let hasHide = false;
  let hasShow = false;
  for (const r of rules) {
    if (r.mediaMaxWidth === null) continue;
    const targets = rightmostSelectorSegments(r.selector).some((seg) => boundaryRe.test(seg));
    if (!targets) continue;
    const dm = r.body.match(/display:\s*([a-zA-Z-]+)/);
    if (!dm) continue;
    if (dm[1]!.toLowerCase() === "none") hasHide = true;
    else hasShow = true;
  }
  return hasHide && !hasShow;
}

let _normalizedSourceBlobs: string[] | null = null;
function normalizedSourceBlobs(): string[] {
  if (_normalizedSourceBlobs === null) {
    const files = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
    _normalizedSourceBlobs = files.map((f) => normalizeSource(readFileSync(f, "utf-8")));
  }
  return _normalizedSourceBlobs;
}

/** True when `rules` (already parsed+comment-stripped) contain a narrow
 * (`mediaMaxWidth` non-null) rule whose selector names `token` on a class
 * boundary, with `min-height: NNpx` for NN >= 44 in its body. */
function isTokenFloored(rules: ParsedRule[], token: string): boolean {
  const boundaryRe = new RegExp(`\\.${token}(?![a-zA-Z0-9_-])`);
  for (const r of rules) {
    if (r.mediaMaxWidth === null) continue;
    if (!boundaryRe.test(r.selector)) continue;
    const mh = r.body.match(/min-height:\s*(\d+(?:\.\d+)?)px/);
    if (!mh) continue;
    if (Number(mh[1]) >= 44) return true;
  }
  return false;
}

function loadAppCssRules(): ParsedRule[] {
  const cssFiles: string[] = [];
  const appSrcRoot = join(REPO_ROOT, "app", "src");
  for (const entry of readdirSync(appSrcRoot, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    cssFiles.push(join(entry.parentPath, entry.name));
  }
  const rules: ParsedRule[] = [];
  for (const abs of cssFiles.sort()) {
    const css = stripComments(readFileSync(abs, "utf-8"));
    rules.push(...parseAllRules(css));
  }
  return rules;
}

interface Offender {
  kind: "tap-floor" | "absence" | "persistence";
  file: string;
  lineNo: number;
  token: string;
  line: string;
}

function findOffenders(): Offender[] {
  const rules = loadAppCssRules();
  const offenders: Offender[] = [];
  for (const abs of auditMarkdownFiles()) {
    const rel = relative(REPO_ROOT, abs);
    const text = readFileSync(abs, "utf-8");

    for (const gapLine of extractGapLines(rel, text)) {
      for (const token of gapLine.tokens) {
        if (isTokenFloored(rules, token)) {
          offenders.push({ kind: "tap-floor", file: gapLine.file, lineNo: gapLine.lineNo, token, line: gapLine.line.trim() });
        }
      }
    }

    const paragraphs = extractParagraphs(rel, text);

    for (const hit of extractAbsenceClaims(paragraphs)) {
      if (labelIsMatched(hit.token, normalizedSourceBlobs())) {
        offenders.push({ kind: "absence", file: hit.file, lineNo: hit.lineNo, token: hit.token, line: hit.text.trim() });
      }
    }

    for (const hit of extractPersistenceClaims(paragraphs)) {
      if (isTokenHiddenOnPhone(rules, hit.token)) {
        offenders.push({ kind: "persistence", file: hit.file, lineNo: hit.lineNo, token: hit.token, line: hit.text.trim() });
      }
    }
  }
  return offenders;
}

describe("audit-gap-row-staleness", () => {
  it("VACUOUS-POPULATION TRIPWIRE: the walk finds the known member file, and the phrase detector finds a non-zero number of gap-verdict lines on pre-repair fixture text", () => {
    const files = auditMarkdownFiles();
    expect(files.some((f) => f.endsWith("phone-tap-floor-links.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("review-tap-floor-v12.md"))).toBe(true);

    // Fixture: the pre-repair wording this task found stale on main
    // 495f0a7a, quoted verbatim (not read from the live -- now repaired --
    // files) so this tripwire keeps proving the detector is not vacuous
    // even after the repair below removes every real gap-verdict line.
    const preRepairFixture = [
      "| \\`chq-review-queue-title\\` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits) | Submission title link is the only tap target in its part of the row, the row itself is not one target (\\`ReviewerQueue.tsx:266\\`); no phone rule found. |",
      "| \\`chq-link-button\\` | ROOMY | app/src/styles.css | **Unsatisfied** | Shared base class; every use composes it with a page-local class that is itself its own line/target. Base rule (styles.css:783) has no phone floor. |",
      "review-cluster consumer of it as a BARE class still measures under 44px on a phone frame:",
    ].join("\n");
    const gapLines = extractGapLines("fixture.md", preRepairFixture);
    expect(gapLines.length).toBeGreaterThan(0);
  });

  it("POSITIVE control: a fabricated row naming a token that IS floored is detected as an offender", () => {
    const rules = loadAppCssRules();
    // chq-link-button is floored directly at app/src/styles.css inside its
    // `@media (max-width: 700px)` block (this task's own repair target).
    expect(isTokenFloored(rules, "chq-link-button")).toBe(true);
    const fixture = "| `chq-link-button` | ROOMY | app/src/styles.css | **Unsatisfied** | fabricated stale row |";
    const gapLines = extractGapLines("fixture.md", fixture);
    expect(gapLines).toHaveLength(1);
    expect(gapLines[0]!.tokens).toContain("chq-link-button");
    expect(isTokenFloored(rules, gapLines[0]!.tokens[0]!)).toBe(true);
  });

  it("NEGATIVE control: a fabricated row naming a token that is NOT floored is not detected as an offender", () => {
    const rules = loadAppCssRules();
    const fabricatedToken = "chq-nonexistent-fixture-token-w9ke";
    expect(isTokenFloored(rules, fabricatedToken)).toBe(false);
    const fixture = `| \`${fabricatedToken}\` | ROOMY | app/src/styles.css | **Unsatisfied** | fabricated row naming a token with no phone rule found anywhere |`;
    const gapLines = extractGapLines("fixture.md", fixture);
    expect(gapLines).toHaveLength(1);
    expect(isTokenFloored(rules, gapLines[0]!.tokens[0]!)).toBe(false);
  });

  it("NEGATIVE control: a token named inside a RESOLVED row does not fire, even though it IS floored", () => {
    const fixture =
      "| `chq-link-button` | ROOMY | app/src/styles.css | **RESOLVED** | Now floored directly (app/src/styles.css`.chq-link-button {`) with min-height:44px. |";
    const gapLines = extractGapLines("fixture.md", fixture);
    expect(gapLines).toHaveLength(0);
  });

  it("VACUOUS-POPULATION TRIPWIRE (absence/persistence): the new phrase detectors fire on the actual pre-repair wording found on main 495f0a7a, quoted verbatim (not read from the live -- now repaired -- files)", () => {
    const preRepairAbsenceFixture = [
      "**Current implementation (unchanged by this task)**: `DocsArticlePage`",
      "(src/routes/docs-site.tsx) renders the SAME `.chq-docs-header` (brandrow +",
      "compact search + leaving link) at every width, and separately renders a",
      "`.chq-docs-phone-back` (`‹ Docs`) link inline in the article body, above the",
      "H1 — already phone-only via `display:none` → `display:flex` in the existing",
      "700px block. There is no `Contents` trigger and no drawer/sheet anywhere in",
      "the codebase.",
    ].join("\n");
    const absenceParagraphs = extractParagraphs("fixture.md", preRepairAbsenceFixture);
    const absenceHits = extractAbsenceClaims(absenceParagraphs);
    expect(absenceHits.length).toBeGreaterThan(0);
    expect(absenceHits.some((h) => h.token === "Contents")).toBe(true);

    const preRepairPersistenceFixture = [
      "  - Header duplicate download control: still open, unchanged from w17-c —",
      "    `.chq-content-files-header-row` still mounts its own \"Download …",
      "    (.zip)\" secondary beside the stat line as well as the footer dock's",
      "    copy, which the frame reserves for the dock alone.",
    ].join("\n");
    const persistenceParagraphs = extractParagraphs("fixture.md", preRepairPersistenceFixture);
    const persistenceHits = extractPersistenceClaims(persistenceParagraphs);
    expect(persistenceHits.length).toBeGreaterThan(0);
    expect(persistenceHits.some((h) => h.token === "chq-content-files-header-row")).toBe(true);
  });

  it("POSITIVE control (absence): a fabricated 'there is no `X`' claim naming a token that DOES occur in the source corpus is detected as an offender", () => {
    const fixture =
      "**Current state**: there is no `chq-content-files-header-row` anywhere in the codebase, only a plain div.";
    const paragraphs = extractParagraphs("fixture.md", fixture);
    const hits = extractAbsenceClaims(paragraphs);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.token).toBe("chq-content-files-header-row");
    expect(labelIsMatched(hits[0]!.token, normalizedSourceBlobs())).toBe(true);
  });

  it("NEGATIVE control (absence): a fabricated 'there is no `X`' claim naming a token that does NOT occur in the source corpus is not detected as an offender", () => {
    const fabricatedToken = "chq-nonexistent-fixture-token-w9ke-absence";
    const fixture = `**Current state**: there is no \`${fabricatedToken}\` anywhere in the codebase.`;
    const paragraphs = extractParagraphs("fixture.md", fixture);
    const hits = extractAbsenceClaims(paragraphs);
    expect(hits).toHaveLength(1);
    expect(labelIsMatched(hits[0]!.token, normalizedSourceBlobs())).toBe(false);
  });

  it("POSITIVE control (persistence): a fabricated 'still mounts' claim naming a token now hidden on phone is detected as an offender", () => {
    // `.chq-content-files-download-all-wrap` is hidden inside content.css's
    // phone `@media (max-width: ...)` block (`display: none`) -- this
    // task's own repair target for the content-v12.md row.
    const fixture = "The `.chq-content-files-download-all-wrap` control still mounts in the header on every width.";
    const paragraphs = extractParagraphs("fixture.md", fixture);
    const hits = extractPersistenceClaims(paragraphs);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.token).toBe("chq-content-files-download-all-wrap");
    const rules = loadAppCssRules();
    expect(isTokenHiddenOnPhone(rules, hits[0]!.token)).toBe(true);
  });

  it("NEGATIVE control (persistence): a fabricated 'still mounts' claim naming a token with no phone-hiding rule is not detected as an offender", () => {
    const fabricatedToken = "chq-nonexistent-fixture-token-w9ke-persistence";
    const fixture = `The \`.${fabricatedToken}\` control still mounts in the header on every width.`;
    const paragraphs = extractParagraphs("fixture.md", fixture);
    const hits = extractPersistenceClaims(paragraphs);
    expect(hits).toHaveLength(1);
    const rules = loadAppCssRules();
    expect(isTokenHiddenOnPhone(rules, hits[0]!.token)).toBe(false);
  });

  it("zero-tolerance: no gap-verdict row in docs/design/audit/**/*.md names a token that is now floored, absent-but-present, or hidden-but-persistent in the tree", () => {
    const offenders = findOffenders();
    expect(offenders).toEqual([]);
  });
});
