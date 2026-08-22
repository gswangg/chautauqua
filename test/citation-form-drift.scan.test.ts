// Citation-FORM-drift ratchet (DEC-967 amendment, task w11-t).
//
// WHY: five consecutive waves went red on the same defect -- a
// backtick-quoted citation keyed on a line number in a file someone else
// edits (test/decision-doc-citation.scan.test.ts's own
// UNRESOLVED_CITATION_CEILING population) -- and five consecutive merge
// trains RE-POINTED the line instead of converting the citation to the
// drift-proof shape that test/decision-doc-citation.scan.test.ts already
// blessed (DEC-967 wave-115, task w4-ab): a bare path immediately followed
// by a backtick quote, resolved against the WHOLE cited file rather than
// one pinned line. Commit 0603c596's own body: "Repointing would only
// drift again next wave" -- and the population is still there.
//
// This file does not check whether a citation is TRUE (that is
// test/decision-doc-citation.scan.test.ts's UNRESOLVED_CITATION_CEILING /
// WIDENED_UNRESOLVED_CITATION_CEILING job -- citation RESOLUTION). This
// file checks citation FORM: does a citation into app/src/, src/, test/,
// scripts/ or migrations/ still use the fragile line-keyed shape
// (`path:line` immediately followed by a backtick quote) instead of the
// drift-proof one. An integrity property of the ledger's own durability,
// not a v12 frame or 390-geometry conformance fact -- see this constant's
// entry in scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE.
//
// POPULATION: the SAME widened population
// test/decision-doc-citation.scan.test.ts already derives --
// src/decisions-data/DEC-*.md, docs/design/audit/*.md, docs/probes/*.md,
// docs/design/DEVIATIONS.md, docs/design/DESIGN-RULINGS.md and
// docs/mobile-campaign.md -- derived here by the SAME mechanism
// (readdirSync over each directory, never a hand-listed manifest; DEC-808:
// "a directory is not a population" cuts the other way too, you must
// actually read the directory). This file does not import that file's
// internals (only its two ratchet constants are exported) -- the
// enumeration is small and re-derived here directly against the
// filesystem, exactly the "same walk" discipline
// test/decision-doc-citation.scan.test.ts's own widened-population section
// uses for its four extra classes (readdirSync, never an assumption about
// a prior wave's count).
//
// DECOMPOSITION (custodian task custodian-test_citation_form_drift_scan_test_ts,
// contention hotspot -- 4 merge conflicts): population derivation lives in
// ./citation-form-drift/population.ts, repo-file resolution in
// ./citation-form-drift/repo-index.ts, the detector (regexes,
// quoteAfter, findLineKeyedOffenders) in ./citation-form-drift/detector.ts.
// This file re-exports findLineKeyedOffenders and LINE_KEYED_CITATION_CEILING
// (its only externally-referenced symbols) and keeps the describe/it block
// and the ratchet's own history/rationale comments -- pure extraction, no
// behavior change.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildPopulationClasses, type SourceDoc } from "./citation-form-drift/population";
import { BARE_PATH_RE, CITATION_RE, findLineKeyedOffenders, type Offender } from "./citation-form-drift/detector";

export { findLineKeyedOffenders } from "./citation-form-drift/detector";

const ROOT = resolve(__dirname, "..");

const POPULATION_CLASSES = buildPopulationClasses(ROOT);
const ALL_DOCS: SourceDoc[] = POPULATION_CLASSES.flatMap((c) => c.docs);

// vacuous-population tripwire needs these directly.
const DECISION_DOC_NAMES = POPULATION_CLASSES[0]!.docs.map((d) => d.doc.replace("src/decisions-data/", ""));

const OFFENDERS: Offender[] = ALL_DOCS.flatMap((d) => findLineKeyedOffenders(d.doc, d.content));

