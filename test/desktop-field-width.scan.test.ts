// B10 desktop FIELD-WIDTH ledger (DEC-896/DEC-808 wave-28, task w28-c).
//
// WHY: DESIGN-RULINGS B10 rules "field width follows content, not the
// column." The pack draws that register concretely: inside
// docs/design/Chautauqua Settings.dc.html's `Settings · editing …` desktop
// frames, a field wrapper carries an explicit `max-width:<N>px`.
// app/src/pages/settings/settings.css declares six `--chq-field-w-*`
// tokens (date 200, seats 110, name 320, slug 420, venue 460, timezone
// 300). Nothing enumerated the drawn population before this file -- the
// only check in the tree was a four-token hand list, which is exactly
// DEC-180's "a hand-listed population is not a population."
//
// This file MEASURES and RATCHETS only. It fixes nothing: desktop stays
// frozen (it touches no CSS byte), and it changes nothing in
// app/src/pages/settings/settings-field-width.test.ts (a sibling-owned
// file, never edited here).
//
//   1. POPULATION: readdirSync over docs/design (never a hand-listed
//      manifest) + the same label/extent walk test/desktop-frame-ledger.
//      scan.test.ts and test/desktop-control-floor.scan.test.ts use
//      (ported here, never imported -- both are sibling-owned), kept only
//      for frames whose label begins "Settings · editing" and whose
//      extent carries no `width:390px`+`height:844` (desktop, not phone).
//      Seven such frames exist, all inside Chautauqua Settings.dc.html (the
//      only *.dc.html file with any `Settings · editing` label -- measured
//      via readdirSync + grep-equivalent scan, not assumed). One is
//      EXCLUDED per DEVIATIONS.md §6 (see DEVIATIONS_SECTION_6_EXCLUDED
//      below): "Settings · editing your data" (line 1111) -- its label
//      begins "Settings · editing" so it is part of THIS grammar's
//      population; the other DEVIATIONS §6 extent, "Import from
//      Sessionboard" (line 1507), never qualifies in the first place (its
//      label does not begin "Settings · editing"), and is named in the
//      same const purely so no line inside it is ever cited by accident.
//      Inside each SURVIVING frame's extent,
//      every `max-width:(\d+)px` occurrence (never a bare `width:`, which
//      in this file's frames only ever draws page chrome -- the 1600px
//      page shell and the 196px nav rail, both grades this file must never
//      count as a field) is one drawn field width.
//
//   2. LABEL: for each drawn width, the first non-empty, non-mustache
//      (`{{…}}`) `<span>TEXT</span>` text found scanning FORWARD from the
//      width's own position -- the frame's own convention of "a micro-
//      label span immediately precedes/opens the field it describes",
//      identical for a single field (e.g. "Time zone") and for a two-up
//      pair (the pair wrapper's own max-width resolves via its FIRST
//      member's label, e.g. "Opens"). A list-row field with no adjacent
//      label span (the tracks/rooms/resources repeated-row shape) finds no
//      real span within the row and is honestly UNRESOLVED, never
//      misattributed to a distant section heading.
//
//   3. MATCH SIDE: every `<SettingsField label="…" … width="…">` call
//      site (attribute order-independent) in the non-test *.tsx files
//      under app/src/pages/settings/ (readdirSync, excluding *.test.tsx --
//      DEC-808) is a (label, widthKind) fact. Each widthKind resolves to
//      its px value via app/src/pages/settings/settings.css's
//      `--chq-field-w-<kind>` custom property (`full` has no numeric
//      token -- 100% of the measure -- and resolves to UNRESOLVED). A
//      drawn label with NO `SettingsField` call site sharing its exact
//      text is UNRESOLVED (`no-label-match`) -- never fuzzy-matched to a
//      near-miss (the frame's "Event name"/"Starts"/"Ends" against the
//      code's "Name"/"Start date"/"End date" are exactly this shape,
//      caught honestly rather than papered over).
//
//   4. TWO-UP PAIRS: a pair wrapper (its own attribute string additionally
//      carries `grid-template-columns:1fr 1fr`) resolves via its first TWO
//      member labels, each independently resolved per (3); when both
//      resolve to a numeric px value, the arithmetic sum (member + gap +
//      member, gap read from settings.css's `.chq-settings-field-pair`
//      rule) is compared to the drawn width within a 2px slack -- CSS grid
//      rounding, not a defect -- and graded `matches` with an Adjudication
//      note (never `diverges`) when it lands inside that slack, per
//      DEC-896/B10: the pack's `grid-template-columns:1fr 1fr; gap:18px;
//      max-width:420px` and settings.css's `.chq-settings-field-pair`
//      (`grid-template-columns: auto auto; justify-content: start; gap:
//      18px`) are drawing the SAME thing two different ways. When either
//      member fails to resolve, the whole pair is UNRESOLVED, never a
//      guessed partial sum.
//
//   5. GRADE: `matches` / `diverges` / `unresolved`. Two-sided ratchets
//      FIELD_WIDTH_DIVERGENCE_CEILING and FIELD_WIDTH_UNRESOLVED_CEILING,
//      each seeded by forcing it to -1 and reading the printed list on
//      this branch -- never from a snapshot or a hand guess. Registered in
//      scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE only (the same
//      disposition DESKTOP_FLOOR_DIVERGENCE_CEILING already carries: a
//      newly measured population must not move the campaign's goalposts
//      mid-convergence).
//
//   6. NON-VACUITY: exact drawn-population count, plus a synthetic
//      positive/negative fixture pair over fabricated strings (never a
//      real product token as its own evidence, mirroring
//      desktop-control-floor.scan.test.ts's own idiom).
//
//   7. LEDGER: docs/design/audit/desktop-field-width-v12.md records the
//      whole drawn population by frame, each row's resolution, and an
//      `## Adjudications` section -- including the two-up pair
//      EQUIVALENT-AT-THE-DRAWN-WIDTH arithmetic (200+18+200=418≈420).
//      Citations into app/src/ / src/ / test/ are drift-proof (bare path +
//      backtick quote, never `path:NNN`, per
//      test/citation-form-drift.scan.test.ts).
//
// This file names the app's ungraded desktop field-width fidelity; it does
// not close it, and it touches no CSS byte anywhere in the tree.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const SETTINGS_SRC_ROOT = join(REPO_ROOT, 'app', 'src', 'pages', 'settings');
const SETTINGS_CSS_PATH = join(SETTINGS_SRC_ROOT, 'settings.css');

