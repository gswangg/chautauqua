// Open-divergence ledger (DEC-099, task w11-td).
//
// test/phone-frame-ledger.scan.test.ts and test/desktop-frame-ledger.scan.
// test.ts are two saturated COVERAGE ledgers (CLAIMED_FLOOR = 53/53 and
// 100/100) -- both measure only whether a v12 frame is CLAIMED by some
// test, never whether the frame CONFORMS to the pack. Nothing in the tree
// counts the recorded divergences docs/design/audit/**/*.md already carries
// that are still OPEN, so the campaign's exit predicate cannot see how far
// there is left to run. This is that instrument, built in the house style
// of the two frame ledgers above (derived population, vacuous-population
// tripwire, two-sided ratchet, offending rows printed by name -- never an
// allowlist populated from the failure output, per app/src/phone-tap-
// target.scan.test.ts:30-32).
//
// POPULATION (derived, never hand-listed, per DEC-808): readdirSync
// docs/design/audit for *.md, walked RECURSIVELY (DEC-099 wave-24
// amendment) so a nested directory cannot hide rows from the population --
// per DEC-367/DEC-808 "a directory is not a population". The
// docs/design/audit/settings-v12/ directory (three further .md files) is
// now reached; a non-vacuity assertion below pins that at least one row
// resolves from a nested path, so a future flattening cannot silently
// re-open the blind spot. Within each of the 110 files, every raw-text
// occurrence of the literal token `DIVERGES` opens one row, keyed
// `file:line` -- PLUS (task w31-d, DEC-099 wave-31 amendment) every
// heading/bold-led/table-row line carrying the corpus's OTHER verdict
// vocabulary (`diverg`/`mismatch`/`does not match`, case-insensitive,
// minus a same-line denial) -- see the WIDENED CLAIM VOCABULARY comment
// below for the full grammar and its negative controls.
//
// ADJUDICATION GRAMMAR: a row is ADJUDICATED when its own line, or "the
// paragraph it heads", carries a `DEC-NNN` citation or names
// `docs/design/DEVIATIONS.md`; otherwise it is OPEN. "The paragraph it
// heads" is resolved by the same line-shape the audit corpus is actually
// written in (three shapes reused verbatim from established idioms
// elsewhere in this suite, plus one fallback):
//
//   1. HEADING shape (`^#+\s`, e.g. "## DIVERGES 1 -- ..."): the paragraph
//      runs from the heading line up to (not including) the next `^#+\s`
//      heading line, or EOF -- the same extractSection() shape
//      test/clarifications-ledger.scan.test.ts and the desktop frame
//      ledger's own DEVIATIONS §6 reader both use.
//   2. TABLE-ROW shape (`^\s*\|`): the row is atomic -- a markdown table
//      row is one line, so its paragraph is that single line.
//   3. BULLET shape (`^\s*-\s`): the paragraph is the bullet line plus any
//      immediately-following indented continuation lines (`^\s+\S`),
//      mirroring findDeviationsOffenders' bullet-join shape (DEC-613: an
//      established shape reused, not reinvented) which
//      test/exemption-reason-is-a-principle.scan.test.ts already applies
//      to docs/design/DEVIATIONS.md's own bullets.
//   4. FALLBACK (bare prose, e.g. "**DIVERGES** (label wording only...)."
//      or a plain narrative sentence): a blank-line-delimited paragraph
//      containing the line, the same shape
//      test/exemption-reason-is-a-principle.scan.test.ts's own
//      flushParagraph() uses for DEVIATIONS.md prose.
//
// This grammar is intentionally the SIMPLEST rule that can be stated and
// derived without a hand-curated per-row list (DEC-180/DEC-808: a
// hand-listed population is not a population). It is a known
// over-approximation in one direction and an under-approximation in the
// other, and both are the safe direction for a ledger whose job is "never
// hide a problem" (DEC-099): (a) a stray DEC-NNN citation elsewhere in a
// long table-row cell can adjudicate a row that is not actually resolved by
// that citation (e.g. contacts-v12.md's :196 row, which cites DEC-976 for
// its citation FORM while its own body clause is still genuinely open) --
// this under-counts OPEN; (b) a resolving ruling written in the NEXT
// paragraph, separated by a blank line from the paragraph that still says
// "DIVERGES" (e.g. agenda-clash-390-v12.md:18), is not credited -- this
// over-counts OPEN. Given DEC-099's own "fail loudly, never hide a defect"
// principle, erring toward OPEN is the correct default; this scan does not
// attempt row-by-row hand curation, which would make the population
// hand-listed again.
//
// RATCHET (DEC-808, two-sided, mirroring the two frame ledgers' own
// CLAIMED_FLOOR amendments): OPEN_DIVERGENCE_CEILING is a single exported
// const, set to the OPEN count measured on THIS commit (after this task's
// three re-verdicts landed above, which is why the number here is lower
// than a pre-re-verdict measurement would have read). It may only be
// LOWERED in a future wave as adjudications/fixes land; a companion test
// fails when OPEN rises above it (printing every offending file:line) and
// another fails when OPEN drops below it without the constant being
// lowered to match (printing the exact replacement line), so neither
// direction can go stale.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const AUDIT_DIR = join(REPO_ROOT, 'docs', 'design', 'audit');

const DEC_CITE_RE = /\bDEC-\d{3}\b/;
const DEVIATIONS_RE = /docs\/design\/DEVIATIONS\.md/;
const TOKEN = 'DIVERGES';