// ---------------------------------------------------------------------------
// Ratchet. Seeded at this branch's own measurement: forced to -1 first,
// the printed offender list (163 rows) was read and eyeballed for false
// positives. One systematic class was found and fixed in
// findLineKeyedOffenders (see the `:\d+(-\d+)?` quote-shape guard in
// ./citation-form-drift/detector.ts): three corpus rows write a SHORTHAND
// list of citations against the same file ("`test/foo.ts:291`/`:296`/`:299`",
// src/decisions-data/DEC-808.md:44 and two similar rows) where the detector
// was pairing the first citation with the SECOND citation's bare `:<line>`
// shorthand as if it were a quoted code receipt -- not a citation-plus-quote
// pair at all. Filtering that shape brought the count to 160; the remainder
// was read row by row and each is a genuine `path:line` citation immediately
// followed by a backtick-delimited literal, into app/src/, src/, test/ or
// scripts/ (no migrations/ hits in the corpus today). May only be LOWERED as
// citations are converted to the drift-proof bare-path shape, never raised
// to paper over a regression. v12m-w11-k and v12m-w11-l are converting
// citations in parallel with this task -- this ceiling will be stale by a
// handful the moment they land; the merge train reconciles it (task's own
// note).
// ---------------------------------------------------------------------------
// Thunderdome megabatch (wave 124): re-measured on the INTEGRATED tree
// after 15 lanes landed in one pass -- concurrent lanes drained the same
// population, so the combined truth is lower than any single branch saw.
// 160 -> 151. Lowering is a merge-train act (DEC-989).
// Thunderdome megabatch (wave 125): lowered 151 -> 144, the merge-train
// re-measurement this two-sided ratchet's own failure text asks for, taken
// on the fully integrated tree.
// Wave 127 (doc-citation repair lane): lowered 130 -> 93. The citation-repair
// pass that drove test/decision-doc-citation.scan.test.ts's two ratchets back
// to 0 fixed each stale coordinate the way THIS file prescribes wherever the
// quoted receipt still existed in the cited file -- by CONVERTING the citation
// to the drift-proof bare-path shape rather than re-pointing the line -- so 37
// line-keyed citations left the population in the same change that made them
// true. Re-measured by running this scan on the integrated tree (DEC-989
// clause a); the two-sided companion below is what forced the constant down.
// Wave 128/129 (merge train): lowered 92 -> 91. DEC-808's wave-128 amendment
// cited the hard-coded PublicSearchBox placeholder by line; task w3-q deleted
// that default outright, so the citation was rewritten to state the landed
// state in the drift-proof bare-path shape -- one more line-keyed citation out
// of the population, by exactly the conversion this file prescribes.
// Wave 132 (task w7-a): measured 94 on this branch before this task's own
// fix (other in-flight lanes had already raised the population above the
// stale 91 ceiling -- out of this task's scope, owned by the two other reds
// this batch owns). DEC-650.md:9's line-keyed citation to
// test/desktop-frames-settings-dialogs.test.ts:148 was converted to the
// drift-proof bare-path shape (app/src/pages/settings/ResourcesPanel.tsx`Add
// it`) in the same change, taking the measured count to 93 -- lowered 91 ->
// 93 to match, per the two-sided ratchet (never lowered below what was
// actually measured).
// Merge-train act (thunderdome megabatch, w9+w10): re-measured against the
// integrated tree at 83. Both contributing lanes measured against their own
// pre-merge base (main 92, v12m-w10-aa 80); 83 is the true count once every
// lane's citations coexist, and is still a LOWERING from main's 92.
// Wave 138 (task w13-aa, DEC-967 EXHIBIT grammar): before that task's own
// change, main had drifted this population to 86 (three more line-keyed
// citations landed elsewhere since the 83 ceiling was set). That task
// additionally excludes EXHIBIT!-sigilled citations from OFFENDERS outright
// (they are dead anchors with no live file/line to search a quote in -- see
// findLineKeyedOffenders's own comment): four of the population's
// line-keyed, backtick-quoted citations are src/decisions-data/DEC-967.md's
// own wave-136/wave-137 catalogue entries (the src/db/schema.ts,
// src/server/repo/agenda.ts, src/routes/auth.tsx and
// src/server/repo/files-library.ts / ExportsPanel.tsx coordinates, each
// sigilled there), dropping the measured count 86 -> 82.
// Wave v12m-w14-jj (drift drain): converted the nine line-keyed citations
// living in docs/probes/metafid-phoneB-ssr-2026-08-19.md to the drift-proof
// bare-path shape, quoting a stable identifier (`setStep(`,
// `reportValidity()`, `data-field-id`, `resolvedTextCap`) rather than a
// whole statement for the two citations into
// src/routes/public/cfp-steps-script.tsx and src/views/form-render.tsx,
// since v12m-w14-ff and v12m-w14-gg edited those files the same wave -- a
// bare-path citation only needs its quote to still resolve verbatim
// ANYWHERE in the file, so an identifier survives a statement-level edit a
// whole-line quote would not.
// Merge-train act (thunderdome megabatch, wave-138/139 backlog of 14): the
// ceiling is RE-MEASURED against the integrated tree here -- every lane's
// conversions and every lane's newly-landed docs coexist for the first
// time, so neither lane's own pre-merge figure (main 82, v12m-w14-jj 113)
// is the truth. Lowering the ceiling to the integrated measurement is a
// merge-train act, exactly as the two-sided ratchet's own failure message
// instructs. Measured on the integrated tree: 107. This is a RAISE from
// main's 82, and it is disclosed as one rather than papered over: the
// megabatch lands fourteen lanes' new docs at once (the wave-138/139/140
// probe and DEC amendments each cite work in flight), and jj's own drain
// measured 122 -> 113 against a base that already carried most of them.
// The two-sided ratchet cannot be satisfied by main's 82 while those docs
// exist, so 107 is the true integrated figure; the NEXT drain lane lowers
// it from here, and no lane may raise it again without a re-measurement.
// Merge-train act (wave-16 batch: w15-hh, custodian-w15-3, w16-cc/dd/ee):
// LOWERED 107 -> 100 against the integrated tree, exactly as the two-sided
// ratchet's own failure message instructs. w16-cc converted the last of
// DEC-367/DEC-681/DEC-909/DEC-919/DEC-976/DEC-986's line-keyed registry
// citations to the drift-proof bare-path shape and w16-dd did the same for
// the code-comment population, so the drop is earned conversions, not a
// shrinking corpus. Re-measured, never guessed. Final figure 99, not 100:
// the same merge-train pass sigilled the four path:NNN coordinates the
// scribe's wave-142 DEC-967 amendment exhibits, and an EXHIBIT! coordinate
// leaves this scan's population outright (a dead anchor has no live file to
// convert a citation into).
// Wave-141 (task w16-aa, DEC-967/DEC-808): 107 -> 65 on that lane's own
// base. Drained
// docs/design/audit/code-comment-citation-v12.md, the single file that
// (per this task's own citation) carried 42 of the 107 offenders (its
// "Wave-141 repair pass" section converts every one to the drift-proof
// bare-path shape or an EXHIBIT!-sigilled dead anchor). This is a real
// LOWERING below main's pre-raise 82, not merely below the erroneous 107
// -- the commit that raised 82 -> 107 without widening the predicate did
// so on a lower-only ratchet with no predicate change, which this task's
// own instructions called out as the exact violation five prior merge
// trains committed and five prior waves un-did. Re-measured by forcing
// this constant to -1 and reading the printed offender list; the
// remaining 65 are all outside this task's scope (src/decisions-data/**,
// owned by task w16-cc; the other docs/design/audit/*.md files and
// docs/probes/*.md, untouched by this task's citation).
// Merge-train act (thunderdome megabatch, wave-16/17 backlog of 15): the
// wave-16 batch's 99 and w16-aa's 65 were measured against DIFFERENT bases
// and drained DIFFERENT corpora (w16-cc/dd the registry and code-comment
// populations, w16-aa the code-comment-citation-v12.md audit doc), so
// neither figure survives their coexistence. RE-MEASURED against the fully
// integrated tree, exactly as the two-sided ratchet's failure message
// instructs.
// Wave v12m-w19-g (registry drain): measured 57 on this branch (forced to
// -1, offender list read row by row). 32 of the 57 lived in
// src/decisions-data/DEC-*.md, this lane's entire scope per its own task
// description; the remaining 25 (docs/design/audit/**, docs/probes/**) are
// owned by other lanes and untouched here. All 32 registry offenders were
// converted to the drift-proof bare-path shape (drop ":line", keep the
// backtick-quoted receipt, quote still resolves verbatim in its cited
// file) -- no ruling's MEANING changed, only the citation's coordinate
// shape. Re-measured after the conversion: 25, all outside
// src/decisions-data/. Lowered 57 -> 25.
//
// Merge train (wave-148 megabatch: w4-ak/ai/al/aj/am/an): this ratchet was
// already RED on main at 25 against a stale ceiling of 24. Repairing the
// citations the batch itself drifted (DEC-555, DEC-829, DEC-660 and the
// DEC-967 narrative quoting the very citation it rules against, all
// converted to the bare-path shape DEC-967 wave-115 requires) also repaid
// that inherited breach, and the two duplicate line-keyed citations into
// app/src/phone-block-visibility.test.ts in docs/probes/
// metafid-desktop-2026-08-19.md were converted alongside them. Re-measured
// against the integrated tree: 23. Lowered 24 -> 23.
// Wave v12m-w5-ba (task w5-ba, DEC-967): re-measured on this branch (main
// 766c2f92) forced to -1, offender list read row by row: 26. This lane's
// scope is exactly four registry files -- src/decisions-data/DEC-555.md,
// DEC-660.md, DEC-829.md, DEC-908.md -- each converted from a line-keyed
// citation to the drift-proof bare-path shape (DEC-555's stale `otherTitle`
// quote was also corrected to the file's real `joined` variable; DEC-829's
// stale 'recipient' quote corrected to 'speaker', matching
// RemindPreviewModal.tsx's wave-148 noun change; DEC-660's and DEC-908's
// quotes already resolved verbatim and only lost their ":line"). None of
// the four appear in this branch's post-conversion offender list. The
// remaining 26 are all OUTSIDE this lane's scope: DEC-967.md's own
// wave-136/137 catalogue re-cites src/mail/render.ts:163 a second time (a
// different registry file than DEC-660.md, untouched here), and the rest
// live in docs/design/audit/**, docs/probes/** and docs/mobile-campaign.md,
// which v12m-w5-bb and v12m-w5-bc are draining CONCURRENTLY on the same
// population (sibling lanes of this task, per DEC-989: the integrated
// re-measure belongs to the merge train, this ceiling reflects only this
// branch's own measurement). This is a RAISE from the prior wave's 24: not
// to paper over a regression, but because this branch's own measurement
// (26) is genuinely above 24 once the sibling lanes' still-unconverted
// citations coexist with this lane's own true count -- the two-sided
// ratchet's failure message requires writing the measured figure, and the
// merge train reconciles the final integrated number (DEC-989).
// Wave 149 (task w5-bc, mandate/probe drain; siblings v12m-w5-ba draining
// src/decisions-data/DEC-*.md and v12m-w5-bb draining docs/design/audit/*.md
// against the same population): measured 30 on this branch (forced to -1,
// offender list read row by row) -- main had drifted the population up from
// 24 while other lanes wrote fresh line-keyed citations. This task's own
// scope is exactly four files (docs/probes/metafid-desktop-2026-08-19.md,
// docs/probes/metafid-round2-2026-08-20.md, docs/probes/metafid-round3-2026-08-20.md,
// docs/mobile-campaign.md); converted its eight offenders there to the
// drift-proof bare-path shape (drop ":line", keep the backtick-quoted
// receipt, quote still resolves verbatim in its cited file). Re-measured
// after the conversion: 22. This is a RAISE from the stale 24 -> 30 the
// scan found on main before this task's own fix, then a real LOWERING
// 30 -> 22 from this task's own drain; the merge train reconciles the
// remainder once the two sibling lanes land theirs.
// Wave v12m-w5-bb: converted all 16 line-keyed citations owned by this
// task (docs/design/audit/comms-drill-v12.md, desktop-frame-ledger-v12.md,
// phone-dock-declaration-v12.md, phone-tap-floor-links.md,
// review-tap-floor-v12.md and review-v12.md) to the drift-proof bare-path
// shape -- each converted quote re-verified to still resolve verbatim in
// its cited file. Measured on this branch (forced to -1, offender list
// read row by row): 30 -> 14. Sibling lanes v12m-w5-ba
// (src/decisions-data/*.md) and v12m-w5-bc (docs/probes/*,
// docs/mobile-campaign.md) are draining the remaining 14 offenders
// concurrently against their own bases, so 14 is THIS branch's figure,
// not necessarily the merge train's -- per DEC-989 wave-146, the
// integrated tree is the merge train's to re-measure once all three
// lanes land.
//
// THUNDERDOME MEGABATCH (wave-150, 19-branch batch): each lane above
// measured this ratchet against a tree carrying only its OWN work, so no
// lane's figure is the truth for the integrated tree -- the lanes' repairs
// and dispositions are additive and their union moves the count further
// than any single lane could see. Per the two-sided ratchet's own failure
// message the constant below is re-seeded ONCE, at the end of the batch,
// to what the ratchet actually PRINTS against the fully integrated tree
// (ceiling forced to -1, offender list read back) -- never a lane's
// pre-merge figure and never a guess.
// Measured against the fully integrated megabatch tree: 4. Lowered 26 -> 4.
//
// THUNDERDOME MEGABATCH (wave-152, post-batch repair pass): the wave-152
// scribe amendments to DEC-908/DEC-919/DEC-967 each wrote a NEW line-keyed
// citation, taking the integrated count 4 -> 7 -- the shape DEC-967's own
// wave-152 ruling ("a line-keyed ledger entry is a citation and rots
// exactly like one") forbids, breached by the ruling that states it.
// Repaid by the wave that breached it, per DEC-967 wave-149, rather than
// deferred: DEC-908's and DEC-919's were CONVERTED to the drift-proof
// bare-path shape this file prescribes (never re-pointed), and DEC-967's
// two were sigilled EXHIBIT! -- both are dead anchors the ruling
// CATALOGUES as evidence (a stale ledger key, a suffix-fragment path), so
// the drift-proof shape is unavailable to them by construction and the
// inverted grading in test/decision-doc-citation.scan.test.ts re-verifies
// each run that they are still broken. The same pass re-graded
// docs/design/audit/frame-caption-residue-v12.md's three rows CLOSED (the
// megabatch BUILT the gaps they recorded), retiring their three drifted
// line-keyed citations into drift-proof form in the same edit.
// Re-measured against the integrated tree (forced to -1, offender list read
// back): 1 -- the sole survivor is DEC-967's own cfp.css.ts:118-122
// self-quoting paragraph. Lowered 4 -> 1.
// Wave v12m-w11-pd: the last surviving offender,
// src/decisions-data/DEC-967.md's self-quoted `cfp.css.ts:118-122,443-447`
// illustrative idiom, was itself an example of the fragile shape it was
// describing -- converted to the bare-path + whole-file-quote form
// (`src/routes/public/cfp.css.ts` `.chq-cfp-identity-note`). Measured 1 -> 0.
// RATCHET: LINE_KEYED_CITATION_CEILING=0
export const LINE_KEYED_CITATION_CEILING = 0;