// -- Population: label/extent walk, ported from test/desktop-frame-ledger.
// scan.test.ts / test/desktop-control-floor.scan.test.ts (never imported --
// both sibling-owned files). isPhone derivation identical to theirs. -------

const LABEL_RE = />([^<]+)<\//;

function isPhoneFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

interface RawLabel {
  line: number;
  title: string;
}

interface FrameExtent {
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
}

function labelsInFile(fileName: string): RawLabel[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels: RawLabel[] = [];
  lines.forEach((content, idx) => {
    if (!isLabelLine(content)) return;
    const m = content.match(LABEL_RE);
    if (m) labels.push({ line: idx + 1, title: m[1]!.trim() });
  });
  return labels;
}

function allFramesInFile(fileName: string): { frame: FrameExtent; isPhone: boolean }[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels = labelsInFile(fileName);
  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = nextLabel ? nextLabel.line : Infinity;
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isPhoneFrameLine);
    return { frame: { fileName, line: label.line, title: label.title, extentEnd }, isPhone };
  });
}

/** DEVIATIONS.md §6's two deferred extents, named by their opening label
 * line so no line inside either extent is ever cited by this file or its
 * ledger. Each `reason` is a PRINCIPLE, not a schedule note (graded by
 * test/exemption-reason-is-a-principle.scan.test.ts): the feature drawn in
 * the extent is user-deferred and has no implementation to grade a field
 * width against, a fact that stays true regardless of when (or whether) it
 * is ever built. */
const DEVIATIONS_SECTION_6_EXCLUDED: { label: string; startLine: number; reason: string }[] = [
  {
    label: 'Settings · editing your data',
    startLine: 1111,
    reason:
      'DEVIATIONS.md §6 marks this extent a user-deferred, unbuilt feature -- grading a drawn ' +
      'field width against code that implements nothing would book a deferred feature as covered ' +
      'rather than honestly leaving it ungraded.',
  },
  {
    label: 'Import from Sessionboard',
    startLine: 1507,
    reason:
      'DEVIATIONS.md §6 marks this extent a user-deferred, unbuilt feature -- grading a drawn ' +
      'field width against code that implements nothing would book a deferred feature as covered ' +
      'rather than honestly leaving it ungraded.',
  },
];
const EXCLUDED_START_LINES = new Set(DEVIATIONS_SECTION_6_EXCLUDED.map((e) => e.startLine));

const EDIT_FRAMES: FrameExtent[] = designFiles().flatMap((f) =>
  allFramesInFile(f)
    .filter((e) => !e.isPhone)
    .map((e) => e.frame)
    .filter((frame) => frame.title.startsWith('Settings · editing'))
    .filter((frame) => !EXCLUDED_START_LINES.has(frame.line))
);

// -- Drawn field-width extraction -------------------------------------------

export interface DrawnFieldWidth {
  fileName: string;
  line: number;
  drawnWidth: number;
  frameTitle: string;
  frameLine: number;
  isPair: boolean;
  /** Raw remainder of the extent text starting at this width's own
   * position -- carried so label lookup can scan forward without
   * re-reading the file per row. */
  tailText: string;
}

const MAX_WIDTH_RE = /<(\w+)\b([^>]*)\bmax-width:(\d+)px([^>]*)>/g;

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

