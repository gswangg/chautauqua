// Desktop-frame claim ledger (DEC-976 amendment, v12 mobile campaign wave 99;
// task v12m-w2-f).
//
// The campaign's goal is "every screen matches its v12 frame on desktop AND
// phone". test/phone-frame-ledger.scan.test.ts has answered the phone half
// since wave 83 by deriving its population from the pack (53 frames, a
// per-file breakdown as a vacuous-population tripwire, claim-by-citation, a
// two-sided CLAIMED_FLOOR). Nothing has ever answered the desktop half --
// "desktop is frozen and already conformant" is eighteen waves of assumption
// with no instrument behind it (field guide, DEC-976 wave-99 amendment). This
// is that instrument. It mirrors the phone ledger's structure, idioms and
// comment discipline; it does not touch that file (a separate lane owns the
// phone half) and it does not touch any desktop CSS or markup -- this ships
// an instrument, not a redesign.
//
//   1. POPULATION: readdirSync docs/design for *.dc.html (never a
//      hand-listed file list). Within each file, every label span matching
//      the phone ledger's own grammar (`font-size:19px ... >TITLE<`) opens a
//      frame whose extent runs to the next label span, or EOF. Unlike the
//      phone ledger -- which anchors a frame on its `width:390px`+`height:844`
//      line and resolves the title from the nearest PRECEDING label -- here
//      every label itself opens a frame, because a desktop frame has no
//      `width:390px` marker of its own to anchor on. A frame is DESKTOP when
//      its extent (the label line up to, but not including, the next label
//      line) contains no `width:390px`+`height:844` line anywhere in it --
//      i.e. it isn't the phone ledger's population wearing a different hat.
//      A vacuous-population tripwire (exact total label count 161, exact
//      total pre-exclusion desktop count 108, exact per-file breakdown after
//      exclusion) guards against the grammar silently matching nothing, or
//      matching something else, and the whole scan passing green over an
//      empty set.
//
//   2. EXCLUSIONS -- written, justified, and asserted against the pack so a
//      re-cut cannot silently grow the list:
//        a. TEMPLATE INTERPOLATIONS -- a label whose title is itself a
//           `{{ ... }}` Mustache-style interpolation is documentation of a
//           data binding, not a screen a v12 frame draws. This is a PATTERN
//           exclusion (title matches /^\{\{.*\}\}$/), not a hand-picked list,
//           and it currently matches three labels in the pack: `{{ e.name }}`
//           at Chautauqua Home.dc.html:205, `{{ e.name }}` at Chautauqua
//           Comms.dc.html:695, and `{{ s.name }}` at Chautauqua Public and
//           Portal.dc.html:716. All three are asserted below by exact
//           citation so the pattern's reach is visible, not just its rule.
//        b. EXPLAINER PANELS -- the pack's own documentation panels, not
//           screens: "Widths · what a wide monitor gets" (Chautauqua
//           Overview.dc.html:353), "Rules you can't see on the page"
//           (Chautauqua Home.dc.html:326), "How the screenshots are made"
//           (Chautauqua Docs.dc.html:210). These are a hand-picked, exact
//           file:line:title list (a pattern cannot distinguish an explainer
//           panel from a real screen by its title alone) -- each is asserted
//           below to still resolve to its cited line, so this list rots
//           loudly like any other citation the moment the pack is re-cut.
//        c. DEVIATION-DEFERRED (DEC-976 wave-107 amendment, DERIVED from
//           docs/design/DEVIATIONS.md's "## 6. Deferred post-deadline"
//           section, never hand-listed) -- two frames the user has ruled
//           deliberately out of scope for this build: Chautauqua
//           Settings.dc.html:1111 ("Settings · editing your data") and
//           :1507 ("Import from Sessionboard"). ALL_FRAMES (102, after
//           exclusions a and b) still contains both of these -- they are
//           real, citable frame labels -- but EXCLUDED removes them from the
//           CLAIMABLE population (see REACHABLE_FRAMES below), because a
//           user-deferred frame is not merely "not yet built", it is "not
//           to be built", and no test may claim it (DEC-180 wave-25: a
//           claim population must measure what its floor is pinned to, not
//           the frame count the floor happens to share a name with).
//
//   3. CLAIM: identical to the phone ledger -- a frame is claimed when some
//      *.test.ts/*.test.tsx under test/ or app/src/ (enumerated, never
//      named) cites `docs/design/<file>.dc.html:<line>` with a line landing
//      inside that frame's extent. CLAIMS is scanned over REACHABLE_FRAMES
//      (ALL_FRAMES minus EXCLUDED, i.e. the 100 frames a real test is
//      actually allowed to claim), not over the full 102-wide ALL_FRAMES --
//      DEC-180 wave-25. Before this fix CLAIMS scanned all 102, which meant
//      a single stray citation landing inside either deviation-deferred
//      frame's extent would push CLAIMS to 101: past CLAIMED_FLOOR (making
//      the two-sided "never claims MORE" ratchet fail) and, worse, would
//      silently record a user-deferred, deliberately-unbuilt feature as
//      covered. Restricting the scan to REACHABLE_FRAMES makes 100 the
//      structural ceiling of CLAIMS, so CLAIMED_FLOOR (100) is a floor on
//      exactly the population it is pinned to, not on 102 minus an
//      after-the-fact tripwire.
//
//   4. RATCHET, never an allowlist populated from the failure output (the
//      house rule stated verbatim in app/src/phone-tap-target.scan.test.ts:
//      30-32, and honoured identically by the phone ledger): CLAIMED_FLOOR is
//      a single exported const, set to the count actually measured on this
//      branch, against the REACHABLE (102 - 2 deviation-deferred = 100)
//      population. It may only be RAISED in a future wave as more desktop
//      frames get claimed by real desktop-parity tests; it must never be
//      lowered to paper over a regression. Two-sided, mirroring the phone
//      ledger's wave-85 amendment: a companion test FAILS when the measured
//      claim count rises above CLAIMED_FLOOR, printing the exact replacement
//      line, so a stale floor cannot survive a wave that actually lands
//      coverage. The failure message names every unclaimed reachable desktop
//      frame as `<file> :<line> -- <title>` so a planner can schedule it. A
//      separate `it` additionally asserts, directly rather than by
//      arithmetic, that the two deviation-deferred frames carry zero
//      citations anywhere in the corpus this file scans.
//
//   5. A citation is not an assertion (DEC-976's frame-truth half, applied
//      here to the ledger's own inputs, identical to the phone ledger): a
//      separate `it` asserts every citation that claimed a frame actually
//      resolves to a real line number in the named frame file.
//
// goalComplete for the desktop half of the v12 mobile campaign is
// CLAIMED_FLOOR reaching the full reachable desktop population (100 of 100),
// which together with the 2 deviation-deferred frames accounts for the whole
// 102-frame pack.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const TEST_ROOT = HERE;
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');