// WIDENED CLAIM VOCABULARY (task w31-d, DEC-099 wave-31 amendment): the
// literal TOKEN above is one verdict shape the corpus uses; 28 of 107 audit
// files carry a DIFFERENT verdict shape for the same claim -- lower-case
// "diverges"/"divergence", "mismatch", or "does not match" -- and were
// invisible to a scan keyed on ONE literal (field-guide wave-28/31: "a
// green ledger is a statement about its grammar"). This is a DERIVED
// widening (never a hand-listed file/phrase list, per DEC-808): any line
// that is itself a HEADING (classifyLineShape === 'heading'), a
// BOLD-LED verdict span (starts, ignoring leading whitespace, with `**`),
// or a TABLE-ROW (classifyLineShape === 'table') -- the three shapes a
// verdict is actually STATED in, never buried mid-paragraph prose -- and
// whose text matches CLAIM_RE opens a row exactly like a literal TOKEN
// line does. Bare fallback prose (a claim mentioned in passing, never
// stated as the line's own verdict) is deliberately NOT widened: real
// corpus denials of this shape (contacts-pipeline-390-v12.md:96 "no
// divergence to record there"; comms-landing-390-v12.md:23/58 "No
// divergence -- the frame...") sit in ordinary paragraph prose, not in a
// heading/bold-span/table-row, so restricting the widened shapes to the
// three "a verdict is actually stated here" constructs excludes them
// without needing prose-level negation handling for that shape.
//
// The one shape where a real denial DOES land inside a widened trigger is
// TABLE-ROW: overflow-390-v12.md:179's cell reads "...so head and body
// cannot diverge -- there is no head to diverge." -- a denial stated
// inside a table cell. DENIAL_RE below catches this (and the same-shaped
// denials read by hand in density-pairing-v12.md:96 "No other
// divergence.", content-landing-390-v12.md:38 "not a divergence") so a
// line asserting the ABSENCE of a divergence never opens a row, matching
// this ledger's own two-sided negative-control discipline (DEC-099: "a
// sentence that DENIES a divergence must NOT open a row").
const CLAIM_RE = /diverg|mismatch|does not match/i;
const DENIAL_RE = /\bno\b[^.|]{0,40}\bdiverg\w*|\bnot a\b[^.|]{0,20}\bdiverg\w*|\bnever\b[^.|]{0,20}\bdiverg\w*|\bcannot\b[^.|]{0,20}\bdiverg\w*/i;
// A markdown table's HEADER row (e.g. "| Frame | Verdict | What diverges |")
// names its VERDICT COLUMN "What diverges"/"Diverges" in five of the newly
// -reached files (comms-v12.md:133, review-v12.md:63, content-v12.md:77,
// contacts-v12.md:194, settings-v12/w10-frame-verdicts.md:70,
// frame-field-label-v12.md:86) -- the column's NAME, not a claim about any
// specific frame. A header row is always immediately followed by a
// markdown separator row (only `|`, `-`, `:` and whitespace); that shape,
// not any hand-listed file, is what excludes it.
const TABLE_SEPARATOR_RE = /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/;

export type RowShape = 'heading' | 'table' | 'bullet' | 'fallback';

export interface DivergenceRow {
  /** Repo-relative audit file, e.g. "docs/design/audit/contacts-v12.md". */
  file: string;
  /** 1-based line number of the DIVERGES occurrence. */
  line: number;
  shape: RowShape;
  paragraph: string;
  adjudicated: boolean;
}

/** Which of the four line-shapes governs this line's "paragraph it heads". */
export function classifyLineShape(line: string): RowShape {
  if (/^#+\s/.test(line)) return 'heading';
  if (/^\s*\|/.test(line)) return 'table';
  if (/^\s*-\s/.test(line)) return 'bullet';
  return 'fallback';
}

/** Resolves "the paragraph" a DIVERGES-carrying line at `idx` heads, per the
 * four-shape grammar in the file header comment above. Pure function of
 * `lines` + `idx` -- exported so the negative-control tests below can drive
 * it with synthetic fixtures rather than real files. */
export function paragraphFor(lines: string[], idx: number): string {
  const shape = classifyLineShape(lines[idx]!);
  if (shape === 'heading') {
    let end = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^#+\s/.test(lines[i]!)) {
        end = i;
        break;
      }
    }
    return lines.slice(idx, end).join('\n');
  }
  if (shape === 'table') {
    return lines[idx]!;
  }
  if (shape === 'bullet') {
    let end = idx + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end]!) && !/^\s*-\s/.test(lines[end]!)) end++;
    return lines.slice(idx, end).join('\n');
  }
  // fallback: blank-line-delimited paragraph containing idx.
  let start = idx;
  while (start > 0 && lines[start - 1]!.trim() !== '') start--;
  let end = idx;
  while (end < lines.length - 1 && lines[end + 1]!.trim() !== '') end++;
  return lines.slice(start, end + 1).join('\n');
}

/** A row is ADJUDICATED when its own line, or the paragraph it heads,
 * carries a DEC-NNN citation or names docs/design/DEVIATIONS.md. */
export function isAdjudicated(line: string, paragraph: string): boolean {
  return DEC_CITE_RE.test(line) || DEVIATIONS_RE.test(line) || DEC_CITE_RE.test(paragraph) || DEVIATIONS_RE.test(paragraph);
}

/** Whether `line`, at its own shape, opens a row under the WIDENED claim
 * vocabulary (heading / bold-led / table-row carrying CLAIM_RE, minus a
 * same-line DENIAL_RE denial). Exported so the negative-control tests can
 * drive it directly. */
