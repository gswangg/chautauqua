// Pack drawn `padding` vocabulary ratchet (DEC-069 wave-53 amendment,
// task w53-e).
//
// WHY: docs/design/audit/pack-grid-track-vocabulary-v12.md's own "Rejected
// in the same measurement pass" section names `padding` as the pack's
// largest ungraded geometry property (1786 drawn declarations, 439
// unmatched at that measurement) and records that the skip was for exactly
// one named, derivable reason -- 158 of the unmatched are the frame's own
// `5px 10px` number-badge chrome (the small dark/olive "Agenda" / "390" /
// "Modal" tag every frame carries), an instrument artefact, not a defect
// count. `gap`, `align-items`, `justify-content`, `flex-direction`,
// `white-space` and `overflow` all measure ZERO unmatched (that audit's own
// finding, not re-measured here); `padding` is the only large axis left
// wholly ungraded.
//
// This file is a PORT of test/pack-grid-track-vocabulary.scan.test.ts's
// exact population/match/normalise/ratchet shape (never imported --
// sibling-owned file, DEC-613 test-helper convention: shared PURE helpers
// come from test/helpers/, the label/extent walk itself is ported
// byte-for-byte per that file's own header). It grades a different
// property and a different exclusion.
//
// THE BADGE EXCLUSION IS DERIVED, NEVER HAND-LISTED (DEC-069 wave-53 clause
// (a)): every `padding:5px 10px` occurrence in docs/design/*.dc.html sits
// inside one of exactly two full `style="..."` attribute strings, both with
// the identical shape `font-size:11px; font-weight:700;
// letter-spacing:0.1em; background:#......; color:#......; padding:5px
// 10px; border-radius:4px` (verified by hand this wave: `grep -oh
// 'style="[^"]*padding:5px 10px;[^"]*"' docs/design/*.dc.html | sort -u`
// prints exactly those two strings, nothing else). BADGE_STYLE_ATTR_RE
// below matches that exact combination of the badge's OWN four
// distinguishing declarations -- font-size:11px, font-weight:700,
// letter-spacing:0.1em, border-radius:4px, bracketing the padding value --
// so a padding declaration is excluded because the STYLE ATTRIBUTE IT
// LIVES IN structurally has the badge's shape, never because of a line
// number. If the pack ever draws a badge whose attribute deviates from this
// shape, the derivation stops excluding it (fails loud toward MORE
// offenders, never silently drops a real one).
//
// This file MEASURES and PARKS only. It moves no CSS byte -- desktop stays
// frozen. Per DEC-069 wave-53 clause (b) the resulting ratchet is
// registered in scripts/exit-predicate/campaign-scope/out-of-campaign-
// scope.ts ONLY (a fresh, previously-uncounted ~252-row population must not
// move the campaign's own goalposts mid-convergence) -- never in
// TIER2_CEILING_NAMES, and never in both (the wave-42 "graded-but-
// discharged, printed by no row" defect that registry already records).
//
//   1. POPULATION: readdirSync docs/design for *.dc.html. Each file's
//      extent is clipped at its single `</x-dc>` line. The label/extent
//      walk, EXPLAINER exclusion list and DEVIATIONS-Section-6 derivation
//      are PORTED verbatim from test/pack-grid-track-vocabulary.scan.test.ts
//      (itself ported from test/desktop-frame-ledger.scan.test.ts), so the
//      same three documentation panels and the same DEVIATIONS.md §6
//      deviation-deferred frames are excluded BY DERIVATION. Every
//      `padding:` occurrence inside a REACHABLE frame's extent, OUTSIDE a
//      badge-shaped style attribute, is one drawn padding declaration.
//
//   2. MATCH SIDE: every `padding:` declaration in non-test app/src/**/*.css,
//      app/src/**/*.ts(x), src/**/*.ts(x) (which is also every
//      src/**/*.css.ts file), readdirSync'd, `*.test.*` excluded. Comments
//      stripped with the shared stripCssComments (DEC-613); each source
//      split on `@media` blocks, only the text OUTSIDE any `@media` block
//      graded (DEC-385: desktop is the base/unqualified declaration).
//
//   3. NORMALISATION, applied to BOTH sides: collapse whitespace to single
//      spaces; resolve a value that is exactly `var(--x)` (with an
//      optional fallback) against `--x`'s own top-level, non-`@media`
//      declaration in the product corpus before comparing (recursively).
//      No minmax(0,X) rewrite -- that is a grid-track-only artefact.
//
//   4. RATCHET: two-sided `PACK_PADDING_UNMATCHED_CEILING`, seeded to the
//      count measured on this branch. A vacuous-population tripwire pins
//      the exact total drawn-declaration count, the exact derived-badge-
//      exclusion count, plus one positive control and one negative control.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_069 } from "../src/decisions";
import { splitMediaBlocks } from "./helpers/css-media-blocks";
import { stripCssComments } from "./helpers/strip-css-comments";