// -- Population: every font-size:19px label span in docs/design ------------

interface RawLabel {
  /** 1-based line number of the font-size:19px label span. */
  line: number;
  title: string;
}

interface Frame {
  /** Repo-relative frame file, e.g. "docs/design/Chautauqua Speakers.dc.html". */
  file: string;
  /** Bare filename under docs/design/, e.g. "Chautauqua Speakers.dc.html". */
  fileName: string;
  /** 1-based line number of the label span that opens this frame. */
  line: number;
  title: string;
  /** Extent end (exclusive): the next label line in the same file, or
   * Infinity if this is the last labelled block in the file. */
  extentEnd: number;
}

// Same grammar the phone ledger uses for its own title resolution, widened
// to accept any closing tag rather than only `</span>` -- desktop labels are
// sometimes set on an `<a>` (e.g. Chautauqua Home.dc.html:205), and the
// vacuous-population tripwire below (161 total labels, matching the
// field-guide's independently-derived count) confirms this widened grammar
// is the one the pack actually uses, not an accidental over-match.
const LABEL_RE = />([^<]+)<\//;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to the phone ledger's own designFiles(). */
function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** 1-based line number of `fileName`'s single `</x-dc>` template close tag.
 * Ported (never imported -- each of the four desktop-ledger files carries
 * its own copy, per this file's existing convention of self-contained scan
 * files) so every frame extent clips at the template's own close rather
 * than running into `<script data-dc-script>` or past EOF (DEC-967 wave-41
 * amendment). Throws loudly if the tag is missing or appears more than
 * once, so a re-cut pack that breaks the one-close-per-file invariant fails
 * immediately instead of silently mis-clipping every extent in the file. */