export function isWidenedClaimTrigger(line: string, nextLine?: string): boolean {
  if (!CLAIM_RE.test(line)) return false;
  if (DENIAL_RE.test(line)) return false;
  const shape = classifyLineShape(line);
  if (shape === 'table') {
    // A table row immediately followed by a separator row is the header,
    // naming its verdict column -- not a claim about a frame.
    if (nextLine !== undefined && TABLE_SEPARATOR_RE.test(nextLine)) return false;
    return true;
  }
  if (shape === 'heading') return true;
  return /^\s*\*\*/.test(line); // bold-led verdict span
}

/** Derives every claim row in `text` (already split into `lines`), tagged
 * with its file, shape, paragraph and adjudication status. Pure function --
 * exported for the negative-control tests. A row opens on either the
 * literal TOKEN (any shape, original grammar) or the widened claim
 * vocabulary (heading/bold-led/table-row only, see comment above). */
export function deriveRowsFromLines(relFile: string, lines: string[]): DivergenceRow[] {
  const out: DivergenceRow[] = [];
  lines.forEach((line, idx) => {
    if (!line.includes(TOKEN) && !isWidenedClaimTrigger(line, lines[idx + 1])) return;
    const paragraph = paragraphFor(lines, idx);
    out.push({
      file: relFile,
      line: idx + 1,
      shape: classifyLineShape(line),
      paragraph,
      adjudicated: isAdjudicated(line, paragraph),
    });
  });
  return out;
}

/** Every *.md file under docs/design/audit, enumerated rather than named
 * (DEC-808), walked RECURSIVELY (DEC-099 wave-24 amendment) so a nested
 * directory (e.g. docs/design/audit/settings-v12/) cannot hide rows from
 * the population -- per DEC-367/DEC-808 "a directory is not a population".
 * Returns paths relative to AUDIT_DIR (POSIX-joined) so nested files carry
 * a directory separator while flat-directory files keep their bare name,
 * preserving the existing flat rows' exact file:line keys. */
function auditFiles(dir: string = AUDIT_DIR): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const nested = auditFiles(join(dir, e.name));
      for (const n of nested) out.push(`${e.name}/${n}`);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(e.name);
    }
  }
  return out.sort();
}

function rowsInFile(fileName: string): DivergenceRow[] {
  const full = join(AUDIT_DIR, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, 'utf-8').split('\n');
  return deriveRowsFromLines(relFile, lines);
}

const ALL_ROWS: DivergenceRow[] = auditFiles().flatMap(rowsInFile);
const OPEN_ROWS: DivergenceRow[] = ALL_ROWS.filter((r) => !r.adjudicated);

// RE-SHAPED (task w27-c, DEC-180 wave-27 amendment): these four constants
// used to be exact-equality guards (EXPECTED_AUDIT_FILE_COUNT = 105,
// EXPECTED_TOTAL_TOKEN_COUNT = 160, EXPECTED_SHAPE_COUNTS =
// {15,44,26,75}). They went RED on healthy corpus growth -- two lanes
// landed new audit documents (docs/design/audit/mint-door-caps-v12.md,
// docs/design/audit/route-substate-390-sweep-v12.md; see
// docs/design/audit/open-divergence-ledger-v12.md "Measured result" for
// the verbatim citations) that carry zero DIVERGES rows, taking the file
// count from 105 to 107 while ALL_ROWS.length stayed at 160 and every
// shape count was untouched -- the guard was equality where the real
// invariant is "this population only grows, and every shape it uses stays
// reachable" (DEC-180: a guard over a corpus lanes append to by design is
// a monotone floor plus reachability, never an equality). Floors below are
// seeded at the values MEASURED live on this branch by running this file
// (never computed from arithmetic on this comment) -- 107 audit files, 160
// DIVERGES-token rows, shape split 15/44/26/75. A floor may only be RAISED
// in a future wave after re-measuring on that branch; on a FALL, the
// companion test prints the shortfall and this comment's instruction:
// diff `auditFiles()`/`ALL_ROWS` against the last-known-good list to find
// which audit file or row disappeared before lowering any floor -- a fall
// is a deleted ledger, exactly what this guard exists to catch.
// Raised wave-31 (task v12m-w31-f): app/src/phone-hidden-drawn-text.scan.test.ts
// adds docs/design/audit/phone-hidden-drawn-text-v12.md, growing both the
// audit-file count and the DIVERGES-token row count -- a monotone-upward
// floor guard, per its own failure message, is raised in the SAME commit
// that grows the corpus, never left stale.
//
// MERGE-TRAIN NOTE: w31-f measured 119/189 against a main that predated
// w31-d's widened claim vocabulary and the four other wave-31 audit docs.
// Both figures below are the values re-measured live on the fully merged
// tree, which is higher than either side's -- w31-f's own reasoning is
// unchanged and still applies, only its arithmetic was superseded by the
// larger corpus it landed into.
//
// Wave-32 amendment (task w32-f): TOKEN_ROW_FLOOR fell by 2 after
// confirming which rows disappeared, per this comment's own instruction --
// docs/design/audit/drawn-field-label-v12.md's four adopted rows (Contacts
// "Message", Submissions "Options · one per line", Settings "Type the file
// name to confirm", Comms "From which plan") moved from HARDCODED-DIVERGES
// to HARDCODED-MATCHES, removing their DIVERGES-token table cells; two new
// DIVERGES-token mentions were added elsewhere in the same file's prose
// (net -2, verified: `grep -c DIVERGES` on that one file moved 10 -> 8, no
// other audit file changed). w32-f measured 118/187 on its own smaller
// base; the megabatch carries the fall forward onto the wave-31 corpus
// (120 audit files, 246 -> 244 token rows), the audit-file floor being
// untouched because w32-f added and deleted no audit document.
const AUDIT_FILE_FLOOR = 120;
const TOKEN_ROW_FLOOR = 244;
const SHAPE_FLOORS: Record<RowShape, number> = {
  heading: 34,
  table: 72,
  bullet: 31,
  fallback: 109,
};

