// Pack drawn column-track vocabulary ratchet (DEC-896 wave-48, task w48-b).
//
// WHY (measured at main 01e1d12e2, field guide wave-48): the pack draws 201
// `grid-template-columns` declarations across docs/design/*.dc.html and 56
// of them -- 28 distinct track lists spread over 28 frame labels -- match
// nothing in the served CSS even after normalising `minmax(0, X)` to `X`.
// Nothing grades this axis: test/desktop-field-width.scan.test.ts explicitly
// excludes bare `width:`/track lists (its own comment names the 196px nav
// rail as page chrome it must never count as a field),
// test/pack-declaration-vocabulary.scan.test.ts grades which declarations
// appear rather than their values, and PACK_UNIT_GRAMMAR grades units. Two
// rows verified by hand: `Chautauqua Settings.dc.html:986` draws
// `1fr 170px 190px auto` against app/src/pages/settings/settings.css's
// `--chq-people-grid: minmax(0, 1fr) 170px 190px 200px` (last track 200px
// where the frame draws auto), and `Chautauqua Review.dc.html:848` draws
// `1fr 150px 190px auto` against app/src/pages/review/review.css's
// `grid-template-columns: 1fr 150px 190px 210px auto` (an extra 210px
// track). Both hid behind a custom property or a minmax() wrap.
//
// This file MEASURES and RATCHETS only. It moves no CSS byte -- desktop
// stays frozen.
//
//   1. POPULATION: readdirSync docs/design for *.dc.html (never a
//      hand-listed file list). Each file's extent is clipped at its single
//      `</x-dc>` line (throws loudly on zero or multiple matches, DEC-967
//      wave-43). The label/extent walk, EXPLAINER exclusion list and
//      DEVIATIONS-Section-6 derivation are PORTED (never imported --
//      test/desktop-frame-ledger.scan.test.ts is sibling-owned) verbatim
//      from that file, so the pack's three documentation panels ("Widths ·
//      what a wide monitor gets", "Rules you can't see on the page", "How
//      the screenshots are made") and the DEVIATIONS.md §6 deviation-
//      deferred frames (including "Settings · editing your data") are
//      excluded BY DERIVATION, not by hand. Every `grid-template-columns:`
//      occurrence inside a REACHABLE (desktop, non-excluded) frame's extent
//      is one drawn track list, resolved to its owning frame label.
//
//   2. MATCH SIDE: every `grid-template-columns:` declaration in non-test
//      app/src/**/*.css, app/src/**/*.ts(x), src/**/*.ts(x) (which is also
//      every src/**/*.css.ts file, since that extension ends in `.ts`),
//      readdirSync'd, `*.test.*` excluded. Comments are stripped with the
//      shared, string-aware `stripCssComments` (DEC-613 -- never a local
//      copy), and each source is split on `@media` blocks: only the text
//      OUTSIDE any `@media` block is graded (DEC-385 -- desktop is the
//      base/unqualified declaration, a `max-width` block only narrows it,
//      so the desktop-grading value is never inside one).
//
//   3. NORMALISATION, applied to BOTH sides: collapse whitespace to single
//      spaces; rewrite `minmax(0, X)` to `X`; and RESOLVE a value that is
//      exactly `var(--x)` (with an optional fallback) against `--x`'s own
//      top-level, non-`@media` declaration in the product corpus before
//      comparing (recursively, so a var-of-a-var resolves fully) -- an
//      unresolved token is an ungraded site wearing a citation (wave-43's
//      lesson, restated in DEC-896's wave-48 amendment).
//
//   4. RATCHET: two-sided `PACK_GRID_TRACK_UNMATCHED_CEILING`, seeded to the
//      count measured on this branch (never arithmetic on the WHY section's
//      56). A vacuous-population tripwire pins the exact total drawn-
//      declaration count, plus one positive control (a drawn value that DOES
//      resolve to a shipped value) and one negative control (the two rows
//      verified by hand above).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_896 } from "../src/decisions";
import { splitMediaBlocks } from "./helpers/css-media-blocks";
import { stripCssComments } from "./helpers/strip-css-comments";

// Confirms this file's population depends on the ruling it implements
// (compile-checked, per the standing house rule).
void DEC_896;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_ROOT = join(REPO_ROOT, "docs", "design");
const APP_SRC_ROOT = join(REPO_ROOT, "app", "src");
const SRC_ROOT = join(REPO_ROOT, "src");