// Confirms this file's population depends on the ruling it implements
// (compile-checked, per the standing house rule).
void DEC_069;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_ROOT = join(REPO_ROOT, "docs", "design");
const APP_SRC_ROOT = join(REPO_ROOT, "app", "src");
const SRC_ROOT = join(REPO_ROOT, "src");

// -- Population: label/extent walk, PORTED (never imported) from
// test/pack-grid-track-vocabulary.scan.test.ts, byte-identical grammar. ----

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
// test/pack-grid-track-vocabulary.scan.test.ts's own ported copy. ----------

const TEMPLATE_INTERPOLATION_RE = /^\{\{.*\}\}$/;

function isTemplateInterpolation(frame: Frame): boolean {
  return TEMPLATE_INTERPOLATION_RE.test(frame.title);
}

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

// -- Badge-chrome derivation: a padding declaration is excluded iff it
// falls inside a `style="..."` attribute that ALSO declares the badge's own
// four distinguishing properties (font-size:11px, font-weight:700,
// letter-spacing:0.1em, border-radius:4px) around a `padding:5px 10px`
// value -- the frame's own drawn element shape, never a line-number list.
// ---------------------------------------------------------------------------

const BADGE_STYLE_ATTR_RE =
  /style="font-size:11px; font-weight:700; letter-spacing:0\.1em; background:#[0-9A-Fa-f]{3,6}; color:#[0-9A-Fa-f]{3,6}; padding:5px 10px; border-radius:4px"/g;

interface Span {
  start: number;
  end: number;
}

function badgeSpansInFile(fileName: string, root: string = DESIGN_ROOT): Span[] {
  const full = join(root, fileName);
  const content = readFileSync(full, "utf-8");
  const out: Span[] = [];
  BADGE_STYLE_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BADGE_STYLE_ATTR_RE.exec(content))) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function isWithinAnySpan(offset: number, spans: readonly Span[]): boolean {
  return spans.some((s) => offset >= s.start && offset < s.end);
}

// -- Pack side: every drawn padding: declaration inside a REACHABLE frame's
// extent, outside a derived badge span, resolved to its owning frame
// label. -------------------------------------------------------------------

const PADDING_RE = /(?<![\w-])padding:\s*([^;"']+)/g;

interface PackPadding {
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

function packPaddingInFrame(frame: Frame, badgeSpans: readonly Span[], root: string = DESIGN_ROOT): PackPadding[] {
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
  const out: PackPadding[] = [];
  PADDING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PADDING_RE.exec(text))) {
    const absoluteOffset = startOff + m.index;
    if (isWithinAnySpan(absoluteOffset, badgeSpans)) continue;
    out.push({
      fileName: frame.fileName,
      file: frame.file,
      line: offsetToLine(lineStartIndex, absoluteOffset),
      rawValue: m[1]!.trim(),
      frameTitle: frame.title,
      frameLine: frame.line,
    });
  }
  return out;
}

const BADGE_SPANS_BY_FILE: Map<string, Span[]> = new Map(designFiles().map((f) => [f, badgeSpansInFile(f)]));

const PACK_PADDING: PackPadding[] = REACHABLE_FRAMES.flatMap((f) =>
  packPaddingInFrame(f, BADGE_SPANS_BY_FILE.get(f.fileName) ?? [])
);

/** Exact total `padding:` occurrences across every *.dc.html file, scoped
 * to nothing -- a raw text count, independent of the label walk and the
 * badge derivation, so neither can silently drop a declaration without
 * this tripwire noticing. */
function totalDrawnDeclarations(): number {
  let n = 0;
  for (const fileName of designFiles()) {
    const content = readFileSync(join(DESIGN_ROOT, fileName), "utf-8");
    PADDING_RE.lastIndex = 0;
    while (PADDING_RE.exec(content)) n++;
  }
  return n;
}

/** Exact total derived-badge-exclusion `padding:5px 10px` occurrences
 * across every *.dc.html file -- independent of the frame-extent walk, so
 * the badge derivation's own count is verifiable on its own. */
function totalBadgePaddingDeclarations(): number {
  let n = 0;
  for (const fileName of designFiles()) {
    const spans = BADGE_SPANS_BY_FILE.get(fileName) ?? [];
    const content = readFileSync(join(DESIGN_ROOT, fileName), "utf-8");
    PADDING_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PADDING_RE.exec(content))) {
      if (isWithinAnySpan(m.index, spans)) n++;
    }
  }
  return n;
}

