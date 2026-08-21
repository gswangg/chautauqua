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
import { DEC_613, DEC_808, DEC_976 } from "../src/decisions";
import { parseAllRules, stripComments, type ParsedRule } from "../app/src/cancelled-padding-gap.scan.test";

void DEC_976; // this file's whole reason to exist: grade audit gap rows against the tree
void DEC_808; // population enumerated via readdirSync, never a hand-listed file list
void DEC_613; // reuses the canonical stripComments/parseAllRules rather than a sixth copy

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const AUDIT_ROOT = join(REPO_ROOT, "docs", "design", "audit");

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
          offenders.push({ file: gapLine.file, lineNo: gapLine.lineNo, token, line: gapLine.line.trim() });
        }
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

  it("zero-tolerance: no gap-verdict row in docs/design/audit/**/*.md names a token that is now floored in the tree", () => {
    const offenders = findOffenders();
    expect(offenders).toEqual([]);
  });
});