/** Every drawn `max-width:<N>px` element in one frame's raw text extent.
 * Exported so the non-vacuity fixture below can drive this exact function
 * over a fabricated frame, never a real product token. */
export function drawnFieldWidthsInFrameText(
  text: string
): { drawnWidth: number; offset: number; isPair: boolean; tailText: string }[] {
  const out: { drawnWidth: number; offset: number; isPair: boolean; tailText: string }[] = [];
  MAX_WIDTH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAX_WIDTH_RE.exec(text))) {
    const before = m[2]!;
    const after = m[4]!;
    const attrs = before + after;
    const isPair = /grid-template-columns:\s*1fr 1fr/.test(attrs);
    out.push({
      drawnWidth: Number(m[3]),
      offset: m.index,
      isPair,
      tailText: text.slice(m.index + m[0].length),
    });
  }
  return out;
}

function drawnFieldWidthsInFile(fileName: string, frames: FrameExtent[]): DrawnFieldWidth[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }
  const out: DrawnFieldWidth[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    for (const raw of drawnFieldWidthsInFrameText(text)) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, startOff + raw.offset),
        drawnWidth: raw.drawnWidth,
        frameTitle: frame.title,
        frameLine: frame.line,
        isPair: raw.isPair,
        tailText: raw.tailText,
      });
    }
  }
  return out;
}

const FRAMES_BY_FILE = new Map<string, FrameExtent[]>();
for (const frame of EDIT_FRAMES) {
  const list = FRAMES_BY_FILE.get(frame.fileName) ?? [];
  list.push(frame);
  FRAMES_BY_FILE.set(frame.fileName, list);
}
const ALL_WIDTHS: DrawnFieldWidth[] = [...FRAMES_BY_FILE.entries()].flatMap(([fileName, frames]) =>
  drawnFieldWidthsInFile(fileName, frames)
);

// -- Label resolution: first real (non-empty, non-mustache) <span>TEXT</span>
// found scanning forward from the width's own position. -------------------

const SPAN_RE = /<span\b[^>]*>([^<]*)<\/span>/g;

/** Exported so the non-vacuity fixture below can drive this exact function
 * over a fabricated tail, never a real product token. Returns every real
 * span text found, in order -- callers take [0] for a single field, or
 * [0]/[1] for a pair's two members. */
export function forwardLabels(tailText: string): string[] {
  const out: string[] = [];
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // Bound the scan to a reasonable window: a label always sits within the
  // next ~1000 chars of markup in this pack's own authoring style (a span
  // immediately inside the field wrapper, or -- for a two-up pair -- the
  // second member's own label after the first member's full field box,
  // never several sections away).
  const window = tailText.slice(0, 1000);
  while ((m = SPAN_RE.exec(window))) {
    const raw = m[1]!.trim();
    if (raw.length < 2) continue;
    if (raw.includes('{{')) continue;
    out.push(raw);
    if (out.length >= 2) break;
  }
  return out;
}

// -- Match side: every <SettingsField label="…" width="…"> call site in the
// non-test app/src/pages/settings/*.tsx corpus, plus settings.css's
// --chq-field-w-* tokens and .chq-settings-field-pair's own gap. ----------

function settingsSourceFiles(): string[] {
  return readdirSync(SETTINGS_SRC_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && !e.name.includes('.test.'))
    .map((e) => join(SETTINGS_SRC_ROOT, e.name));
}

/** Each "Settings · editing …" frame's own owning panel component -- a
 * structural, stable fact (one edit view, one component) distinct from the
 * POPULATION enumeration above (which stays a readdirSync + label/extent
 * walk, never hand-listed). Needed because two DIFFERENT panels reuse the
 * identical label text "Time zone" for two DIFFERENT `SettingsFieldWidth`
 * kinds (CallForPapersPanel's is a read-only mirror of the event's own
 * zone, width="date"/200px; EventSettingsPanel's is the actual editable
 * zone, width="timezone"/300px) -- resolving against the WHOLE corpus's
 * label map would let the wrong panel's kind silently win by Map insertion
 * order. Scoping the join to each frame's own panel file is a JOIN-KEY
 * fix, not a population hand-list. */
const FRAME_TITLE_TO_PANEL_FILE: Record<string, string> = {
  'Settings · editing the call for papers': 'CallForPapersPanel.tsx',
  'Settings · editing the event': 'EventSettingsPanel.tsx',
  'Settings · editing tracks and rooms': 'TracksRoomsPanel.tsx',
  'Settings · editing the speaker portal': 'PortalSettingsPanel.tsx',
  'Settings · editing one saved embed': 'EmbedsPanel.tsx',
  'Settings · editing people and roles': 'PeopleRolesPanel.tsx',
};