// -- Population: label/extent walk, PORTED (never imported -- sibling-owned)
// from test/desktop-frame-ledger.scan.test.ts, byte-identical grammar. -----

const LABEL_RE = />([^<]+)<\//;

function isFrameLine(line: string): boolean {
  return line.includes("width:390px") && line.includes("height:844");
}

function isLabelLine(line: string): boolean {
  return line.includes("font-size:19px") && LABEL_RE.test(line);
}

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".dc.html"))
    .map((e) => e.name)
    .sort();
}

interface RawLabel {
  line: number;
  title: string;
}

interface Frame {
  file: string;
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
}

/** Ported (never imported) from test/desktop-frame-ledger.scan.test.ts:
 * throws loudly if a file's single `</x-dc>` close tag is missing or
 * appears more than once (DEC-967 wave-41 amendment). */
function templateCloseLine(fileName: string, root: string = DESIGN_ROOT): number {
  const full = join(root, fileName);
  const lines = readFileSync(full, "utf-8").split("\n");
  const matches: number[] = [];
  lines.forEach((content, idx) => {
    if (content.includes("</x-dc>")) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fileName}: expected exactly one </x-dc>, found ${matches.length}`);
  }
  return matches[0]!;
}

function labelsInFile(fileName: string, root: string = DESIGN_ROOT): RawLabel[] {
  const full = join(root, fileName);
  const lines = readFileSync(full, "utf-8").split("\n");
  const labels: RawLabel[] = [];
  lines.forEach((content, idx) => {
    if (!isLabelLine(content)) return;
    const m = content.match(LABEL_RE);
    if (m) labels.push({ line: idx + 1, title: m[1]!.trim() });
  });
  return labels;
}

function allFramesInFile(fileName: string, root: string = DESIGN_ROOT): { frame: Frame; isPhone: boolean }[] {
  const full = join(root, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, "utf-8").split("\n");
  const labels = labelsInFile(fileName, root);
  const closeLine = templateCloseLine(fileName, root);
  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = Math.min(nextLabel ? nextLabel.line : Infinity, closeLine);
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isFrameLine);
    return { frame: { file: relFile, fileName, line: label.line, title: label.title, extentEnd }, isPhone };
  });
}

const ALL_DESKTOP_FRAMES_PRE_EXCLUSION: Frame[] = designFiles().flatMap((f) =>
  allFramesInFile(f)
    .filter((entry) => !entry.isPhone)
    .map((entry) => entry.frame)
);

// -- Exclusions, PORTED (never imported) from
// test/desktop-frame-ledger.scan.test.ts's own EXPLAINER/template-
// interpolation exclusion lists. ------------------------------------------

const TEMPLATE_INTERPOLATION_RE = /^\{\{.*\}\}$/;

function isTemplateInterpolation(frame: Frame): boolean {
  return TEMPLATE_INTERPOLATION_RE.test(frame.title);
}

const EXPECTED_TEMPLATE_TITLES = [
  { fileName: "Chautauqua Home.dc.html", line: 205, title: "{{ e.name }}" },
  { fileName: "Chautauqua Comms.dc.html", line: 695, title: "{{ e.name }}" },
  { fileName: "Chautauqua Public and Portal.dc.html", line: 716, title: "{{ s.name }}" },
];

const EXPLAINER_PANELS = [
  { fileName: "Chautauqua Overview.dc.html", line: 353, title: "Widths · what a wide monitor gets" },
  { fileName: "Chautauqua Home.dc.html", line: 326, title: "Rules you can't see on the page" },
  { fileName: "Chautauqua Docs.dc.html", line: 210, title: "How the screenshots are made" },
];

function isExplainerPanel(frame: Frame): boolean {
  return EXPLAINER_PANELS.some((p) => p.fileName === frame.fileName && p.line === frame.line);
}

const ALL_FRAMES: Frame[] = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.filter(
  (f) => !isTemplateInterpolation(f) && !isExplainerPanel(f)
);

const PORTED_EXPECTED_TOTAL_LABELS = 161;
const PORTED_EXPECTED_TOTAL_DESKTOP_PRE_EXCLUSION = 108;
const PORTED_EXPECTED_TOTAL_PRE_DEVIATION = 102;

// -- DEVIATIONS §6 deviation-deferred exclusion, PORTED (never imported)
// from test/desktop-frame-ledger.scan.test.ts's own DEC-976 wave-107
// amendment: DERIVED from docs/design/DEVIATIONS.md's "## 6. Deferred
// post-deadline" section, never hand-listed. -------------------------------

const DEVIATIONS_PATH = join(REPO_ROOT, "docs", "design", "DEVIATIONS.md");
const DEFERRED_HEADING = "## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)";
const CITATION_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

function deferredSectionText(): string {
  const text = readFileSync(DEVIATIONS_PATH, "utf-8");
  const lines = text.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === DEFERRED_HEADING);
  if (startIdx === -1) {
    throw new Error(`docs/design/DEVIATIONS.md has no "${DEFERRED_HEADING}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

interface DeviationCitation {
  fileName: string;
  line: number;
}

function deviationCitations(): DeviationCitation[] {
  const text = deferredSectionText();
  const out: DeviationCitation[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    out.push({ fileName: m[1]!, line: firstLineNumber(m[2]!) });
  }
  return out;
}

const DEVIATION_CITATIONS = deviationCitations();
const PORTED_EXPECTED_DEVIATION_DEFERRED = 2;
const EXPECTED_DEVIATION_CITATIONS = [
  { fileName: "Chautauqua Settings.dc.html", line: 1111 },
  { fileName: "Chautauqua Settings.dc.html", line: 1507 },
];

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

const EXCLUDED_KEYS: Set<string> = new Set(EXCLUDED.map((f) => `${f.file}:${f.line}`));
const REACHABLE_FRAMES: Frame[] = ALL_FRAMES.filter((f) => !EXCLUDED_KEYS.has(`${f.file}:${f.line}`));

// -- Pack side: every drawn grid-template-columns inside a REACHABLE frame's
// extent, resolved to its owning frame label. -------------------------------

const GRID_RE = /(?<![\w-])grid-template-columns:\s*([^;"']+)/g;

interface PackTrack {
  fileName: string;
  file: string;
  line: number;
  rawValue: string;
  frameTitle: string;
  frameLine: number;
}

function offsetToLine(lineStartIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineStartIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStartIndex[mid]! <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

function packTracksInFrame(frame: Frame, root: string = DESIGN_ROOT): PackTrack[] {
  const full = join(root, frame.fileName);
  const content = readFileSync(full, "utf-8");
  const lines = content.split("\n");
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }
  const startOff = lineStartIndex[frame.line - 1]!;
  const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
  const text = content.slice(startOff, endOff);
  const out: PackTrack[] = [];
  GRID_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GRID_RE.exec(text))) {
    out.push({
      fileName: frame.fileName,
      file: frame.file,
      line: offsetToLine(lineStartIndex, startOff + m.index),
      rawValue: m[1]!.trim(),
      frameTitle: frame.title,
      frameLine: frame.line,
    });
  }
  return out;
}

const PACK_TRACKS: PackTrack[] = REACHABLE_FRAMES.flatMap((f) => packTracksInFrame(f));

/** Exact total `grid-template-columns:` occurrences across every *.dc.html
 * file, scoped to nothing -- a raw text count, independent of the label
 * walk above, so the label/extent grammar cannot silently drop a
 * declaration without this tripwire noticing. */
function totalDrawnDeclarations(): number {
  let n = 0;
  for (const fileName of designFiles()) {
    const content = readFileSync(join(DESIGN_ROOT, fileName), "utf-8");
    GRID_RE.lastIndex = 0;
    while (GRID_RE.exec(content)) n++;
  }
  return n;
}

const TOTAL_DRAWN_DECLARATIONS = totalDrawnDeclarations();

// -- Match side: every grid-template-columns declaration + every custom
// property declaration in the non-test product corpus, base/unqualified
// (outside @media) only per DEC-385. --------------------------------------

function isTestFileName(name: string): boolean {
  return name.includes(".test.");
}

function listProductFiles(root: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (isTestFileName(entry.name)) continue;
    if (!exts.some((ext) => entry.name.endsWith(ext))) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// app/src/**/*.css, app/src/**/*.ts(x); src/**/*.ts(x) -- which is also
// every src/**/*.css.ts file, since that extension itself ends in `.ts`.
const PRODUCT_FILES: string[] = [
  ...listProductFiles(APP_SRC_ROOT, [".css", ".ts", ".tsx"]),
  ...listProductFiles(SRC_ROOT, [".ts", ".tsx"]),
];

interface ProductSource {
  path: string;
  /** stripCssComments'd, and split to the text OUTSIDE any @media block
   * (DEC-385: the base/unqualified declaration is the desktop-grading one). */
  baseText: string;
}

/** Some non-stylesheet *.ts files (e.g. app/src/test-utils/phoneBlock.ts,
 * the phone-overflow-scan/phone-tap-target-scan rule modules) carry a
 * regex/string LITERAL naming `@media` as text without a brace-balanced CSS
 * body around it -- splitMediaBlocks's brace matcher throws loudly on that
 * shape (by design: it never guesses). None of those files declares
 * `grid-template-columns` at all (verified by hand this wave), so falling
 * back to the whole comment-stripped text (no @media exclusion) for a file
 * whose braces don't balance as CSS is safe: it can only ADD candidate
 * grid-template-columns matches from inside a narrowing block, which this
 * scan would then either match (fine) or list as an extra offender (never
 * silently drop a real one -- fail loud in the other direction). */
function splitMediaBlocksLenient(css: string): { outside: string } {
  try {
    return splitMediaBlocks(css);
  } catch {
    return { outside: css };
  }
}

const PRODUCT_SOURCES: ProductSource[] = PRODUCT_FILES.map((path) => {
  const raw = readFileSync(path, "utf-8");
  const cleaned = stripCssComments(raw);
  const { outside } = splitMediaBlocksLenient(cleaned);
  return { path, baseText: outside };
});

const CUSTOM_PROP_RE = /(?<![\w-])--([a-zA-Z][\w-]*):\s*([^;]+);/g;

/** name -> declared value, FIRST top-level occurrence across the whole
 * corpus wins (DEC-385's base/unqualified convention, mirroring
 * test/desktop-field-width.scan.test.ts's own extractPairGap). */
function buildCustomPropertyMap(sources: readonly ProductSource[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of sources) {
    CUSTOM_PROP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CUSTOM_PROP_RE.exec(s.baseText))) {
      const name = m[1]!;
      if (map.has(name)) continue;
      map.set(name, m[2]!.trim());
    }
  }
  return map;
}

const CUSTOM_PROPERTIES = buildCustomPropertyMap(PRODUCT_SOURCES);

interface ProductGridDeclaration {
  path: string;
  rawValue: string;
}

function extractGridDeclarations(sources: readonly ProductSource[]): ProductGridDeclaration[] {
  const out: ProductGridDeclaration[] = [];
  const re = /(?<![\w-])grid-template-columns:\s*([^;]+);/g;
  for (const s of sources) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s.baseText))) {
      out.push({ path: s.path, rawValue: m[1]!.trim() });
    }
  }
  return out;
}