// `root` defaults to DESIGN_ROOT for every real population walk; the
// non-vacuity control test below is the only caller that ever passes a
// tmpdir instead, so a fabricated frame past a copy's own `</x-dc>` can be
// exercised through these exact functions rather than a re-implementation.
function templateCloseLine(fileName: string, root: string = DESIGN_ROOT): number {
  const full = join(root, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const matches: number[] = [];
  lines.forEach((content, idx) => {
    if (content.includes('</x-dc>')) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fileName}: expected exactly one </x-dc>, found ${matches.length}`);
  }
  return matches[0]!;
}

function labelsInFile(fileName: string, root: string = DESIGN_ROOT): RawLabel[] {
  const full = join(root, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels: RawLabel[] = [];
  lines.forEach((content, idx) => {
    if (!isLabelLine(content)) return;
    const m = content.match(LABEL_RE);
    if (m) labels.push({ line: idx + 1, title: m[1]!.trim() });
  });
  return labels;
}

/** Every label-opened frame in `fileName`, tagged with whether its extent
 * contains a phone (width:390px+height:844) line -- i.e. whether it is the
 * phone ledger's population wearing this file's label grammar. */
function allFramesInFile(fileName: string, root: string = DESIGN_ROOT): { frame: Frame; isPhone: boolean }[] {
  const full = join(root, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels = labelsInFile(fileName, root);

  const closeLine = templateCloseLine(fileName, root);
  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = Math.min(nextLabel ? nextLabel.line : Infinity, closeLine);
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isFrameLine);
    return {
      frame: { file: relFile, fileName, line: label.line, title: label.title, extentEnd },
      isPhone,
    };
  });
}

const TOTAL_LABELS: number = designFiles().reduce((n, f) => n + labelsInFile(f).length, 0);

const ALL_DESKTOP_FRAMES_PRE_EXCLUSION: Frame[] = designFiles().flatMap((f) =>
  allFramesInFile(f)
    .filter((entry) => !entry.isPhone)
    .map((entry) => entry.frame)
);

// -- Exclusions --------------------------------------------------------------

/** A label whose entire title is a `{{ ... }}` Mustache interpolation is
 * documentation of a data binding, not a screen. Pattern exclusion, not a
 * hand-picked list -- see EXPECTED_TEMPLATE_TITLES below for what it
 * currently reaches. */
const TEMPLATE_INTERPOLATION_RE = /^\{\{.*\}\}$/;

function isTemplateInterpolation(frame: Frame): boolean {
  return TEMPLATE_INTERPOLATION_RE.test(frame.title);
}

/** Exact citations the template-interpolation pattern is expected to reach
 * today. Asserted below so the pattern's blast radius is visible and a
 * re-cut that silently grows it fails loudly. */
const EXPECTED_TEMPLATE_TITLES = [
  { fileName: 'Chautauqua Home.dc.html', line: 205, title: '{{ e.name }}' },
  { fileName: 'Chautauqua Comms.dc.html', line: 695, title: '{{ e.name }}' },
  { fileName: 'Chautauqua Public and Portal.dc.html', line: 716, title: '{{ s.name }}' },
];

/** The pack's own explainer/documentation panels -- not screens, so not
 * desktop frames. A pattern cannot distinguish these from a real screen by
 * title alone, so this is a hand-picked, exact file:line:title list,
 * asserted below to still resolve to its cited line (rots loudly like any
 * other citation on a re-cut). */
const EXPLAINER_PANELS = [
  { fileName: 'Chautauqua Overview.dc.html', line: 353, title: "Widths · what a wide monitor gets" },
  { fileName: 'Chautauqua Home.dc.html', line: 326, title: "Rules you can't see on the page" },
  { fileName: 'Chautauqua Docs.dc.html', line: 210, title: 'How the screenshots are made' },
];

function isExplainerPanel(frame: Frame): boolean {
  return EXPLAINER_PANELS.some((p) => p.fileName === frame.fileName && p.line === frame.line);
}

const ALL_FRAMES: Frame[] = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.filter(
  (f) => !isTemplateInterpolation(f) && !isExplainerPanel(f)
);

const EXPECTED_PER_FILE: Record<string, number> = {
  'Chautauqua Account.dc.html': 8,
  'Chautauqua Agenda.dc.html': 2,
  'Chautauqua Comms.dc.html': 9,
  'Chautauqua Contacts.dc.html': 12,
  'Chautauqua Content.dc.html': 4,
  'Chautauqua Docs.dc.html': 3,
  'Chautauqua Home.dc.html': 3,
  'Chautauqua Overview.dc.html': 5,
  'Chautauqua Public and Portal.dc.html': 13,
  'Chautauqua Review.dc.html': 8,
  'Chautauqua Settings.dc.html': 17,
  'Chautauqua Speakers.dc.html': 10,
  'Chautauqua Submissions.dc.html': 8,
};

const EXPECTED_TOTAL_LABELS = 161;
const EXPECTED_TOTAL_DESKTOP_PRE_EXCLUSION = 108;
// Renamed from EXPECTED_TOTAL (DEC-976 wave-107 amendment): this is the
// population BEFORE the deviation-deferred exclusion below. The exact-102
// assertion this guards is unchanged -- only its name, so the population
// can never be shrunk by breaking the label grammar.
const EXPECTED_TOTAL_PRE_DEVIATION = 102;

// -- Claims: every *.test.ts/*.test.tsx under test/ or app/src/ ------------
// Identical machinery to the phone ledger's own claim side.

function isTestFile(name: string): boolean {
  return name.endsWith('.test.ts') || name.endsWith('.test.tsx');
}

/** Every *.test.ts/*.test.tsx file under `root`, enumerated via readdirSync
 * rather than named (DEC-808). */
function enumerateTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CLAIM_TEST_FILES = [...enumerateTestFiles(TEST_ROOT), ...enumerateTestFiles(APP_SRC_ROOT)];

// Strict citation form: docs/design/<Frame Name>.dc.html:<line-blob>
// (mirrors app/src/frame-citation.scan.test.ts's STRICT_RE and the phone
// ledger's own CITATION_RE; DEC-976).
const CITATION_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

interface Citation {
  /** Repo-relative path of the citing test file. */
  citingFile: string;
  frameFileName: string;
  /** First line number named by the citation (a multi-line citation like
   * ":97/101" cites several lines; the first is the one checked, mirroring
   * frame-citation.scan.test.ts's own convention). */
  firstLine: number;
  matchText: string;
}

function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

/** Collapses comment-wrap line breaks (and any run of whitespace) to a
 * single space, so a citation split across a wrapped comment line is still
 * read as one contiguous string -- mirrors the phone ledger's own
 * `flatten`. */
function flatten(content: string): string {
  return content
    .replace(/\r?\n[ \t]*\*\/?[ \t]?/g, ' ')
    .replace(/\r?\n[ \t]*\/\/[ \t]?/g, ' ')
    .replace(/\s+/g, ' ');
}

function citationsInFile(absFile: string): Citation[] {
  const relFile = relative(REPO_ROOT, absFile);
  const content = flatten(readFileSync(absFile, 'utf-8'));
  const out: Citation[] = [];
  for (const m of content.matchAll(CITATION_RE)) {
    out.push({
      citingFile: relFile,
      frameFileName: m[1]!,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
    });
  }
  return out;
}

const ALL_CITATIONS: Citation[] = CLAIM_TEST_FILES.flatMap(citationsInFile);

/** True if `citation` lands inside `frame`'s extent. */
function citationClaims(citation: Citation, frame: Frame): boolean {
  if (citation.frameFileName !== frame.fileName) return false;
  return citation.firstLine >= frame.line && citation.firstLine < frame.extentEnd;
}

interface Claim {
  frame: Frame;
  citation: Citation;
}

// -- Deviation-deferred exclusion (DEC-976 wave-107 amendment) --------------
// docs/design/DEVIATIONS.md's "## 6. Deferred post-deadline" section is a
// USER RULING (2026-08-16, G13 sweep) that certain frames draw features or
// reworks the build deliberately does not carry -- scope decisions, not
// defects. The ledger's own population can never reach its total while it
// keeps counting frames the ruling itself puts out of scope, so this is a
// THIRD exclusion class, beside the template-interpolation (pattern) and
// explainer-panel (hand-listed) ones above. It is DERIVED, never hand-listed
// (DEC-808): every `docs/design/<file>.dc.html:<line>` citation inside §6's
// text names an excluded frame, full stop -- no separate allowlist to drift
// out of sync with the document.

const DEVIATIONS_PATH = join(REPO_ROOT, 'docs', 'design', 'DEVIATIONS.md');
const DEFERRED_HEADING = '## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)';

/** Every line belonging to the `## 6. Deferred post-deadline` section,
 * stopping at the next `## ` heading or end of file. Throws if the heading
 * is absent, so a renamed/moved section can never silently zero this out. */
function deferredSectionText(): string {
  const text = readFileSync(DEVIATIONS_PATH, 'utf-8');
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === DEFERRED_HEADING);
  if (startIdx === -1) {
    throw new Error(`docs/design/DEVIATIONS.md has no "${DEFERRED_HEADING}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith('## '));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join('\n');
}

interface DeviationCitation {
  fileName: string;
  line: number;
}

/** Every `docs/design/<file>.dc.html:<line>` citation inside §6, using the
 * same CITATION_RE grammar the claim side uses. */
function deviationCitations(): DeviationCitation[] {
  const text = deferredSectionText();
  const out: DeviationCitation[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    out.push({ fileName: m[1]!, line: firstLineNumber(m[2]!) });
  }
  return out;
}

const DEVIATION_CITATIONS = deviationCitations();

/** Every §6 citation that lands exactly on a real desktop frame LABEL line.
 * Not every §6 citation opens a frame -- e.g. the "reviewer-row Swap" and
 * "Portal task-list dock" entries cite specific geometry rule lines inside
 * a frame's body, not the frame's own font-size:19px label -- so this is a
 * FILTER, not a throw: a citation that does not resolve to a label line is
 * simply not naming a frame to exclude. Dedupe by file:line so a frame
 * cited twice in §6 is only excluded once. */
const EXCLUDED: Frame[] = (() => {
  const seen = new Set<string>();
  const out: Frame[] = [];
  for (const cite of DEVIATION_CITATIONS) {
    const frame = ALL_FRAMES.find((f) => f.fileName === cite.fileName && f.line === cite.line);
    if (!frame) continue;
    const key = `${frame.file}:${frame.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(frame);
  }
  return out;
})();

const EXPECTED_DEVIATION_DEFERRED = 2;
const EXPECTED_DEVIATION_CITATIONS = [
  { fileName: 'Chautauqua Settings.dc.html', line: 1111 },
  { fileName: 'Chautauqua Settings.dc.html', line: 1507 },
];

// -- Claim population: REACHABLE, not the full 102 (DEC-180 wave-25) --------
// CLAIMED_FLOOR is pinned to the reachable population (ALL_FRAMES minus the
// DEVIATIONS §6 deviation-deferred EXCLUDED frames), so CLAIMS must be built
// over that same population, not over ALL_FRAMES. Before this fix, CLAIMS
// scanned all 102 frames -- structurally capable of reaching 101 the moment
// a stray citation landed inside either deferred frame's extent, which would
// fail the two-sided "never claims MORE than CLAIMED_FLOOR" ratchet AND
// record a user-deferred, deliberately-unbuilt feature as covered. Restricting
// the scan to REACHABLE_FRAMES makes 100 the structural ceiling of CLAIMS,
// matching CLAIMED_FLOOR by construction rather than by the separate "no
// deviation-deferred exclusion is claimed" tripwire alone.
const EXCLUDED_KEYS: Set<string> = new Set(EXCLUDED.map((f) => `${f.file}:${f.line}`));
const REACHABLE_FRAMES: Frame[] = ALL_FRAMES.filter((f) => !EXCLUDED_KEYS.has(`${f.file}:${f.line}`));

const CLAIMS: Claim[] = [];
for (const frame of REACHABLE_FRAMES) {
  const citation = ALL_CITATIONS.find((c) => citationClaims(c, frame));
  if (citation) CLAIMS.push({ frame, citation });
}

// -- Ratchet -----------------------------------------------------------------
// Measured on this branch (v12m-w2-f): 16 of 102 desktop frames are cited by
// an existing test. May only be RAISED in a future wave as more frames get
// real desktop-parity coverage; never lowered.
//
// Re-measured 16 -> 64 by the megabatch merge train after landing the wave-21
// desktop-claim lanes (v12m-w3-{n,o,p,q,r,s}, which added
// test/desktop-frames-{account,contacts,speakers,submissions,comms,public}.test.ts).
// One re-measurement for the whole batch, per DEC-385 wave-93.
//
// Re-measured 64 -> 65 by the wave-108 megabatch merge train after landing
// v12m-w3-y (test/public-sessions-lastyear.test.ts), which claims the last
// unowned/undeviated desktop frame in the pack: "Chautauqua Public and
// Portal" line 1167, the fresh-empty public sessions frame.
//
// Re-measured 65 -> 71 by the merge train on 2026-08-19 (megabatch gate) by
// running this file's own scan: six further desktop frames picked up real
// claims in the batch. Raised to the measured truth; this floor may only
// rise.
//
// Re-measured 71 -> 100 by the wave-118 megabatch merge train after landing
// v12m-w6-g, which drove the desktop ledger exit by claiming 29 further
// frames across six new/rewritten desktop-frame suites (agenda-content,
// overview-home, portal, review, settings, settings-dialogs). 100 of 102
// desktop frames now carry a real claim. Raised to the measured truth; this
// floor may only rise.
//
// CORRECTION (thunderdome medic, post-megabatch). The merge train at
// f684bcd2 raised this 100 -> 102 with no coverage behind it and no note
// added above -- it read "100 of 102 desktop frames" and wrote the
// population size into the floor. 102 is not merely unmet, it is
// UNREACHABLE by construction: the two frames it demands
// ("Chautauqua Settings.dc.html" :1111 "Settings · editing your data" and
// :1507 "Import from Sessionboard") are exactly the two the DEVIATIONS §6
// deviation-deferred exclusion removes from the claimable population --
// EXPECTED_DEVIATION_CITATIONS names the identical pair -- so CLAIMS can
// never exceed 100, and the goal test below (CLAIMS + EXCLUDED >=
// CLAIMED_FLOOR + EXPECTED_DEVIATION_DEFERRED) demanded 104 out of a
// 102-frame pack. Restored to 100, the last figure that was actually
// MEASURED. That is not a ratchet lowering: 102 was never achieved and
// could not be, and at 100 the two tests now read as the campaign's real
// desktop exit -- 100 claimed + 2 deferred = the whole 102-frame pack.
//
// (DEC-976 wave-137 amendment, v12m-w12-aa, reached the identical repair
// independently and added the structural tripwire below.)
// Merge train f684bcd2 raised 100 -> 102 on a transient mis-measurement
// ("coverage landed") that never actually landed: the sibling `it` below
// ("no deviation-deferred exclusion is claimed by any test file") forbids
// claiming either of the 2 DEVIATIONS §6-deferred frames, so the reachable
// maximum for CLAIMS is ALL_FRAMES.length - EXCLUDED.length = 102 - 2 = 100.
// 102 was UNREACHABLE, not unmet -- the whole population (100 claimed + 2
// deviation-deferred = 102 of 102) was already fully accounted for at the
// time of the raise. DEC-976 wave-137 amendment: repaired 102 -> 100. This
// is a correction of a corrupt raise, not the forbidden act of lowering a
// ratchet to match a regression -- no regression occurred, no coverage was
// lost, and the tripwire two `it`s below now makes the corrupt state
// (CLAIMED_FLOOR above the derived maximum) structurally unenterable.
//
// STRUCTURAL FIX (DEC-180 wave-25, v12m-w25-c). The two guards above (the
// "CLAIMED_FLOOR can never exceed the derived reachable maximum" and "no
// deviation-deferred exclusion is claimed" tests) caught the 100->102 raise
// AFTER it happened, but did nothing to stop CLAIMS itself from exceeding
// 100: CLAIMS was built by `for (const frame of ALL_FRAMES)` -- all 102,
// including the two deviation-deferred ones -- so a single stray citation
// landing inside either deferred frame's extent would have pushed CLAIMS to
// 101, failing the two-sided "never claims MORE than CLAIMED_FLOOR" ratchet
// and silently crediting a user-deferred, deliberately-unbuilt feature as
// covered. CLAIMS is now built over REACHABLE_FRAMES (ALL_FRAMES minus
// EXCLUDED), so 100 is CLAIMS's structural ceiling, not merely its measured
// value with a tripwire standing guard beside it. No behavioural change to
// this measured 100 -- the re-measured CLAIMS.length on this branch is still
// exactly 100 -- this closes the arithmetic accident, it does not move the
// ratchet.
export const CLAIMED_FLOOR = 100;

describe('desktop-frame claim ledger (DEC-976 wave-99 amendment, v12 mobile campaign)', () => {
  it('enumerates exactly 161 font-size:19px label spans across 13 files (vacuous-grammar guard)', () => {
    const files = designFiles();
    expect(files.length).toBe(13);
    expect(TOTAL_LABELS).toBe(EXPECTED_TOTAL_LABELS);
  });

  it('classifies exactly 108 of those labels as desktop frames before exclusion (vacuous-classifier guard)', () => {
    expect(ALL_DESKTOP_FRAMES_PRE_EXCLUSION.length).toBe(EXPECTED_TOTAL_DESKTOP_PRE_EXCLUSION);
  });

  it('the template-interpolation exclusion reaches exactly the three citations it is expected to', () => {
    const matched = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.filter(isTemplateInterpolation)
      .map((f) => ({ fileName: f.fileName, line: f.line, title: f.title }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line);
    const expected = [...EXPECTED_TEMPLATE_TITLES].sort(
      (a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line
    );
    expect(matched).toEqual(expected);
  });

  it('every excluded explainer panel still resolves to its cited line and title', () => {
    for (const panel of EXPLAINER_PANELS) {
      const found = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.find(
        (f) => f.fileName === panel.fileName && f.line === panel.line
      );
      if (!found) {
        throw new Error(
          `explainer-panel exclusion "${panel.title}" no longer resolves to ` +
            `${panel.fileName}:${panel.line} -- the pack was re-cut; update the exclusion list, ` +
            `don't just delete the entry`
        );
      }
      expect(found.title).toBe(panel.title);
    }
    // And the exclusion list is exhaustive: nothing else is dropped silently.
    const droppedCount = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.length - ALL_FRAMES.length;
    expect(droppedCount).toBe(EXPECTED_TEMPLATE_TITLES.length + EXPLAINER_PANELS.length);
  });

  it('enumerates exactly 102 desktop frames across 13 files after exclusion, before the deviation-deferred exclusion (vacuous-population guard)', () => {
    const actualPerFile: Record<string, number> = {};
    for (const frame of ALL_FRAMES) {
      actualPerFile[frame.fileName] = (actualPerFile[frame.fileName] ?? 0) + 1;
    }
    expect(actualPerFile).toEqual(EXPECTED_PER_FILE);
    expect(ALL_FRAMES.length).toBe(EXPECTED_TOTAL_PRE_DEVIATION);
  });

  it(`claims at least CLAIMED_FLOOR (${CLAIMED_FLOOR}) of ${REACHABLE_FRAMES.length} reachable desktop frames, and never fewer than the ratchet`, () => {
    if (CLAIMS.length < CLAIMED_FLOOR) {
      const claimedKeys = new Set(CLAIMS.map((c) => `${c.frame.file}:${c.frame.line}`));
      const unclaimed = REACHABLE_FRAMES.filter((f) => !claimedKeys.has(`${f.file}:${f.line}`)).map(
        (f) => `${f.file} :${f.line} -- ${f.title}`
      );
      throw new Error(
        `claimed ${CLAIMS.length} of ${REACHABLE_FRAMES.length} reachable desktop frames, below ` +
          `the ratchet floor of ${CLAIMED_FLOOR}. CLAIMED_FLOOR may only be RAISED, never lowered -- ` +
          `schedule coverage for the unclaimed frames below (never shrink the floor to match ` +
          `a regression):\n${unclaimed.join('\n')}`
      );
    }
    expect(CLAIMS.length).toBeGreaterThanOrEqual(CLAIMED_FLOOR);
    // goalComplete for the desktop half of the v12 mobile campaign is this
    // reaching CLAIMED_FLOOR = REACHABLE_FRAMES.length (100 of 100), which
    // together with the 2 deviation-deferred frames accounts for the full
    // 102-frame pack.
  });

  it(`never claims MORE than CLAIMED_FLOOR (${CLAIMED_FLOOR}) without the floor being raised to match (a stale floor licenses stagnation)`, () => {
    if (CLAIMS.length > CLAIMED_FLOOR) {
      throw new Error(
        `claimed ${CLAIMS.length} of ${REACHABLE_FRAMES.length} reachable desktop frames, above ` +
          `the ratchet floor of ${CLAIMED_FLOOR}. This is the ratchet working: coverage landed. Raise the ` +
          `floor in the same commit (a merge-train act, never a worker's edit mid-lane) by ` +
          `replacing the line:\n  export const CLAIMED_FLOOR = ${CLAIMS.length};`
      );
    }
    expect(CLAIMS.length).toBeLessThanOrEqual(CLAIMED_FLOOR);
  });

  it('CLAIMED_FLOOR can never exceed the derived reachable maximum (ALL_FRAMES.length - EXCLUDED.length): a floor above that maximum is a corrupt measurement, not coverage', () => {
    const reachableMax = ALL_FRAMES.length - EXCLUDED.length;
    if (CLAIMED_FLOOR > reachableMax) {
      throw new Error(
        `CLAIMED_FLOOR (${CLAIMED_FLOOR}) exceeds the derived reachable maximum of ` +
          `${reachableMax} (ALL_FRAMES.length ${ALL_FRAMES.length} - EXCLUDED.length ` +
          `${EXCLUDED.length}). The sibling test "no deviation-deferred exclusion is claimed ` +
          `by any test file" forbids CLAIMS from ever including an EXCLUDED frame, so no ` +
          `floor above this maximum is reachable by real coverage -- it can only be a mis-` +
          `measurement (see DEC-976 wave-137 amendment). Lower CLAIMED_FLOOR to at most ` +
          `${reachableMax}.`
      );
    }
    expect(CLAIMED_FLOOR).toBeLessThanOrEqual(reachableMax);
  });

  it('every citation that claimed a frame resolves to a real line in the named frame file', () => {
    const frameLineCounts = new Map<string, number>();
    for (const fileName of designFiles()) {
      const count = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n').length;
      frameLineCounts.set(fileName, count);
    }

    const bad = CLAIMS.filter((claim) => {
      const total = frameLineCounts.get(claim.frame.fileName);
      return total === undefined || claim.citation.firstLine < 1 || claim.citation.firstLine > total;
    }).map(
      (claim) =>
        `${claim.citation.citingFile}: "${claim.citation.matchText}" cites ${claim.frame.fileName}:${claim.citation.firstLine}, which does not exist in that frame file`
    );
    expect(bad).toEqual([]);
  });

  it(`the DEVIATIONS §6 deviation-deferred exclusion is derived and exact: exactly ${EXPECTED_DEVIATION_DEFERRED} excluded desktop frames, each resolving to a real frame label line whose title is quoted verbatim in the deferring bullet`, () => {
    expect(EXCLUDED.length).toBe(EXPECTED_DEVIATION_DEFERRED);
    const actual = EXCLUDED.map((f) => ({ fileName: f.fileName, line: f.line })).sort(
      (a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line
    );
    const expected = [...EXPECTED_DEVIATION_CITATIONS].sort(
      (a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line
    );
    expect(actual).toEqual(expected);

    const deviationsText = readFileSync(DEVIATIONS_PATH, 'utf-8');
    for (const frame of EXCLUDED) {
      expect(
        deviationsText.includes(`\`${frame.title}\``),
        `DEVIATIONS.md does not quote the excluded frame's title "${frame.title}" verbatim in backticks`
      ).toBe(true);
    }
  });

  it('no deviation-deferred exclusion is claimed by any test file (an exclusion a claim has overtaken is stale and must be deleted, never carried)', () => {
    const overtaken = EXCLUDED.filter((frame) => ALL_CITATIONS.some((c) => citationClaims(c, frame))).map(
      (f) => `${f.file}:${f.line} -- ${f.title}`
    );
    expect(overtaken, overtaken.join('\n')).toEqual([]);
  });

  it('the two DEVIATIONS §6 deferred frames carry exactly zero path:line citations anywhere in the citation corpus this file scans (the exclusion means "the user deferred it, so nothing may claim it", made explicit rather than left to arithmetic)', () => {
    const offenders: string[] = [];
    for (const frame of EXCLUDED) {
      for (const citation of ALL_CITATIONS) {
        if (!citationClaims(citation, frame)) continue;
        offenders.push(
          `${citation.citingFile}: "${citation.matchText}" cites ${frame.file}:${citation.firstLine}, which ` +
            `lands inside deviation-deferred frame ${frame.file} :${frame.line} -- "${frame.title}"`
        );
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('desktop half of the v12 mobile campaign goal: claimed frames plus deviation-deferred frames reaches the full desktop population (ALL_FRAMES.length), derived from the population, never from CLAIMED_FLOOR + EXPECTED_DEVIATION_DEFERRED (that pairing double-counts the exclusion)', () => {
    const claimedKeys = new Set(CLAIMS.map((c) => `${c.frame.file}:${c.frame.line}`));
    const excludedKeys = new Set(EXCLUDED.map((f) => `${f.file}:${f.line}`));
    const remaining = ALL_FRAMES.filter(
      (f) => !claimedKeys.has(`${f.file}:${f.line}`) && !excludedKeys.has(`${f.file}:${f.line}`)
    ).map((f) => `${f.file} :${f.line} -- ${f.title}`);
    if (CLAIMS.length + EXCLUDED.length < ALL_FRAMES.length) {
      throw new Error(
        `claimed ${CLAIMS.length} + excluded ${EXCLUDED.length} = ${CLAIMS.length + EXCLUDED.length}, below ` +
          `the goal of ${ALL_FRAMES.length} (the full desktop population). Remaining frames:\n${remaining.join('\n')}`
      );
    }
    expect(CLAIMS.length + EXCLUDED.length).toBeGreaterThanOrEqual(ALL_FRAMES.length);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967 wave-41): a fabricated frame-shaped fixture written to
// a real tmpdir copy, exercised through templateCloseLine/allFramesInFile/
// citationClaims exactly as the population walk above uses them -- proves
// the clip actually moves the boundary rather than merely reading back a
// constant this file itself wrote.
// ---------------------------------------------------------------------------

describe('non-vacuity: the last frame extent clips at the tmpdir copy own </x-dc>', () => {
  let dir: string;
  const FIXTURE_NAME = 'Fixture Desktop.dc.html';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'desktop-frame-ledger-close-fixture-'));
    const lines = [
      '<x-dc>',
      `  <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Fixture · last frame</span>`,
      '  <span>content line still inside the template body, before the close</span>',
      '</x-dc>',
      '<script type="text/x-dc" data-dc-script">',
      '  <span>content line inside the script body, past the close</span>',
      '</script>',
    ];
    writeFileSync(join(dir, FIXTURE_NAME), lines.join('\n') + '\n', 'utf8');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('templateCloseLine resolves the fixture single </x-dc>, and the last frame extentEnd clips to it (never Infinity/EOF)', () => {
    const closeLine = templateCloseLine(FIXTURE_NAME, dir);
    expect(closeLine).toBe(4);
    const entries = allFramesInFile(FIXTURE_NAME, dir);
    expect(entries.length).toBe(1);
    expect(entries[0]!.frame.extentEnd).toBe(4);
  });

  it('a citation before the close lands inside the frame; the same frame-shaped fixture content after the close does not', () => {
    const frame = allFramesInFile(FIXTURE_NAME, dir)[0]!.frame;
    const before: Citation = {
      citingFile: 'fixture',
      frameFileName: FIXTURE_NAME,
      firstLine: 3,
      matchText: 'fixture-before',
    };
    const after: Citation = {
      citingFile: 'fixture',
      frameFileName: FIXTURE_NAME,
      firstLine: 6,
      matchText: 'fixture-after',
    };
    expect(citationClaims(before, frame)).toBe(true);
    expect(citationClaims(after, frame)).toBe(false);
  });
});