// -- Ratchet -------------------------------------------------------------
// RE-BASELINED (task w13-xa, DEC-069/DEC-808 amendment): these constants
// were measured on branch v12m-w11-td, never on post-megabatch main, so the
// exit predicate's own header for this file (previously "203 total
// DIVERGES-token rows across 100 audit files, 133 OPEN") was stale by an
// entire branch-tree diff. The drop from 203 is ADJUDICATION, not row
// deletion: `git grep -c DIVERGES 5eadde2c5 -- 'docs/design/audit/*.md'`
// and the same grep on this branch's parent both total 148 lines -- no
// audit-file content was removed by this task, only re-measured. The
// further drop to the values below happened because this branch's base
// (6459bebdd, "merge v12m-w12-xf") includes SIX MORE audit-file edits than
// the w13-xa task brief's own 880726041 snapshot did (comms-v12.md,
// contacts-v12.md, content-v12.md, review-reviewer-desktop-v12.md,
// submissions-390-v12.md, plus a wholly NEW file,
// phone-verdict-cascade-read-v12.md, which raises EXPECTED_AUDIT_FILE_COUNT
// to 101) -- landed by other in-flight lanes between when the task brief's
// numbers were measured and when this task actually ran. Per the task's own
// instruction ("re-run the scan yourself and use the numbers IT prints,
// never these"), all four constants below are the scan's live output on
// this commit, not the brief's 100/146/{15,37,27,67}/85 figures, which
// were already one branch-generation stale. 153 total DIVERGES-token rows
// across 101 audit files, 4 OPEN. May only be LOWERED in a future wave as more
// rows get adjudicated (a DEC ruling lands, or the row is fixed and the fix
// cited); must never be raised to paper over new debt landing unadjudicated.
//
// RE-BASELINED (Thunderdome wave-14m megabatch, medic pass): 90 -> 4. The
// POPULATION IS UNCHANGED -- 101 audit files, 153 DIVERGES-token rows, and
// the 15/38/27/73 shape split are all byte-identical to the pre-megabatch
// measurement at 542f93006, and all three vacuous-population guards above
// still pass untouched. No audit file was added, deleted, or stripped of a
// DIVERGES token. The drop is pure ADJUDICATION landed by lanes w14-f/g/h/i
// (0c222beaa, 54c44e732, 828654280, 78766c114), which added in-cell and
// in-paragraph DEC-NNN citations to 86 rows. Those lanes predicted this
// exact red -- 45664f1aa's commit body says so outright -- but no lane owned
// the re-baseline, so it fell through the batch. Re-measured live on the
// integrated tree by the scan itself, never by arithmetic on a lane's
// snapshot. The 4 rows once OPEN were cfp-desktop-v12.md:21,
// contacts-import-390-v12.md:106, public-390-request-verdicts-v12.md:100 and
// settings-dialogs-desktop-v12.md:154. Known safe-direction over-count, NOT
// a defect: cfp-desktop-v12.md:22 adjudicates its row as `DEC_976` (the
// underscore export-identifier idiom from src/decisions-data), which
// DEC_CITE_RE's `/\bDEC-\d{3}\b/` cannot see -- a hyphenated citation in
// that paragraph would take the true count to 3.
//
// RE-MEASURED (task w16-qf): 3 open rows remain on this branch after
// closing public-390-request-verdicts-v12.md:100 (this task, DEC-902
// wave-12m amendment). merge train: re-measure after v12m-w15-q,
// v12m-w15-r and v12m-w16-qe land; this must reach 0.
//
// RE-BASELINED (task w18-c, DEC-903 wave-18): that lane measured 4 -> 1 in
// its own worktree, adding the two hyphenated citations (`DEC-976` for the
// Session-format legend, `DEC-613` for "Save draft" vs the frame's "Draft")
// into public-390-request-verdicts-v12.md:100's own table-row cell. By the
// time it ran, cfp-desktop-v12.md:22 and settings-dialogs-desktop-v12.md:154
// had already been repaired by sibling in-flight lanes, and the last row it
// still reported OPEN (contacts-import-390-v12.md:106) belonged to sibling
// task v12m-w18-a. THUNDERDOME MERGE RECONCILIATION (DEC-998 clause b): the
// residual gap the lane left open is closed by the batch, so the constant
// stays at the integrated floor of 0 rather than regrowing to the lane's
// in-worktree 1 -- a ratchet may only be LOWERED, never raised.
// RE-BASELINED (THUNDERDOME wave-23 megabatch, merge-train reconciliation
// per DEC-998 clause b): population re-measured live on the integrated tree
// after 41 branches landed -- 101 -> 102 audit files, 152 -> 158 rows,
// shape split 15/38/27/72 -> 15/42/26/75. The batch added one audit file
// and several table rows; NO row was deleted and the OPEN count stays at
// the floor of 0, so the ratchet below is untouched. Measured by the scan
// itself (constants forced to -1 and the reported values read back), never
// by arithmetic on any lane's own snapshot.
//
// RE-BASELINED (task w24-a, DEC-099 wave-24 amendment): auditFiles() now
// walks docs/design/audit RECURSIVELY instead of flat, reaching the
// previously-unreached docs/design/audit/settings-v12/ directory (three
// files: w10-frame-verdicts.md, w3-landing-drills.md,
// w3f-cfp-public-portal.md). Population re-measured live on this branch
// (constants forced to -1/-1 first, actuals read off the failure output,
// never computed from this comment's own numbers): 102 -> 105 audit files,
// 158 -> 160 DIVERGES-token rows, shape split 15/42/26/75 -> 15/44/26/75
// (the settings-v12 addition is two table rows, both already carrying a
// DEC-919 citation -- w10-frame-verdicts.md:73 and :79; the other two
// nested files, w3-landing-drills.md and w3f-cfp-public-portal.md, carry
// zero DIVERGES tokens). OPEN_DIVERGENCE_CEILING measured 0 both before
// and after the walk widened -- both newly-reached rows are ADJUDICATED,
// so per this task's own instruction the ceiling is left untouched rather
// than raised.
//
// RE-BASELINED (task w31-d, DEC-099 wave-31 amendment): the WIDENED CLAIM
// VOCABULARY above (heading/bold-led/table-row shapes matching CLAIM_RE,
// minus DENIAL_RE) reaches 28 of the 107 audit files that were carrying
// this ledger's claim in a shape the bare literal TOKEN could never see.
// Re-measured live on this branch (constants forced to -1/-1/{-1,-1,-1,-1}
// first, actuals read off the failure output): 107 -> 110 audit files (3
// more files were also added to the corpus by other in-flight lanes since
// the wave-27 baseline; unrelated to this task), 160 -> 234 DIVERGES-token
// rows (74 new rows from the widened vocabulary), shape split
// 15/44/26/75 -> 29/70/29/106 (every shape grew: 14 new heading rows, 26
// new table rows, 3 new bullet rows -- a bold-led span classifies
// `fallback` under classifyLineShape, which is why table/heading grew less
// than fallback's +31). Of the 74 newly-reached rows, 58 are ADJUDICATED
// by the SAME line/paragraph-scoped DEC-NNN-or-DEVIATIONS.md grammar this
// file has always used (unchanged, per this task's own instruction not to
// fork it) and 16 are OPEN. Every one of the 16 was read by hand (see
// docs/design/audit/open-divergence-ledger-v12.md "Re-measured (task
// w31-d)" for the full file:line list with its own words) -- none carries
// a DEC-NNN or DEVIATIONS.md citation reachable by this grammar's
// line/paragraph scope, so none is adjudicated in this task; per this
// task's own instruction ("adjudicate ONLY rows you can settle by citing
// an existing DEC or DEVIATIONS line ... never by inventing a ruling"),
// none is closed here. All 16 are the SAME known over-approximation
// direction (b) this file's header comment has always documented (a
// resolving citation sits in a LATER paragraph/section than the grammar's
// line/paragraph scope reaches) -- e.g. contacts-drawer-390-v12.md:23's
// table cell says "already-SETTLED divergence — see 'Known,
// already-adjudicated divergences' below", and that section (line 39-42)
// does cite `docs/design/DEVIATIONS.md` §7, but a table row's paragraph is
// itself atomic (shape 2 above) so the citation two sections down is
// correctly not credited. OPEN_DIVERGENCE_CEILING rises from 0 to 16 --
// this is the widened instrument seeing real, already-narrated debt for
// the first time, not new debt landing; the campaign's actual distance to
// run is unchanged by this task, only this ledger's VISIBILITY of it.
//
// RE-SEEDED 16 -> 22 at the wave-31 MERGE TRAIN (not by a task): w31-d was
// cut from 1958e491c and measured against the 110-file corpus visible
// there; main had meanwhile advanced to 118 audit files, so the widened
// grammar landed on a corpus 8 files larger than the one it was measured
// against. All 16 rows w31-d sealed are still present and still open (two
// only shifted line: desktop-control-floor-v12.md:182/:438 -> :185/:441).
// The 6 additions were each read by hand and every one lives in a file
// that did NOT exist at 1958e491c -- see
// docs/design/audit/open-divergence-ledger-v12.md "Re-measured at the
// wave-31 merge train" for the file:line list with each row's own words.
// This is the same re-seed this constant already took from 0 to 16: the
// instrument widened and the corpus grew beneath it, NOT new debt. The
// LOWER-only ratchet resumes from 22 -- a later wave finding this risen
// without a corpus/grammar change is seeing real new debt and must fail.
<<<<<<< HEAD
//
// LOWERED 24 -> 16 (task v12m-w34-e, DEC-099 wave-34 clause (a), Comms +
// Contacts half). All 8 closed rows were ALREADY adjudicated -- their DEC
// or DEVIATIONS citation sat a blank line or section away, outside this
// grammar's line/paragraph scope. No exclusion list was added and the
// grammar was not forked (DEC-808's "never hand-curate a row"): each
// verdict sentence's own paragraph was edited to name the ruling its
// following bullets/sections already cite. Closed: comms-compose-desktop
// -v12.md:41 (DEC-902 wave-9, DEC-967, DEC-651 wave-26) and :136 (DEC-964
// wave-21); contacts-desktop-v12.md:45 (DEC-902 wave-8), :120 (DEC-902
// wave-14m disposition (b)), :160 (DEC-902 wave-14m disposition (b));
// contacts-directory-desktop-v12.md:30 (DEC-919) and :67 (DEC-902 wave-14m
// wording disposition, applied to order); contacts-drawer-390-v12.md:410
// (docs/design/DEVIATIONS.md §7, moved into the table cell itself rather
// than the section two blocks below). Population and grammar unchanged --
// re-measure via `npx vitest run test/open-divergence-ledger.scan.test.ts`
// with this constant forced to -1 before trusting any future line number.
//
// LOWERED AGAIN at the wave-34 thunderdome megabatch: task v12m-w34-f closed
// a DISJOINT set of 9 rows (submissions-390-v12.md and siblings, DEC-099
// wave-34 clause (a), Submissions half) against the same 24-row roster,
// measuring 15 on its own branch. Neither branch's number is right for the
// merged tree -- 24 - 8 (w34-e) - 9 (w34-f) -- so the constant below is the
// value RE-MEASURED on the fully merged tree with it forced to -1, never
// either side's arithmetic and never either side's branch-local reading.
export const OPEN_DIVERGENCE_CEILING = 7;