const PRODUCT_GRID_DECLARATIONS = extractGridDeclarations(PRODUCT_SOURCES);

// -- Normalisation, applied to both sides ------------------------------------

function collapseWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Rewrites every `minmax(0, X)` (any inner whitespace) to bare `X`. */
function stripMinmaxZero(s: string): string {
  return s.replace(/minmax\(\s*0\s*,\s*([^,()]+?)\s*\)/g, "$1");
}

const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/;

/** Resolves a value that is EXACTLY a `var(--x[, fallback])` reference
 * against `customProps`'s own declaration for `--x`, recursively (so a
 * var-of-a-var resolves fully). A value that is not exactly a var()
 * reference, or a var() whose name resolves nowhere and carries no
 * fallback, is returned unchanged -- an unresolved token, never silently
 * dropped from the population. */
function resolveVar(value: string, customProps: ReadonlyMap<string, string>, depth = 0): string {
  if (depth > 5) return value;
  const collapsed = collapseWhitespace(value);
  const m = collapsed.match(VAR_RE);
  if (!m) return collapsed;
  // CUSTOM_PROP_RE captures the property name WITHOUT its leading `--`
  // (matching test/desktop-field-width.scan.test.ts's own `--chq-field-w-`
  // token convention); VAR_RE captures the reference WITH it -- strip it
  // here so the two agree on one key shape.
  const name = m[1]!.replace(/^--/, "");
  const declared = customProps.get(name);
  if (declared !== undefined) return resolveVar(declared, customProps, depth + 1);
  if (m[2] !== undefined) return resolveVar(m[2]!, customProps, depth + 1);
  return collapsed;
}