describe("citation-form-drift scan: line-keyed citations into app/src, src, test, scripts, migrations (DEC-967 amendment, task w11-t)", () => {
  it("vacuous-population tripwire: the population is non-empty and contains a known member", () => {
    expect(DECISION_DOC_NAMES.length).toBeGreaterThan(0);
    expect(DECISION_DOC_NAMES).toContain("DEC-986.md");
    expect(ALL_DOCS.length).toBeGreaterThan(0);
  });

  it(
    "count of line-keyed, backtick-quoted citations into app/src/src/test/scripts/migrations never exceeds " +
      "LINE_KEYED_CITATION_CEILING (may only be lowered, by converting a citation to the drift-proof bare-path " +
      "shape -- never by raising the constant)",
    () => {
      if (OFFENDERS.length > LINE_KEYED_CITATION_CEILING) {
        throw new Error(
          `${OFFENDERS.length} line-keyed citations found, above the ratchet ceiling of ` +
            `${LINE_KEYED_CITATION_CEILING} (may only be LOWERED, never raised to paper over a regression). ` +
            `Convert each to the drift-proof bare-path shape (path immediately followed by a backtick quote, no ` +
            `":line", resolved anywhere in the cited file -- DEC-967 wave-115):\n` +
            OFFENDERS.map((o) => `  ${o.doc}: "${o.matchText}\`${o.quote}\`" -> ${o.relPath}:${o.line}`).join("\n"),
        );
      }
      expect(OFFENDERS.length).toBeLessThanOrEqual(LINE_KEYED_CITATION_CEILING);
    },
  );

  it("the ceiling is not stale: the measured offender count is not below LINE_KEYED_CITATION_CEILING (two-sided ratchet)", () => {
    if (OFFENDERS.length < LINE_KEYED_CITATION_CEILING) {
      throw new Error(
        `citation-form-drift.scan: LINE_KEYED_CITATION_CEILING (${LINE_KEYED_CITATION_CEILING}) exceeds the ` +
          `measured offender count (${OFFENDERS.length}). Lowering the ceiling is a merge-train act, not a ` +
          `worker's -- replace the line:\n  export const LINE_KEYED_CITATION_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(LINE_KEYED_CITATION_CEILING);
  });

  // --- Synthetic controls --------------------------------------------------
  // Fabricated citation text, not read from any real doc -- proves the
  // detector fires on the fragile shape and does not fire on either the
  // drift-proof conversion or a frame (.dc.html) citation.

  it("positive control: fires on a fabricated line-keyed quoted citation into scope", () => {
    const fixture = "See scripts/exit-predicate.ts:17 which reads `const HEADER_RE = /.../`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ relPath: "scripts/exit-predicate.ts", line: "17" });
  });

  it("positive control: fires on a fabricated line-RANGE-keyed quoted citation into scope", () => {
    const fixture = "See app/src/styles.css:10-20 which reads `body { margin: 0; }`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ relPath: "app/src/styles.css", line: "10-20" });
  });

  it("negative control: does NOT fire on the same citation converted to drift-proof bare-path form", () => {
    const fixture = "See scripts/exit-predicate.ts which still reads `const HEADER_RE = /.../`.";
    CITATION_RE.lastIndex = 0;
    expect(CITATION_RE.test(fixture)).toBe(false);
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("negative control: does NOT fire on an EXHIBIT!-sigilled line-keyed quoted citation (dead anchor, no drift-proof conversion available)", () => {
    const fixture = "See EXHIBIT!scripts/exit-predicate.ts:17 which used to read `const HEADER_RE = /.../`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("positive control: still fires on the same citation with the sigil written far away (attachment is anchored, not paragraph-wide)", () => {
    const fixture =
      "EXHIBIT!scripts/some-other-dead-thing.ts:1 was retired long ago. Elsewhere, live: " +
      "scripts/exit-predicate.ts:17 reads `const HEADER_RE = /.../`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ relPath: "scripts/exit-predicate.ts", line: "17" });
  });

  it("negative control: does NOT fire on a docs/design/*.dc.html frame citation (structural carve-out)", () => {
    const fixture = "See docs/design/audit/Speakers.dc.html:492 which reads `<th>Name</th>`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("negative control: does NOT fire on a line-keyed citation with no immediately-following quote", () => {
    const fixture = "See scripts/exit-predicate.ts:17 for the header regex, discussed further below.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("negative control: does NOT fire on a line-keyed citation whose path resolves OUTSIDE the in-scope directories", () => {
    const fixture = "See docs/mobile-campaign.md:1 which reads `# mobile campaign`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("BARE_PATH_RE sanity: a bare path with no line number still matches the drift-proof shape's grammar", () => {
    BARE_PATH_RE.lastIndex = 0;
    expect(BARE_PATH_RE.test("scripts/exit-predicate.ts")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Backtick-parity guard (DEC-967 wave-28 amendment, task v12m-w28-e).
//
// WHY: the third wave running, an amendment landed with its heading pasted
// INSIDE the previous section's still-open backtick code span (a stray odd
// number of backtick characters somewhere upstream in the same file), and
// test/decision-doc-citation.scan.test.ts's UNRESOLVED_CITATION_CEILING only
// caught it downstream, as an unresolved-quote count, with no indication of
// WHERE or WHY. A cheap, mechanical, by-name check: every markdown file
// under src/decisions-data/ and decisions/ must contain an EVEN number of
// backtick (`` ` ``) characters. Markdown backtick spans are always opened
// and closed in pairs (single backtick code spans and double-backtick spans
// alike each contribute an even number of backtick characters); a file with
// an odd count has an unclosed span somewhere, and anything appended after
// that point -- an amendment heading, a citation, a quote -- is silently
// swallowed into the wrong span. This check says so BY NAME, at the file
// level, rather than waiting for a downstream citation-resolution count to
// go red with no clue which file or line broke.
//
// This is a FORM check only (parity), not a resolution check -- it does not
// know or care whether any individual citation resolves; that is still
// test/decision-doc-citation.scan.test.ts's job. It exists purely to catch
// the specific failure mode (an amendment appended inside an open span)
// immediately and by name.
//
// RATCHET, not an invariant: forced to -1 on this branch and read by name,
// four pre-existing files (none owned by this task: DEC-681.md, DEC-909.md,
// DEC-919.md, DEC-986.md) already carry an odd backtick count today, for
// reasons unrelated to this task's citation (long unrelated docs, not
// audited here -- out of this task's stated scope, which owns only
// DEC-976.md, DEC-967.md, and any decisions/*.md drained). Asserting a hard
// zero would either block on unrelated pre-existing debt or require editing
// files this task does not own; ratcheting the population -- same two-sided
// shape as every other citation ceiling in this campaign (DEC-808) --
// still fails IMMEDIATELY AND BY NAME the moment a NEW file goes odd (this
// wave's own failure mode), which is the whole point, while leaving the
// pre-existing four for the lane that next opens their file to drain
// (mirrors the field guide's "A HAND-LISTED POPULATION IS NOT A
// POPULATION" -- readdirSync-derived, re-measured every run, never
// snapshotted).
describe("backtick-parity guard: every decisions-data/decisions doc has an EVEN number of backticks (DEC-967 wave-28)", () => {
  const ROOT2 = resolve(__dirname, "..");

  /** Every DEC-*.md file directly under `dir`, enumerated by readdirSync --
   * never a hand-listed manifest (DEC-808: "a directory is not a
   * population"). */
  function decisionDocFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^DEC-\d+\.md$/.test(e.name))
      .map((e) => e.name)
      .sort();
  }

  function backtickCount(content: string): number {
    return (content.match(/`/g) ?? []).length;
  }

  const DIRS: { label: string; dir: string }[] = [
    { label: "src/decisions-data", dir: join(ROOT2, "src", "decisions-data") },
    { label: "decisions", dir: join(ROOT2, "decisions") },
  ];

  interface ParityOffender {
    label: string;
    name: string;
    count: number;
  }

  function findParityOffenders(): ParityOffender[] {
    return DIRS.flatMap(({ label, dir }) =>
      decisionDocFiles(dir)
        .map((name) => ({ label, name, count: backtickCount(readFileSync(join(dir, name), "utf8")) }))
        .filter((o) => o.count % 2 === 1),
    );
  }

  // Seeded at this branch's own measurement (forced to -1, printed offender
  // list read by name): 4 pre-existing offenders, all in src/decisions-data/,
  // none owned by this task. May only be LOWERED as each file is repaired at
  // its citation site, never raised to paper over a new regression.
  const BACKTICK_PARITY_CEILING = 4;

  it("vacuous-population tripwire: both directories are actually walked and contain files", () => {
    for (const { label, dir } of DIRS) {
      const files = decisionDocFiles(dir);
      expect(files.length, `${label} contributed zero DEC-*.md files`).toBeGreaterThan(0);
    }
  });

  it(
    "count of DEC-*.md files with an ODD backtick count (an unclosed code span) never exceeds " +
      "BACKTICK_PARITY_CEILING (may only be lowered, by closing the span at its real verbatim boundary -- " +
      "never by raising the constant)",
    () => {
      const offenders = findParityOffenders();
      if (offenders.length > BACKTICK_PARITY_CEILING) {
        throw new Error(
          `${offenders.length} file(s) carry an ODD number of backtick characters, above the ratchet ceiling ` +
            `of ${BACKTICK_PARITY_CEILING} -- an amendment or citation landed inside an unclosed code span. ` +
            `Close the span at its real verbatim boundary; never raise this ceiling to paper over it:\n` +
            offenders.map((o) => `  ${o.label}/${o.name}: ${o.count} backticks`).join("\n"),
        );
      }
      expect(offenders.length).toBeLessThanOrEqual(BACKTICK_PARITY_CEILING);
    },
  );

  it("the ceiling is not stale: the measured offender count is not below BACKTICK_PARITY_CEILING (two-sided ratchet)", () => {
    const offenders = findParityOffenders();
    if (offenders.length < BACKTICK_PARITY_CEILING) {
      throw new Error(
        `backtick-parity guard: BACKTICK_PARITY_CEILING (${BACKTICK_PARITY_CEILING}) exceeds the measured ` +
          `offender count (${offenders.length}). Lower the constant: ` +
          `export const BACKTICK_PARITY_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(BACKTICK_PARITY_CEILING);
  });

  // --- Synthetic controls --------------------------------------------------

  it("positive control: an odd backtick count is detected", () => {
    const fixture = "Some text `opened but never closed and more prose after it.";
    expect(backtickCount(fixture) % 2).toBe(1);
  });

  it("positive control: an amendment heading pasted inside a still-open span reproduces an odd count", () => {
    const fixture =
      "`npx vitest run app/src/frame-citation.scan.test.ts is green (23/23).\n\n" +
      "## Amendment (wave 27)\n\nFour ledgers grade the words the pack draws.";
    expect(backtickCount(fixture) % 2).toBe(1);
  });

  it("negative control: a well-formed file with properly paired code spans has an even count", () => {
    const fixture = "See `path/to/file.ts:17` which reads `const X = 1;` and later `another span`.";
    expect(backtickCount(fixture) % 2).toBe(0);
  });

  it("negative control: a file with zero backticks has an even (zero) count", () => {
    expect(backtickCount("No code spans here at all.") % 2).toBe(0);
  });
});