const TOTAL_DRAWN_DECLARATIONS = totalDrawnDeclarations();
const TOTAL_BADGE_DECLARATIONS = totalBadgePaddingDeclarations();

// -- Match side: every padding declaration + every custom property
// declaration in the non-test product corpus, base/unqualified (outside
// @media) only per DEC-385. -------------------------------------------------

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

const PRODUCT_FILES: string[] = [
  ...listProductFiles(APP_SRC_ROOT, [".css", ".ts", ".tsx"]),
  ...listProductFiles(SRC_ROOT, [".ts", ".tsx"]),
];

interface ProductSource {
  path: string;
  baseText: string;
}

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

interface ProductPaddingDeclaration {
  path: string;
  rawValue: string;
}

function extractPaddingDeclarations(sources: readonly ProductSource[]): ProductPaddingDeclaration[] {
  const out: ProductPaddingDeclaration[] = [];
  const re = /(?<![\w-])padding:\s*([^;]+);/g;
  for (const s of sources) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s.baseText))) {
      out.push({ path: s.path, rawValue: m[1]!.trim() });
    }
  }
  return out;
}

const PRODUCT_PADDING_DECLARATIONS = extractPaddingDeclarations(PRODUCT_SOURCES);

// -- Normalisation, applied to both sides ------------------------------------

function collapseWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/;

function resolveVar(value: string, customProps: ReadonlyMap<string, string>, depth = 0): string {
  if (depth > 5) return value;
  const collapsed = collapseWhitespace(value);
  const m = collapsed.match(VAR_RE);
  if (!m) return collapsed;
  const name = m[1]!.replace(/^--/, "");
  const declared = customProps.get(name);
  if (declared !== undefined) return resolveVar(declared, customProps, depth + 1);
  if (m[2] !== undefined) return resolveVar(m[2]!, customProps, depth + 1);
  return collapsed;
}

function normalizePadding(raw: string, customProps: ReadonlyMap<string, string>): string {
  const resolved = resolveVar(raw, customProps);
  return collapseWhitespace(resolved);
}

const PRODUCT_NORMALIZED_VALUES: ReadonlySet<string> = new Set(
  PRODUCT_PADDING_DECLARATIONS.map((d) => normalizePadding(d.rawValue, CUSTOM_PROPERTIES))
);

// -- Grade --------------------------------------------------------------

interface GradedPackPadding {
  padding: PackPadding;
  normalized: string;
  matched: boolean;
}

const GRADED: GradedPackPadding[] = PACK_PADDING.map((padding) => {
  const normalized = normalizePadding(padding.rawValue, CUSTOM_PROPERTIES);
  return { padding, normalized, matched: PRODUCT_NORMALIZED_VALUES.has(normalized) };
});

const UNMATCHED: GradedPackPadding[] = GRADED.filter((g) => !g.matched);

// -- Ratchet -----------------------------------------------------------
// Measured on this branch (v12m-w53-e) by forcing this to -1 once and
// reading the printed offender list -- never arithmetic on the WHY
// section's 439. Per DEC-069's wave-53 amendment this constant is PARKED
// (registered in OUT_OF_CAMPAIGN_SCOPE only, never TIER2_CEILING_NAMES):
// two-sided per every ratchet in this campaign regardless of parked status
// -- may only be RAISED (a merge-train act, never a worker's edit
// mid-lane) and must never sit below the measured count either.
// 252 -> 219 (multi-portal, re-measured on the integrated tree).
// 219 -> 222 (multi-portal decision 74, re-measured by diffing the
// unmatched roster against the previous commit): three drawn `9px 14px`
// paddings -- Public and Portal.dc.html:81 and Settings.dc.html:205/:256 --
// had only ever matched a declaration in the deleted general-preview /
// Settings resource rules; no shipped rule carries that value now.
export const PACK_PADDING_UNMATCHED_CEILING = 222;