describe('open-divergence ledger (DEC-099, task w11-td)', () => {
  it(`enumerates at least ${AUDIT_FILE_FLOOR} audit files and at least ${TOKEN_ROW_FLOOR} DIVERGES-token rows (monotone-floor vacuous-population guard, DEC-180 wave-27)`, () => {
    const files = auditFiles();
    if (files.length < AUDIT_FILE_FLOOR) {
      throw new Error(
        `Only ${files.length} audit files found, below the floor of ${AUDIT_FILE_FLOOR}. ` +
          `This floor may only be LOWERED after confirming which audit file(s) disappeared -- ` +
          `diff auditFiles() against the last-known-good file list before touching the constant.`
      );
    }
    if (ALL_ROWS.length < TOKEN_ROW_FLOOR) {
      throw new Error(
        `Only ${ALL_ROWS.length} DIVERGES-token rows found, below the floor of ${TOKEN_ROW_FLOOR}. ` +
          `This floor may only be LOWERED after confirming which row(s) disappeared -- ` +
          `diff ALL_ROWS against the last-known-good row list before touching the constant.`
      );
    }
    expect(files.length).toBeGreaterThanOrEqual(AUDIT_FILE_FLOOR);
    expect(ALL_ROWS.length).toBeGreaterThanOrEqual(TOKEN_ROW_FLOOR);
  });

  it(`classifies rows into all four line-shapes (heading/table/bullet/fallback), each at or above its floor (heading>=${SHAPE_FLOORS.heading}, table>=${SHAPE_FLOORS.table}, bullet>=${SHAPE_FLOORS.bullet}, fallback>=${SHAPE_FLOORS.fallback}) (monotone-floor vacuous-grammar guard, DEC-180 wave-27)`, () => {
    const actual: Record<RowShape, number> = { heading: 0, table: 0, bullet: 0, fallback: 0 };
    for (const row of ALL_ROWS) actual[row.shape]++;
    for (const shape of Object.keys(SHAPE_FLOORS) as RowShape[]) {
      if (actual[shape] === 0) {
        throw new Error(
          `Shape "${shape}" is entirely unreached (0 rows) -- the grammar has gone vacuous for this shape. ` +
            `Every one of the four line-shapes must remain represented in the corpus.`
        );
      }
      if (actual[shape] < SHAPE_FLOORS[shape]) {
        throw new Error(
          `Shape "${shape}" has ${actual[shape]} rows, below its floor of ${SHAPE_FLOORS[shape]}. ` +
            `This floor may only be LOWERED after confirming which row(s) of this shape disappeared.`
        );
      }
    }
    expect(Object.values(actual).every((n) => n > 0)).toBe(true);
  });

  it(`never exceeds OPEN_DIVERGENCE_CEILING (${OPEN_DIVERGENCE_CEILING}) open divergence rows`, () => {
    if (OPEN_ROWS.length > OPEN_DIVERGENCE_CEILING) {
      const offenders = OPEN_ROWS.map((r) => `${r.file}:${r.line} [${r.shape}]`);
      throw new Error(
        `${OPEN_ROWS.length} open divergence rows, above the ratchet ceiling of ` +
          `${OPEN_DIVERGENCE_CEILING}. OPEN_DIVERGENCE_CEILING may only be LOWERED, never raised -- ` +
          `new unadjudicated debt landed. Offending rows:\n${offenders.join('\n')}`
      );
    }
    expect(OPEN_ROWS.length).toBeLessThanOrEqual(OPEN_DIVERGENCE_CEILING);
  });

  it('reaches at least one row from a NESTED audit file (a directory separator below docs/design/audit) -- proves the walk is recursive, not flat (DEC-099 wave-24 amendment, DEC-367/DEC-808 "a directory is not a population")', () => {
    const nestedRows = ALL_ROWS.filter((r) => r.file.slice('docs/design/audit/'.length).includes('/'));
    if (nestedRows.length === 0) {
      throw new Error(
        'No row in ALL_ROWS resolves from a nested audit file -- the population walk has gone flat again, ' +
          're-opening the blind spot DEC-099 wave-24 closed (docs/design/audit/settings-v12/ is currently ' +
          'the only nested directory; if it was ever removed, this assertion must be updated to point at ' +
          'whatever nested directory replaces it as the recursion witness, never simply deleted).'
      );
    }
    expect(nestedRows.length).toBeGreaterThan(0);
  });

  it(`never drops below OPEN_DIVERGENCE_CEILING (${OPEN_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling hides progress and licenses regrowth back up to it)`, () => {
    if (OPEN_ROWS.length < OPEN_DIVERGENCE_CEILING) {
      throw new Error(
        `${OPEN_ROWS.length} open divergence rows, below the ratchet ceiling of ` +
          `${OPEN_DIVERGENCE_CEILING}. This is the ratchet working: rows got adjudicated or fixed. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const OPEN_DIVERGENCE_CEILING = ${OPEN_ROWS.length};`
      );
    }
    expect(OPEN_ROWS.length).toBeGreaterThanOrEqual(OPEN_DIVERGENCE_CEILING);
    // goalComplete for this ledger is OPEN_ROWS.length reaching 0 -- every
    // recorded divergence adjudicated or fixed.
  });
});