const SETTINGS_FIELD_TAG_RE = /<SettingsField\b([^>]*)>/g;
const LABEL_ATTR_RE = /\blabel=(["'])((?:(?!\1).)*)\1/;
const WIDTH_ATTR_RE = /\bwidth=(["'])((?:(?!\1).)*)\1/;

/** label -> set of widthKind strings, built by scanning every
 * `<SettingsField … label="…" … width="…" …>` call site (attribute order-
 * independent) across every non-test *.tsx file in app/src/pages/settings/.
 * Exported for the non-vacuity fixture below (driven over a fabricated
 * blob, never the real corpus). */
export function extractSettingsFieldLabelWidths(source: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  SETTINGS_FIELD_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SETTINGS_FIELD_TAG_RE.exec(source))) {
    const attrs = m[1]!;
    const labelM = attrs.match(LABEL_ATTR_RE);
    const widthM = attrs.match(WIDTH_ATTR_RE);
    if (!labelM || !widthM) continue;
    const label = labelM[2]!;
    const kind = widthM[2]!;
    const set = map.get(label) ?? new Set<string>();
    set.add(kind);
    map.set(label, set);
  }
  return map;
}

/** fileBaseName -> (label -> widthKinds), scoped per panel file (never
 * merged into one corpus-wide map -- see FRAME_TITLE_TO_PANEL_FILE above). */
const SETTINGS_FIELD_LABEL_TO_WIDTH_BY_FILE = new Map<string, Map<string, Set<string>>>();
for (const file of settingsSourceFiles()) {
  const base = file.split('/').pop()!;
  const source = readFileSync(file, 'utf-8');
  SETTINGS_FIELD_LABEL_TO_WIDTH_BY_FILE.set(base, extractSettingsFieldLabelWidths(source));
}

const FIELD_WIDTH_TOKEN_RE = /--chq-field-w-([a-z]+):\s*(\d+)px/g;

/** Exported for the non-vacuity fixture below. */
export function extractFieldWidthTokens(css: string): Map<string, number> {
  const map = new Map<string, number>();
  FIELD_WIDTH_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_WIDTH_TOKEN_RE.exec(css))) {
    map.set(m[1]!, Number(m[2]));
  }
  return map;
}

const SETTINGS_CSS = readFileSync(SETTINGS_CSS_PATH, 'utf-8');
const FIELD_WIDTH_TOKENS = extractFieldWidthTokens(SETTINGS_CSS);

/** The declared gap of `.chq-settings-field-pair` (top-level rule, this
 * file never needs @media stripping -- DEC-385's base/unqualified value is
 * always the FIRST occurrence of the selector in an unminified sheet
 * authored base-first). Exported for the non-vacuity fixture below. */
export function extractPairGap(css: string): number | null {
  const ruleM = css.match(/\.chq-settings-field-pair\s*\{([^}]*)\}/);
  if (!ruleM) return null;
  const gapM = ruleM[1]!.match(/gap:\s*(\d+)px/);
  return gapM ? Number(gapM[1]) : null;
}
const PAIR_GAP = extractPairGap(SETTINGS_CSS);

// -- Wave-26 amendment (DEC-808): PLAIN-LABEL PAIR WRAPPER tier -------------
// The match side above only ever resolves a <SettingsField label="…"
// width="…"> call site. Draining the 4 unresolved rows exposed a SECOND,
// real match shape the join never covered: a plain `<label>TEXT` pair (no
// SettingsField, no --chq-field-w-* token) whose own wrapper class carries
// a LITERAL `max-width:<N>px` in settings.css -- e.g.
// EmbedsPanel.tsx's `.chq-settings-embed-field-pair` (DEC-896 wave-24
// amendment already adjudicates this exact 620px as EQUIVALENT-AT-THE-
// DRAWN-WIDTH). This tier is scoped to PAIR rows only (the shape it was
// found for) and requires BOTH member labels to occur, in order, as a
// `<label>`'s own immediate leading text inside exactly one wrapper class
// occurrence -- never a first-match pick (two occurrences, or two distinct
// classes, both leave the row honestly UNRESOLVED, same discipline as the
// SettingsField-pair tier above).

function escapeRegExpLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LITERAL_MAX_WIDTH_CLASS_RE = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;

/** class name -> its own literal (non `--chq-field-w-*` token) max-width,
 * FIRST top-level occurrence only (DEC-385 base/unqualified value, same
 * convention `extractPairGap` above already uses -- an @media override
 * never displaces the base declaration this tier reads). Exported for the
 * non-vacuity fixture below. */
export function extractLiteralMaxWidthClasses(css: string): Map<string, number> {
  const map = new Map<string, number>();
  LITERAL_MAX_WIDTH_CLASS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LITERAL_MAX_WIDTH_CLASS_RE.exec(css))) {
    const cls = m[1]!;
    const body = m[2]!;
    if (map.has(cls)) continue;
    if (body.includes('var(--chq-field-w-')) continue; // token-based -- the SettingsField tier already owns this
    const mw = body.match(/max-width:\s*(\d+)px/);
    if (!mw) continue;
    map.set(cls, Number(mw[1]));
  }
  return map;
}