/** Full normalisation pipeline, applied identically to both the pack's
 * drawn values and the product's declared values (DEC-896 wave-48). */
function normalizeTrackList(raw: string, customProps: ReadonlyMap<string, string>): string {
  const resolved = resolveVar(raw, customProps);
  return stripMinmaxZero(collapseWhitespace(resolved));
}

const PRODUCT_NORMALIZED_VALUES: ReadonlySet<string> = new Set(
  PRODUCT_GRID_DECLARATIONS.map((d) => normalizeTrackList(d.rawValue, CUSTOM_PROPERTIES))
);

// -- Grade --------------------------------------------------------------

interface GradedPackTrack {
  track: PackTrack;
  normalized: string;
  matched: boolean;
}

const GRADED: GradedPackTrack[] = PACK_TRACKS.map((track) => {
  const normalized = normalizeTrackList(track.rawValue, CUSTOM_PROPERTIES);
  return { track, normalized, matched: PRODUCT_NORMALIZED_VALUES.has(normalized) };
});

const UNMATCHED: GradedPackTrack[] = GRADED.filter((g) => !g.matched);

// -- Ratchet -----------------------------------------------------------
// Measured on this branch (v12m-w48-b) by forcing this to -1 once and
// reading the printed offender list -- never arithmetic on the field
// guide's/DEC-896's own WHY-section 56. Two-sided per every ratchet in this
// campaign: may only be RAISED (a merge-train act, never a worker's edit
// mid-lane) and must never be LOWERED to paper over a regression, and must
// never sit below the measured count either (a stale ceiling licenses
// stagnation).
export const PACK_GRID_TRACK_UNMATCHED_CEILING = 72;