describe('open-divergence ledger negative controls (DEC-099: every scan ships one, shape from test/clarifications-ledger.scan.test.ts)', () => {
  it('a bare heading-shape DIVERGES row with no DEC/DEVIATIONS citation anywhere in its section is OPEN', () => {
    const lines = ['## DIVERGES 1 -- something', '', 'No citation here at all.', '', '## Next heading'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.shape).toBe('heading');
    expect(rows[0]!.adjudicated).toBe(false);
  });

  it('a heading-shape row whose section later cites a DEC is ADJUDICATED, even many lines down', () => {
    const lines = ['## DIVERGES 1 -- something', '', 'Ruled by DEC-380 wave-32.', '', '## Next heading'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows[0]!.adjudicated).toBe(true);
  });

  it('a heading-shape row does NOT reach past the next heading for its citation (section boundary respected)', () => {
    const lines = ['## DIVERGES 1 -- something', '', 'No citation in this section.', '', '## Next heading (DEC-999)'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows[0]!.adjudicated).toBe(false);
  });

  it('a table-row-shape DIVERGES cell is adjudicated only by its OWN row, not a neighboring row', () => {
    const lines = [
      '| a | DIVERGES | no citation on this row |',
      '| b | DIVERGES | resolved, see DEC-101 |',
    ];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.adjudicated).toBe(false);
    expect(rows[1]!.adjudicated).toBe(true);
  });

  it('a bullet-shape DIVERGES row picks up citations from its own indented continuation lines but not a sibling bullet', () => {
    const lines = [
      '- **DIVERGES**: first finding',
      '  continues here with DEC-202 backing it.',
      '- **DIVERGES**: second finding, unrelated',
      '  no citation on this one.',
    ];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.adjudicated).toBe(true);
    expect(rows[1]!.adjudicated).toBe(false);
  });

  it('a fallback bare-prose DIVERGES line is adjudicated by docs/design/DEVIATIONS.md named in its own blank-line-delimited paragraph', () => {
    const lines = [
      'Some earlier unrelated paragraph.',
      '',
      '**DIVERGES** (structural). See docs/design/DEVIATIONS.md §7 for the ruling',
      'that settles this permanently.',
      '',
      'A later unrelated paragraph.',
    ];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.shape).toBe('fallback');
    expect(rows[0]!.adjudicated).toBe(true);
  });

  it('a fallback bare-prose DIVERGES line does NOT reach into the next blank-separated paragraph for its citation', () => {
    const lines = ['**DIVERGES** (structural). No citation in this paragraph.', '', 'Resolved by DEC-303 in the next paragraph, too late to count.'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows[0]!.adjudicated).toBe(false);
  });

  it('classifyLineShape resolves all four shapes correctly, including leading whitespace', () => {
    expect(classifyLineShape('## DIVERGES heading')).toBe('heading');
    expect(classifyLineShape('| cell | DIVERGES | cell |')).toBe('table');
    expect(classifyLineShape('  | indented table row DIVERGES |')).toBe('table');
    expect(classifyLineShape('- **DIVERGES**: bullet')).toBe('bullet');
    expect(classifyLineShape('  - nested bullet DIVERGES')).toBe('bullet');
    expect(classifyLineShape('Plain prose sentence with DIVERGES in it.')).toBe('fallback');
  });

  it('a compliant synthetic corpus (every row adjudicated) reports zero open rows -- proves the scan can pass', () => {
    const lines = ['## DIVERGES 1 -- fixed', '', 'Ruled by DEC-100.', '', '## end'];
    const rows = deriveRowsFromLines('synthetic.md', lines);
    expect(rows.every((r) => r.adjudicated)).toBe(true);
  });

  // WIDENED CLAIM VOCABULARY negative controls (task w31-d, DEC-099
  // wave-31 amendment). Both directions on synthetic fixtures, plus real
  // corpus files read by hand (per this task's own instruction): the
  // POSITIVE-trigger real files are comms-compose-desktop-v12.md:41
  // ("**Mostly MATCHES, with one blessed structural divergence...**",
  // bold-led), review-v12.md:63 is a table HEADER row and correctly does
  // NOT trigger (see header-row control below), and content-landing-390-
  // v12.md:65 ("## Divergence found", heading) all opened real rows in
  // this task's own measured run. The DENIAL real files are
  // overflow-390-v12.md:179 ("...cannot diverge — there is no head to
  // diverge.", table), density-pairing-v12.md:96 ("No other
  // divergence."), and content-landing-390-v12.md:38 ("...not a
  // divergence)", table) -- all three read by hand and confirmed absent
  // from this task's measured OPEN/adjudicated row list.
  describe('widened claim vocabulary (task w31-d, DEC-099 wave-31 amendment)', () => {
    it('a heading-shape line matching "divergence" (no literal DIVERGES token) opens a row', () => {
      const lines = ['## Divergence found', '', 'The frame draws two chips, the app renders three.', '', '## Next'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.shape).toBe('heading');
      expect(rows[0]!.adjudicated).toBe(false);
    });

    it('a bold-led verdict span matching "divergence" opens a row (fallback shape, per classifyLineShape)', () => {
      const lines = ['Some lead-in text.', '', '**Mostly MATCHES, with one real divergence.**', 'No citation follows.', '', 'Next paragraph.'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.shape).toBe('fallback');
      expect(rows[0]!.adjudicated).toBe(false);
    });

    it('a table-row cell matching "mismatch"/"does not match" opens a row', () => {
      const lines = ['| a | b | the label does not match the frame |'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.shape).toBe('table');
    });

    it('a table HEADER row naming its verdict column "What diverges" does NOT open a row (it is the column name, not a claim)', () => {
      const lines = ['| Frame | Verdict | What diverges |', '| --- | --- | --- |', '| :1 x | MATCHES | n/a |'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(0);
    });

    it('bare fallback prose mentioning "divergence" in passing (not heading/bold/table) does NOT open a row', () => {
      const lines = ['This is a plain sentence that mentions divergence in passing, never as its own verdict line.'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(0);
    });

    it('DENIAL: a table cell that DENIES a divergence ("no ... diverge") does NOT open a row', () => {
      const lines = ['| a | b | head and body cannot diverge — there is no head to diverge |'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(0);
    });

    it('DENIAL: a bold-led span that DENIES a divergence ("not a divergence") does NOT open a row', () => {
      const lines = ['**MATCHES, not a divergence.**'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(0);
    });

    it('DENIAL: a heading that DENIES a divergence ("No other divergence") does NOT open a row', () => {
      const lines = ['## Check passes: no other divergence.'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows).toHaveLength(0);
    });

    it('a widened row IS adjudicated when its own line/paragraph carries a DEC-NNN citation', () => {
      const lines = ['## Divergence found', '', 'Ruled by DEC-825.', '', '## Next'];
      const rows = deriveRowsFromLines('synthetic.md', lines);
      expect(rows[0]!.adjudicated).toBe(true);
    });

    it('real corpus file (read by hand): overflow-390-v12.md:179 denial does not appear in the measured OPEN or newly-widened row set', () => {
      const rows = ALL_ROWS.filter((r) => r.file.endsWith('overflow-390-v12.md') && r.line === 179);
      expect(rows).toHaveLength(0);
    });

    it('real corpus file (read by hand): density-pairing-v12.md denial lines do not open rows', () => {
      const rows = ALL_ROWS.filter((r) => r.file.endsWith('density-pairing-v12.md') && [60, 66, 96].includes(r.line));
      expect(rows).toHaveLength(0);
    });

    it('real corpus file (read by hand): content-landing-390-v12.md:38 ("not a divergence") does not open a row, but :65 ("## Divergence found") does', () => {
      const denialRow = ALL_ROWS.find((r) => r.file.endsWith('content-landing-390-v12.md') && r.line === 38);
      const headingRow = ALL_ROWS.find((r) => r.file.endsWith('content-landing-390-v12.md') && r.line === 65);
      expect(denialRow).toBeUndefined();
      expect(headingRow).toBeDefined();
      expect(headingRow!.shape).toBe('heading');
    });
  });

  // Two-sided companions for the two monotone-UPWARD vacuity floors
  // (DEC-808 wave-28 amendment, clause a), appended when both names were
  // registered in OUT_OF_CAMPAIGN_SCOPE and so entered
  // test/campaign-ratchet-two-sided.scan.test.ts's derived population. Each
  // floor already carries its FALL direction (the enumerator must still reach
  // at least this many files/rows). What was missing is the STALENESS
  // direction, and for a floor that is exactly the phone/desktop frame
  // ledgers' own CLAIMED_FLOOR shape: a floor left behind by a corpus that
  // has grown past it guards less every wave -- a stale floor licenses
  // stagnation -- so it is RAISED to the measurement in the same commit that
  // grows the corpus, and the throw names the exact replacement line.
  it(`AUDIT_FILE_FLOOR (${AUDIT_FILE_FLOOR}) is not stale below the enumerated audit-file count (a stale floor licenses stagnation)`, () => {
    const files = auditFiles();
    if (files.length > AUDIT_FILE_FLOOR) {
      throw new Error(
        `The enumerator reaches ${files.length} audit files, above the floor of ${AUDIT_FILE_FLOOR}. ` +
          `This is the guard working: the corpus grew. Raise the floor in the same commit by ` +
          `replacing the line:\n  const AUDIT_FILE_FLOOR = ${files.length};`
      );
    }
    expect(files.length).toBeLessThanOrEqual(AUDIT_FILE_FLOOR);
  });

  it(`TOKEN_ROW_FLOOR (${TOKEN_ROW_FLOOR}) is not stale below the enumerated DIVERGES-token row count (a stale floor licenses stagnation)`, () => {
    if (ALL_ROWS.length > TOKEN_ROW_FLOOR) {
      throw new Error(
        `The enumerator opens ${ALL_ROWS.length} DIVERGES-token rows, above the floor of ${TOKEN_ROW_FLOOR}. ` +
          `This is the guard working: the corpus grew. Raise the floor in the same commit by ` +
          `replacing the line:\n  const TOKEN_ROW_FLOOR = ${ALL_ROWS.length};`
      );
    }
    expect(ALL_ROWS.length).toBeLessThanOrEqual(TOKEN_ROW_FLOOR);
  });
});