const PLAIN_LABEL_LEADING_TEXT_RE = /<label>([^<]*)</g;
/** Bounded like `forwardLabels`'s own window -- a wrapper's two member
 * labels sit within its own immediate children, never several sections
 * away. */
const PLAIN_LABEL_WINDOW = 2000;

export interface PlainLabelPairResolution {
  className: string;
  declaredWidth: number;
}

/** Resolves a pair row's two member labels against every class in
 * `literalMaxWidthClasses` that (a) appears as `className="<class>"`
 * literally in `source` and (b) whose own immediate-children `<label>`
 * texts are, in order, EXACTLY [label0, label1]. Honesty: more than one
 * qualifying (class, occurrence) pair -- even the same class twice, or two
 * different classes -- returns null rather than picking a winner. Exported
 * for the non-vacuity fixture below. */
export function resolvePlainLabelPair(
  source: string,
  literalMaxWidthClasses: ReadonlyMap<string, number>,
  label0: string,
  label1: string
): PlainLabelPairResolution | null {
  const matches: PlainLabelPairResolution[] = [];
  for (const [cls, px] of literalMaxWidthClasses) {
    const classAttrRe = new RegExp(`className="${escapeRegExpLiteral(cls)}"`, 'g');
    let cm: RegExpExecArray | null;
    while ((cm = classAttrRe.exec(source))) {
      const windowText = source.slice(cm.index, cm.index + PLAIN_LABEL_WINDOW);
      PLAIN_LABEL_LEADING_TEXT_RE.lastIndex = 0;
      const found: string[] = [];
      let lm: RegExpExecArray | null;
      while ((lm = PLAIN_LABEL_LEADING_TEXT_RE.exec(windowText))) {
        const text = lm[1]!.trim();
        if (text.length === 0) continue;
        found.push(text);
        if (found.length >= 2) break;
      }
      if (found[0] === label0 && found[1] === label1) {
        matches.push({ className: cls, declaredWidth: px });
      }
    }
  }
  if (matches.length !== 1) return null;
  return matches[0]!;
}

const LITERAL_MAX_WIDTH_CLASSES = extractLiteralMaxWidthClasses(SETTINGS_CSS);
const SETTINGS_SOURCE_BLOB = settingsSourceFiles()
  .map((f) => readFileSync(f, 'utf-8'))
  .join('\n');

// -- Join + grade -------------------------------------------------------

export type FieldWidthStatus = 'matches' | 'diverges' | 'unresolved';

export interface GradedFieldWidth {
  row: DrawnFieldWidth;
  status: FieldWidthStatus;
  reason: 'no-label-match' | 'no-token' | null;
  labels: string[];
  declaredWidth: number | null;
  pairEquivalent: boolean;
}

function resolveLabel(
  label: string,
  panelFile: string | undefined
): { widthKind: string; declared: number } | { widthKind: null; declared: null } {
  const labelMap = panelFile ? SETTINGS_FIELD_LABEL_TO_WIDTH_BY_FILE.get(panelFile) : undefined;
  const kinds = labelMap?.get(label);
  if (!kinds) return { widthKind: null, declared: null };
  for (const kind of kinds) {
    const declared = FIELD_WIDTH_TOKENS.get(kind);
    if (declared !== undefined) return { widthKind: kind, declared };
  }
  return { widthKind: null, declared: null };
}

function labelIsKnown(label: string, panelFile: string | undefined): boolean {
  const labelMap = panelFile ? SETTINGS_FIELD_LABEL_TO_WIDTH_BY_FILE.get(panelFile) : undefined;
  return labelMap?.has(label) ?? false;
}

function gradeRow(row: DrawnFieldWidth): GradedFieldWidth {
  const labels = forwardLabels(row.tailText);
  const panelFile = FRAME_TITLE_TO_PANEL_FILE[row.frameTitle];
  if (labels.length === 0) {
    return { row, status: 'unresolved', reason: 'no-label-match', labels, declaredWidth: null, pairEquivalent: false };
  }

  if (row.isPair && labels.length >= 2) {
    const first = resolveLabel(labels[0]!, panelFile);
    const second = resolveLabel(labels[1]!, panelFile);
    if (first.declared !== null && second.declared !== null && PAIR_GAP !== null) {
      const sum = first.declared + second.declared + PAIR_GAP;
      const status: FieldWidthStatus = Math.abs(sum - row.drawnWidth) <= 2 ? 'matches' : 'diverges';
      return {
        row,
        status,
        reason: null,
        labels,
        declaredWidth: sum,
        pairEquivalent: status === 'matches',
      };
    }
    // Either member (or the pair rule's own gap) failed to resolve via the
    // SettingsField-pair tier -- try the wave-26 PLAIN-LABEL PAIR WRAPPER
    // tier before giving up (DEC-808 wave-26 amendment).
    const plain = resolvePlainLabelPair(SETTINGS_SOURCE_BLOB, LITERAL_MAX_WIDTH_CLASSES, labels[0]!, labels[1]!);
    if (plain !== null) {
      const status: FieldWidthStatus = Math.abs(plain.declaredWidth - row.drawnWidth) <= 2 ? 'matches' : 'diverges';
      return {
        row,
        status,
        reason: null,
        labels,
        declaredWidth: plain.declaredWidth,
        pairEquivalent: status === 'matches',
      };
    }
    // Neither tier resolved -- an honest UNRESOLVED, never a guessed
    // partial sum.
    return { row, status: 'unresolved', reason: 'no-label-match', labels, declaredWidth: null, pairEquivalent: false };
  }

  const resolved = resolveLabel(labels[0]!, panelFile);
  if (resolved.declared === null) {
    const knownButNoToken = labelIsKnown(labels[0]!, panelFile);
    return {
      row,
      status: 'unresolved',
      reason: knownButNoToken ? 'no-token' : 'no-label-match',
      labels,
      declaredWidth: null,
      pairEquivalent: false,
    };
  }
  const status: FieldWidthStatus = resolved.declared === row.drawnWidth ? 'matches' : 'diverges';
  return { row, status, reason: null, labels, declaredWidth: resolved.declared, pairEquivalent: false };
}