describe("pack drawn padding vocabulary (DEC-069 wave-53 amendment, v12 mobile campaign, PARKED)", () => {
  it("vacuous-population tripwire: the raw padding: count, the badge-derived exclusion count, and the reachable-frame count are all non-zero and self-consistent", () => {
    expect(TOTAL_DRAWN_DECLARATIONS).toBeGreaterThan(0);
    expect(TOTAL_BADGE_DECLARATIONS).toBeGreaterThan(0);
    expect(TOTAL_BADGE_DECLARATIONS).toBeLessThan(TOTAL_DRAWN_DECLARATIONS);
    expect(REACHABLE_FRAMES.length).toBeGreaterThan(0);
  });

  it("the badge derivation resolves to exactly two full style-attribute shapes, both padding:5px 10px, and excludes exactly 158 occurrences pack-wide", () => {
    expect(TOTAL_BADGE_DECLARATIONS).toBe(158);
    const allSpanTexts = new Set<string>();
    for (const fileName of designFiles()) {
      const content = readFileSync(join(DESIGN_ROOT, fileName), "utf-8");
      BADGE_STYLE_ATTR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BADGE_STYLE_ATTR_RE.exec(content))) allSpanTexts.add(m[0]);
    }
    expect(allSpanTexts.size).toBe(2);
    for (const text of allSpanTexts) {
      expect(text).toContain("padding:5px 10px");
      expect(text).toContain("font-size:11px");
      expect(text).toContain("font-weight:700");
      expect(text).toContain("letter-spacing:0.1em");
      expect(text).toContain("border-radius:4px");
    }
  });

  it("non-vacuity: PACK_PADDING and PRODUCT_PADDING_DECLARATIONS are both non-empty populations", () => {
    expect(PACK_PADDING.length).toBeGreaterThan(0);
    expect(PRODUCT_PADDING_DECLARATIONS.length).toBeGreaterThan(0);
    expect(CUSTOM_PROPERTIES.size).toBeGreaterThan(0);
  });

  it("POSITIVE control: Chautauqua Account.dc.html:43's input-field padding:0 13px resolves to a shipped value and grades matched", () => {
    const positive = GRADED.find((g) => g.padding.fileName === "Chautauqua Account.dc.html" && g.padding.line === 43);
    expect(positive).toBeDefined();
    expect(positive?.padding.rawValue).toBe("0 13px");
    expect(positive?.normalized).toBe("0 13px");
    expect(positive?.matched).toBe(true);
  });

  it("NEGATIVE control: Chautauqua Account.dc.html:33's login-panel padding:44px has no shipped match and grades unmatched, while the badge derivation still excludes every 5px 10px row (the exclusion did not over-fire onto an unrelated 44px value)", () => {
    const negative = GRADED.find((g) => g.padding.fileName === "Chautauqua Account.dc.html" && g.padding.line === 33);
    expect(negative).toBeDefined();
    expect(negative?.padding.rawValue).toBe("44px");
    expect(negative?.normalized).toBe("44px");
    expect(negative?.matched).toBe(false);
    expect(PACK_PADDING.every((p) => p.rawValue !== "5px 10px")).toBe(true);
    expect(UNMATCHED.length).toBeGreaterThan(0);
    expect(UNMATCHED.length).toBeLessThan(PACK_PADDING.length);
  });

  it("normalisation unit test: whitespace collapses on a fabricated value", () => {
    expect(collapseWhitespace("10px   15px\t20px")).toBe("10px 15px 20px");
    expect(normalizePadding("10px   15px", new Map())).toBe("10px 15px");
  });

  it("var() resolution unit test: a fabricated custom-property reference resolves recursively, with an honest pass-through when unresolved", () => {
    const fabricated = new Map([
      ["chq-fixture-a", "var(--chq-fixture-b)"],
      ["chq-fixture-b", "10px 20px"],
    ]);
    expect(normalizePadding("var(--chq-fixture-a)", fabricated)).toBe("10px 20px");
    expect(normalizePadding("var(--chq-fixture-unresolved, 5px)", fabricated)).toBe("5px");
    expect(normalizePadding("var(--chq-fixture-totally-unresolved)", fabricated)).toBe(
      "var(--chq-fixture-totally-unresolved)"
    );
  });

  it(`never exceeds PACK_PADDING_UNMATCHED_CEILING (${PACK_PADDING_UNMATCHED_CEILING}) unmatched drawn padding declarations`, () => {
    if (UNMATCHED.length > PACK_PADDING_UNMATCHED_CEILING) {
      const rows = UNMATCHED.map(
        (g) =>
          `${g.padding.file} :${g.padding.line} -- frame "${g.padding.frameTitle}" draws ` +
          `padding:${g.padding.rawValue} (normalized "${g.normalized}"), no shipped match`
      );
      throw new Error(
        `${UNMATCHED.length} drawn padding declarations have no shipped match, above the ceiling ` +
          `of ${PACK_PADDING_UNMATCHED_CEILING}. PACK_PADDING_UNMATCHED_CEILING may only be RAISED (a ` +
          `merge-train act, never a worker's edit mid-lane). Offenders:\n${rows.join("\n")}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(PACK_PADDING_UNMATCHED_CEILING);
  });

  it(`never sits BELOW PACK_PADDING_UNMATCHED_CEILING (${PACK_PADDING_UNMATCHED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < PACK_PADDING_UNMATCHED_CEILING) {
      throw new Error(
        `${UNMATCHED.length} unmatched drawn padding declarations, below the ceiling of ` +
          `${PACK_PADDING_UNMATCHED_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const PACK_PADDING_UNMATCHED_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(PACK_PADDING_UNMATCHED_CEILING);
  });
});