describe("pack drawn column-track vocabulary (DEC-896 wave-48, v12 mobile campaign)", () => {
  it("enumerates exactly 161 label spans / 108 pre-exclusion desktop frames / 102 pre-deviation frames (vacuous-population tripwire, ported grammar)", () => {
    expect(designFiles().length).toBe(13);
    const totalLabels = designFiles().reduce((n, f) => n + labelsInFile(f).length, 0);
    expect(totalLabels).toBe(PORTED_EXPECTED_TOTAL_LABELS);
    expect(ALL_DESKTOP_FRAMES_PRE_EXCLUSION.length).toBe(PORTED_EXPECTED_TOTAL_DESKTOP_PRE_EXCLUSION);
    expect(ALL_FRAMES.length).toBe(PORTED_EXPECTED_TOTAL_PRE_DEVIATION);
  });

  it("the ported EXPLAINER/template-interpolation exclusions still resolve to their cited lines", () => {
    for (const panel of EXPLAINER_PANELS) {
      const found = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.find(
        (f) => f.fileName === panel.fileName && f.line === panel.line
      );
      if (!found) {
        throw new Error(
          `explainer-panel exclusion "${panel.title}" no longer resolves to ${panel.fileName}:${panel.line} -- ` +
            `the pack was re-cut; update the ported exclusion list, don't just delete the entry`
        );
      }
      expect(found.title).toBe(panel.title);
    }
    for (const t of EXPECTED_TEMPLATE_TITLES) {
      const found = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.find((f) => f.fileName === t.fileName && f.line === t.line);
      expect(found?.title).toBe(t.title);
    }
  });

  it("the ported DEVIATIONS §6 derivation still excludes exactly 2 frames, including the deferred Settings · editing your data frame", () => {
    expect(EXCLUDED.length).toBe(PORTED_EXPECTED_DEVIATION_DEFERRED);
    const actual = EXCLUDED.map((f) => ({ fileName: f.fileName, line: f.line })).sort(
      (a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line
    );
    const expected = [...EXPECTED_DEVIATION_CITATIONS].sort(
      (a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line
    );
    expect(actual).toEqual(expected);
    expect(EXCLUDED.some((f) => f.title === "Settings · editing your data")).toBe(true);
  });

  it("vacuous-population tripwire: exactly 201 grid-template-columns declarations exist across the whole pack, all inside some labelled extent", () => {
    expect(TOTAL_DRAWN_DECLARATIONS).toBe(201);
    const totalWithinAnyLabel = designFiles().reduce((n, f) => n + allFramesInFile(f).length, 0);
    expect(totalWithinAnyLabel).toBeGreaterThan(0);
  });

  it("non-vacuity: PACK_TRACKS and PRODUCT_GRID_DECLARATIONS are both non-empty populations", () => {
    expect(PACK_TRACKS.length).toBeGreaterThan(0);
    expect(PRODUCT_GRID_DECLARATIONS.length).toBeGreaterThan(0);
    expect(CUSTOM_PROPERTIES.size).toBeGreaterThan(0);
  });

  it("POSITIVE control: a drawn track list that resolves to a shipped value grades matched (Chautauqua Agenda.dc.html:72's day-grid 1fr 268px rail)", () => {
    const positive = GRADED.find((g) => g.track.fileName === "Chautauqua Agenda.dc.html" && g.track.line === 72);
    expect(positive).toBeDefined();
    expect(positive?.normalized).toBe("1fr 268px");
    expect(positive?.matched).toBe(true);
  });

  it("NEGATIVE control: the two hand-verified divergences resolve exactly as described, through var()/minmax() resolution, and grade unmatched", () => {
    const settingsRow = GRADED.find((g) => g.track.fileName === "Chautauqua Settings.dc.html" && g.track.line === 986);
    expect(settingsRow).toBeDefined();
    expect(settingsRow?.track.rawValue).toBe("1fr 170px 190px auto");
    expect(settingsRow?.normalized).toBe("1fr 170px 190px auto");
    expect(settingsRow?.matched).toBe(false);
    // The product's own --chq-people-grid resolves (through var() then
    // minmax(0,X)->X) to "1fr 170px 190px 200px" -- present in the product
    // set, but NOT equal to the pack's "auto"-terminated value.
    expect(PRODUCT_NORMALIZED_VALUES.has("1fr 170px 190px 200px")).toBe(true);

    const reviewRow = GRADED.find((g) => g.track.fileName === "Chautauqua Review.dc.html" && g.track.line === 848);
    expect(reviewRow).toBeDefined();
    expect(reviewRow?.track.rawValue).toBe("1fr 150px 190px auto");
    expect(reviewRow?.normalized).toBe("1fr 150px 190px auto");
    expect(reviewRow?.matched).toBe(false);
    expect(PRODUCT_NORMALIZED_VALUES.has("1fr 150px 190px 210px auto")).toBe(true);
  });

  it("normalisation unit test: minmax(0, X) collapses to X and whitespace is collapsed, on a fabricated value", () => {
    expect(stripMinmaxZero("minmax(0, 1fr) 170px")).toBe("1fr 170px");
    expect(collapseWhitespace("1fr   170px\t190px")).toBe("1fr 170px 190px");
    expect(normalizeTrackList("minmax(0,   1fr)  170px", new Map())).toBe("1fr 170px");
  });

  it("var() resolution unit test: a fabricated custom-property reference resolves recursively, with an honest pass-through when unresolved", () => {
    const fabricated = new Map([
      ["chq-fixture-a", "var(--chq-fixture-b)"],
      ["chq-fixture-b", "minmax(0, 1fr) 200px"],
    ]);
    expect(normalizeTrackList("var(--chq-fixture-a)", fabricated)).toBe("1fr 200px");
    expect(normalizeTrackList("var(--chq-fixture-unresolved, 1fr 90px)", fabricated)).toBe("1fr 90px");
    expect(normalizeTrackList("var(--chq-fixture-totally-unresolved)", fabricated)).toBe(
      "var(--chq-fixture-totally-unresolved)"
    );
  });

  it(`never exceeds PACK_GRID_TRACK_UNMATCHED_CEILING (${PACK_GRID_TRACK_UNMATCHED_CEILING}) unmatched drawn track lists`, () => {
    if (UNMATCHED.length > PACK_GRID_TRACK_UNMATCHED_CEILING) {
      const rows = UNMATCHED.map(
        (g) =>
          `${g.track.file} :${g.track.line} -- frame "${g.track.frameTitle}" draws ` +
          `grid-template-columns:${g.track.rawValue} (normalized "${g.normalized}"), no shipped match`
      );
      throw new Error(
        `${UNMATCHED.length} drawn grid-template-columns track lists have no shipped match, above the ceiling ` +
          `of ${PACK_GRID_TRACK_UNMATCHED_CEILING}. PACK_GRID_TRACK_UNMATCHED_CEILING may only be RAISED (a ` +
          `merge-train act, never a worker's edit mid-lane). Offenders:\n${rows.join("\n")}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(PACK_GRID_TRACK_UNMATCHED_CEILING);
  });

  it(`never sits BELOW PACK_GRID_TRACK_UNMATCHED_CEILING (${PACK_GRID_TRACK_UNMATCHED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < PACK_GRID_TRACK_UNMATCHED_CEILING) {
      throw new Error(
        `${UNMATCHED.length} unmatched drawn track lists, below the ceiling of ` +
          `${PACK_GRID_TRACK_UNMATCHED_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const PACK_GRID_TRACK_UNMATCHED_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(PACK_GRID_TRACK_UNMATCHED_CEILING);
  });
});