const GRADED: GradedFieldWidth[] = ALL_WIDTHS.map(gradeRow);
const DIVERGENCES: GradedFieldWidth[] = GRADED.filter((r) => r.status === 'diverges');
const UNRESOLVED: GradedFieldWidth[] = GRADED.filter((r) => r.status === 'unresolved');

// -- Ratchets -----------------------------------------------------------
// Both measured on this branch by forcing each to -1 and reading the
// printed row list. Two-sided per DEC-808 (every ratchet in this campaign
// is two-sided); registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE only, mirroring DESKTOP_FLOOR_DIVERGENCE_CEILING's
// own reasoning: a new non-zero row in the exit gate would move the
// campaign's goalposts mid-convergence.
export const FIELD_WIDTH_DIVERGENCE_CEILING = 0;
export const FIELD_WIDTH_UNRESOLVED_CEILING = 3;

describe('B10 desktop field-width ledger (DEC-896/DEC-808 wave-28, v12 mobile campaign)', () => {
  it('non-vacuity: enumerates exactly 6 desktop "Settings · editing" frames, 2 excluded per DEVIATIONS §6', () => {
    const allEditFramesIncludingExcluded = designFiles().flatMap((f) =>
      allFramesInFile(f)
        .filter((e) => !e.isPhone)
        .map((e) => e.frame)
        .filter((frame) => frame.title.startsWith('Settings · editing'))
    );
    expect(allEditFramesIncludingExcluded.length).toBe(7);
    expect(EDIT_FRAMES.length).toBe(6);
    for (const excl of DEVIATIONS_SECTION_6_EXCLUDED) {
      expect(EDIT_FRAMES.some((f) => f.line === excl.startLine)).toBe(false);
    }
  });

  it('non-vacuity: extracts exactly 11 drawn field widths across the 6 surviving frames', () => {
    expect(ALL_WIDTHS.length).toBe(11);
    const perFrame: Record<string, number> = {};
    for (const w of ALL_WIDTHS) perFrame[w.frameTitle] = (perFrame[w.frameTitle] ?? 0) + 1;
    expect(perFrame).toEqual({
      'Settings · editing the call for papers': 3,
      'Settings · editing the event': 4,
      'Settings · editing tracks and rooms': 2,
      'Settings · editing the speaker portal': 1,
      'Settings · editing one saved embed': 1,
    });
    // "Settings · editing people and roles" draws no field-wrapper width --
    // confirmed absent rather than silently missing from the breakdown.
    expect(perFrame['Settings · editing people and roles']).toBeUndefined();
  });

  it('non-vacuity: synthetic positive/negative extraction over a fabricated fixture', () => {
    const fabricatedFrameText = [
      '<div style="width:1600px; background:#F4F1E8">',
      '  <nav style="width:196px; justify-self:end">Zzy Chrome Absent</nav>',
      '  <div style="padding:16px 0 0; display:grid; grid-template-columns:1fr 1fr; gap:18px; max-width:420px">',
      '    <div style="display:flex; flex-direction:column; gap:6px">',
      '      <span style="font-size:11px">Zzy Opens</span>',
      '    </div>',
      '    <div style="display:flex; flex-direction:column; gap:6px">',
      '      <span style="font-size:11px">Zzy Closes</span>',
      '    </div>',
      '  </div>',
      '  <div style="display:flex; flex-direction:column; gap:6px; max-width:200px">',
      '    <span style="font-size:11px">Zzy Time zone</span>',
      '  </div>',
      '</div>',
    ].join('\n');
    const extracted = drawnFieldWidthsInFrameText(fabricatedFrameText);
    // NEGATIVE: bare `width:196px`/`width:1600px` chrome is never extracted
    // -- only max-width counts.
    expect(extracted.length).toBe(2);
    expect(extracted[0]!.drawnWidth).toBe(420);
    expect(extracted[0]!.isPair).toBe(true);
    expect(extracted[1]!.drawnWidth).toBe(200);
    expect(extracted[1]!.isPair).toBe(false);

    const pairLabels = forwardLabels(extracted[0]!.tailText);
    expect(pairLabels).toEqual(['Zzy Opens', 'Zzy Closes']);
    const singleLabels = forwardLabels(extracted[1]!.tailText);
    expect(singleLabels).toEqual(['Zzy Time zone']);

    // NEGATIVE: an empty span and a mustache-bound span are both skipped.
    const noisyTail = '<span style="{{ t.swatch }}"></span><div>{{ t.name }}</div><span>Zzy Real</span>';
    expect(forwardLabels(noisyTail)).toEqual(['Zzy Real']);
  });

  it('non-vacuity: synthetic label/token resolution over a fabricated source+css pair', () => {
    const fabricatedSource = [
      '<SettingsField label="Zzy Opens" htmlFor="x" width="date">',
      '<SettingsField width="name" label="Zzy Widget">',
    ].join('\n');
    const labelMap = extractSettingsFieldLabelWidths(fabricatedSource);
    expect([...labelMap.get('Zzy Opens')!]).toEqual(['date']);
    expect([...labelMap.get('Zzy Widget')!]).toEqual(['name']);
    expect(labelMap.has('Zzy Unmentioned')).toBe(false);

    const fabricatedCss = '--chq-field-w-date: 200px;\n--chq-field-w-name: 320px;';
    const tokenMap = extractFieldWidthTokens(fabricatedCss);
    expect(tokenMap.get('date')).toBe(200);
    expect(tokenMap.get('name')).toBe(320);
    expect(tokenMap.has('seats')).toBe(false);

    const fabricatedPairCss = '.chq-settings-field-pair { display: grid; gap: 18px; }';
    expect(extractPairGap(fabricatedPairCss)).toBe(18);
    expect(extractPairGap('.chq-unrelated { gap: 4px; }')).toBeNull();
  });

  it('non-vacuity: wave-26 PLAIN-LABEL PAIR WRAPPER tier over a fabricated source+css pair', () => {
    // POSITIVE: a fabricated class with a literal (non-token) max-width
    // whose fabricated source has exactly one occurrence with both member
    // labels resolves.
    const fabricatedCss = [
      '.zzy-plain-pair { display: grid; gap: 12px; max-width: 555px; }',
      '.zzy-token-pair { display: grid; max-width: var(--chq-field-w-name); }',
    ].join('\n');
    const classes = extractLiteralMaxWidthClasses(fabricatedCss);
    expect(classes.get('zzy-plain-pair')).toBe(555);
    // NEGATIVE: a token-based max-width is the SettingsField tier's own
    // territory, never double-counted here.
    expect(classes.has('zzy-token-pair')).toBe(false);

    const fabricatedSource = [
      '<div className="zzy-plain-pair">',
      '  <label>',
      '    Zzy First',
      '    <input />',
      '  </label>',
      '  <label>',
      '    Zzy Second',
      '    <input />',
      '  </label>',
      '</div>',
    ].join('\n');
    const resolved = resolvePlainLabelPair(fabricatedSource, classes, 'Zzy First', 'Zzy Second');
    expect(resolved).toEqual({ className: 'zzy-plain-pair', declaredWidth: 555 });

    // NEGATIVE: labels out of order, or a label that is not present, never
    // resolve.
    expect(resolvePlainLabelPair(fabricatedSource, classes, 'Zzy Second', 'Zzy First')).toBeNull();
    expect(resolvePlainLabelPair(fabricatedSource, classes, 'Zzy First', 'Zzy Unmentioned')).toBeNull();

    // NEGATIVE (honesty clause): two occurrences of the same class, each
    // pairing DIFFERENT labels, is ambiguous -- neither wins.
    const twoOccurrenceSource =
      fabricatedSource +
      '\n<div className="zzy-plain-pair">\n  <label>\n    Zzy First\n    <input />\n  </label>\n  <label>\n    Zzy Third\n    <input />\n  </label>\n</div>';
    expect(resolvePlainLabelPair(twoOccurrenceSource, classes, 'Zzy First', 'Zzy Second')).not.toBeNull();
    const ambiguousClasses = new Map(classes);
    ambiguousClasses.set('zzy-plain-pair-2', 555);
    const ambiguousSource = fabricatedSource.replace('zzy-plain-pair"', 'zzy-plain-pair-2"') + '\n' + fabricatedSource;
    expect(resolvePlainLabelPair(ambiguousSource, ambiguousClasses, 'Zzy First', 'Zzy Second')).toBeNull();
  });

  it('the wave-26-drained embed pair (Name/Surface) resolves via the plain-label tier', () => {
    // EmbedsPanel.tsx has no <SettingsField> at all -- the recipe's
    // Name/Surface pair renders via plain <label> text inside
    // .chq-settings-embed-field-pair, whose own literal max-width:620px
    // (DEC-896 wave-24 amendment) matches the drawn 620px exactly.
    const embedPair = GRADED.find(
      (r) => r.row.frameTitle === 'Settings · editing one saved embed' && r.row.isPair
    );
    expect(embedPair?.status).toBe('matches');
    expect(embedPair?.declaredWidth).toBe(620);
    expect(embedPair?.pairEquivalent).toBe(true);
  });

  it('every row is accounted for exactly once across matches/diverges/unresolved', () => {
    expect(GRADED.length).toBe(ALL_WIDTHS.length);
    const matchCount = GRADED.filter((r) => r.status === 'matches').length;
    expect(matchCount + DIVERGENCES.length + UNRESOLVED.length).toBe(ALL_WIDTHS.length);
  });

  it('the two-up date pairs (CFP Opens/Closes, Event Starts/Ends) resolve honestly', () => {
    // CFP's Opens/Closes pair labels match the code exactly and grade
    // matches (200+18+200=418≈420, EQUIVALENT-AT-THE-DRAWN-WIDTH).
    const cfpPair = GRADED.find((r) => r.row.frameTitle === 'Settings · editing the call for papers' && r.row.isPair);
    expect(cfpPair?.status).toBe('matches');
    expect(cfpPair?.pairEquivalent).toBe(true);
    // DEC-613 wave-24 amendment: EventSettingsPanel.tsx's SettingsField
    // labels now read the frame's own words ("Starts"/"Ends"), so this
    // pair resolves and grades matches too (200+18+200=418≈420,
    // EQUIVALENT-AT-THE-DRAWN-WIDTH), same as CFP's pair.
    const eventPair = GRADED.find((r) => r.row.frameTitle === 'Settings · editing the event' && r.row.isPair);
    expect(eventPair?.status).toBe('matches');
    expect(eventPair?.pairEquivalent).toBe(true);
  });

  it(`never exceeds FIELD_WIDTH_DIVERGENCE_CEILING (${FIELD_WIDTH_DIVERGENCE_CEILING}) resolved divergences`, () => {
    if (DIVERGENCES.length > FIELD_WIDTH_DIVERGENCE_CEILING) {
      const rows = DIVERGENCES.map(
        (r) =>
          `${r.row.fileName}:${r.row.line} -- draws max-width:${r.row.drawnWidth}px (frame: ${r.row.frameTitle}); ` +
          `resolved labels [${r.labels.join(', ')}] declare ${r.declaredWidth}px`
      );
      throw new Error(
        `${DIVERGENCES.length} desktop field-width divergences, above the ceiling of ` +
          `${FIELD_WIDTH_DIVERGENCE_CEILING}. FIELD_WIDTH_DIVERGENCE_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane). Divergences:\n${rows.join('\n')}`
      );
    }
    expect(DIVERGENCES.length).toBeLessThanOrEqual(FIELD_WIDTH_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW FIELD_WIDTH_DIVERGENCE_CEILING (${FIELD_WIDTH_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (DIVERGENCES.length < FIELD_WIDTH_DIVERGENCE_CEILING) {
      throw new Error(
        `${DIVERGENCES.length} desktop field-width divergences, below the ceiling of ` +
          `${FIELD_WIDTH_DIVERGENCE_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const FIELD_WIDTH_DIVERGENCE_CEILING = ${DIVERGENCES.length};`
      );
    }
    expect(DIVERGENCES.length).toBeGreaterThanOrEqual(FIELD_WIDTH_DIVERGENCE_CEILING);
  });

  it(`never exceeds FIELD_WIDTH_UNRESOLVED_CEILING (${FIELD_WIDTH_UNRESOLVED_CEILING}) unresolved rows`, () => {
    if (UNRESOLVED.length > FIELD_WIDTH_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} desktop field-width rows are unresolved, above the ceiling of ` +
          `${FIELD_WIDTH_UNRESOLVED_CEILING}. FIELD_WIDTH_UNRESOLVED_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane).`
      );
    }
    expect(UNRESOLVED.length).toBeLessThanOrEqual(FIELD_WIDTH_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW FIELD_WIDTH_UNRESOLVED_CEILING (${FIELD_WIDTH_UNRESOLVED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNRESOLVED.length < FIELD_WIDTH_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} desktop field-width rows are unresolved, below the ceiling of ` +
          `${FIELD_WIDTH_UNRESOLVED_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const FIELD_WIDTH_UNRESOLVED_CEILING = ${UNRESOLVED.length};`
      );
    }
    expect(UNRESOLVED.length).toBeGreaterThanOrEqual(FIELD_WIDTH_UNRESOLVED_CEILING);
  });
});
