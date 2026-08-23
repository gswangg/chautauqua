// Frame REPEATED-ROW ledger (DEC-180 wave-40; task w40-d).
//
// docs/design/audit/frame-conditional-state-v12.md's closing section names
// the pack's LAST unbuilt named population and deliberately does not build
// it: 201 `<sc-for list="{{ EXPR }}" as="ALIAS" hint-placeholder-count="N">`
// blocks across docs/design/*.dc.html. Each one commits a frame to
// rendering a REPEATED-ROW population from a named collection, at a drawn
// sample size -- a different vocabulary from that ledger's boolean
// `sc-if` branches (this is "how many rows", not "which branch"). Nothing
// in the campaign grades it. This file is a pure MEASURE-AND-RATCHET scan:
// no product byte and no CSS are changed by this lane.
//
// 1. POPULATION (derived at test time, never hand-listed -- DEC-180): walk
//    docs/design/*.dc.html via readdirSync, and regex every `<sc-for
//    list="{{ EXPR }}" as="ALIAS" hint-placeholder-count="N"> ... </sc-for>`
//    span with a same-depth nested walk (sc-for blocks nest -- Agenda's
//    `grid` wraps `row.cells`, a nested for-each of each row's own cells --
//    so a naive first-`</sc-for>` search would close the OUTER block on the
//    INNER one's own close tag). A vacuous-population tripwire (below) pins
//    this count at 201 across 13 files and >=8 frames -- the same "prove
//    the walk actually walked" discipline every DEC-180 population in this
//    campaign carries.
//
// 2. DERIVATION RULE ("the cluster that owns its frame maps over a real
//    collection into repeated markup"), graded against the WHOLE product
//    corpus (app/src/** + src/**, non-test, comment-stripped -- the same
//    corpus test/frame-caption-ledger.scan.test.ts already grades against,
//    reusing its shared primitives rather than re-deriving them, DEC-613):
//      TIER 1 -- COPY MATCH. This block's OWN literal text (its per-item
//        template, EXCLUDING any nested `<sc-for>` extent -- a nested
//        block's own copy belongs to that row, not its wrapper), i.e. every
//        run of >=6 non-mustache, non-tag characters. If any such literal
//        occurs verbatim (word-boundary, comment-stripped, entity-decoded --
//        frame-source-corpus.ts's normalizeSource/labelIsMatched, the same
//        primitives the caption/eyebrow/field-label/conditional-state
//        ledgers already share) anywhere in the product corpus, TIER 1
//        reports MATCHED-COPY: the row's own drawn content is realized
//        somewhere in the shipped app, which for a REPEATED row can only
//        happen if some component actually renders more than one of it.
//      TIER 2 -- STRUCTURAL MATCH, only when TIER 1 finds no literal at all
//        (a fully template-composed block whose only content is nested
//        mustaches). The list expression's LAST dotted segment (e.g.
//        `phoneSlots`, `rooms`, `cells` from `row.cells`) is searched as
//        `IDENT.map(` (comment-stripped, immediate adjacency to `.map(` --
//        the discriminant SHAPE that makes this safe even for a short or
//        common-English-word identifier: `content.map(` is a real,
//        deliberate array-render call, not a coincidental substring, unlike
//        a bare unstructured `content` search would be). If that finds
//        nothing, the block's own per-item `as="ALIAS"` -- the frame's own
//        declared loop-variable name -- is tried the same way as a `.map(`
//        CALLBACK PARAMETER (`.map((alias`/`.map(alias =>`), restricted to
//        aliases >=5 characters (this pack's own aliases are almost all
//        single letters or `row`/`ch` -- too generic to discriminate safely
//        as a bare callback-parameter name, so this path rarely fires; it
//        exists for the aliases long enough to be genuinely discriminating,
//        e.g. a hypothetical `as="entry"`).
//    A row with no evidence from either tier grades GAP. A row with
//    evidence from either tier grades MATCHED. This is a two-grade ledger
//    (unlike the three-grade conditional-state ledger) because the task
//    this file measures asks only "does the cluster map over a real
//    collection into repeated markup" -- a yes/no question -- not whether a
//    test separately mounts it.
//
// 3. ONE two-sided ratchet (test/frame-repeated-row/ceiling.ts, following
//    test/frame-caption-ledger/ceiling.ts's own idiom so module-
//    reachability's exactly-one-declaration discipline holds for this
//    constant too, the moment a later lane registers it in
//    scripts/exit-predicate.ts -- NOT done by this lane, see
//    docs/design/audit/frame-repeated-row-v12.md).
//
// 4. Positive and negative controls (DEC-099) prove the join over
//    SYNTHETIC fixtures, never a live row's own identity.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { enumerateSourceFiles, labelIsMatched, normalizeSource, stripComments } from "./frame-source-corpus";
import { FRAME_REPEATED_ROW_GAP_CEILING } from "./frame-repeated-row/ceiling";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_DIR = join(REPO_ROOT, "docs", "design");
const APP_SRC_DIR = join(REPO_ROOT, "app", "src");
const SRC_DIR = join(REPO_ROOT, "src");

// ---------------------------------------------------------------------------
// 1. Population: every *.dc.html under docs/design (readdirSync, DEC-180).
// ---------------------------------------------------------------------------

function allDcHtmlFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(DESIGN_DIR, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".dc.html")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface RepeatedRow {
  readonly rel: string;
  readonly line: number;
  readonly expr: string; // e.g. "phoneSlots", "row.cells"
  readonly alias: string; // the block's own `as="..."` value
  readonly count: number; // hint-placeholder-count
  readonly ownText: string; // this block's own text, nested sc-for extents excluded
  readonly frameLine: number | null;
  readonly is390: boolean;
}

/** Line number (1-indexed) of the offset into `content`. */
function lineOf(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (content[i] === "\n") line++;
  return line;
}

/** Walks `content` from `openEnd` (just past the opening `<sc-for ...>`) to
 * find the matching `</sc-for>`, tracking nested `<sc-for` opens so a
 * nested block's own close never terminates the outer one early (Agenda's
 * `grid` wraps `row.cells`; Review's `c.optionRows` wraps `c.scale`). */
function matchScForClose(content: string, openEnd: number): { innerEnd: number; afterClose: number } {
  let depth = 1;
  let i = openEnd;
  while (i < content.length) {
    const nextOpen = content.indexOf("<sc-for", i);
    const nextClose = content.indexOf("</sc-for>", i);
    if (nextClose === -1) throw new Error("unterminated <sc-for> block");
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 7;
      continue;
    }
    depth--;
    if (depth === 0) return { innerEnd: nextClose, afterClose: nextClose + 9 };
    i = nextClose + 9;
  }
  throw new Error("unterminated <sc-for> block");
}

/** This block's own literal text runs (>=6 chars), EXCLUDING any nested
 * `<sc-for>...</sc-for>` extent's text -- a nested row's copy belongs to
 * that row, not its wrapper. Strips tags and `{{ ... }}` mustaches first. */
function ownLiterals(inner: string): string[] {
  let scrubbed = inner;
  for (;;) {
    const nestedOpenTag = /<sc-for\b[^>]*>/.exec(scrubbed);
    if (!nestedOpenTag) break;
    const start = nestedOpenTag.index;
    const { afterClose } = matchScForClose(scrubbed, start + nestedOpenTag[0].length);
    scrubbed = scrubbed.slice(0, start) + " ".repeat(afterClose - start) + scrubbed.slice(afterClose);
  }
  const noTags = scrubbed.replace(/<[^>]*>/g, " ");
  const noMustache = noTags.replace(/\{\{[^}]*\}\}/g, " ");
  const candidates = noMustache
    .split(/\s{2,}|\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 6 && /[A-Za-z]{3,}/.test(s));
  return [...new Set(candidates)];
}

function extractRepeatedRows(file: string): RepeatedRow[] {
  const content = readFileSync(file, "utf-8");
  const rel = relative(REPO_ROOT, file);
  const rows: RepeatedRow[] = [];
  const openRe = /<sc-for\s+list="\{\{\s*([\w.]+)\s*\}\}"\s+as="([a-zA-Z_][a-zA-Z0-9_]*)"\s+hint-placeholder-count="(\d+)"\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(content)) !== null) {
    const expr = m[1]!;
    const alias = m[2]!;
    const count = Number(m[3]);
    const openEnd = m.index + m[0].length;
    const { innerEnd } = matchScForClose(content, openEnd);
    const inner = content.slice(openEnd, innerEnd);
    const line = lineOf(content, m.index);

    const before = content.slice(0, m.index);
    const frameRe = /width:(\d+)px;[^"]*background:#F4F1E8/g;
    let lastFrame: { line: number; width: number } | null = null;
    let fm: RegExpExecArray | null;
    while ((fm = frameRe.exec(before)) !== null) {
      lastFrame = { line: lineOf(before, fm.index), width: Number(fm[1]) };
    }

    rows.push({
      rel,
      line,
      expr,
      alias,
      count,
      ownText: ownLiterals(inner).join(" | "),
      frameLine: lastFrame ? lastFrame.line : null,
      is390: lastFrame ? lastFrame.width === 390 : false,
    });
  }
  return rows;
}

const DC_FILES = allDcHtmlFiles();
const ROWS: RepeatedRow[] = DC_FILES.flatMap(extractRepeatedRows);

// ---------------------------------------------------------------------------
// 2. Grading: against the whole product corpus (app/src/** + src/**).
// ---------------------------------------------------------------------------

const CORPUS_FILES = [...enumerateSourceFiles(APP_SRC_DIR), ...enumerateSourceFiles(SRC_DIR)];
const NORMALIZED_CORPUS = CORPUS_FILES.map((f) => normalizeSource(readFileSync(f, "utf-8")));
const STRIPPED_CORPUS = CORPUS_FILES.map((f) => stripComments(readFileSync(f, "utf-8")));

function lastSegment(expr: string): string {
  const parts = expr.split(".");
  return parts[parts.length - 1]!;
}

// A callback-parameter alias shorter than this is too generic (almost every
// alias in this pack is a single letter or `row`/`ch`) to search safely as a
// bare `.map((alias` pattern -- see the header. Rows this guard excludes
// still have the TIER 1 copy-match and the ident-`.map(` structural path
// open to them.
const MIN_ALIAS_LENGTH = 5;

type Grade = "MATCHED" | "GAP";

interface GradedRow extends RepeatedRow {
  readonly grade: Grade;
  readonly evidence: string | null;
  readonly evidenceTier: "copy" | "ident-map" | "alias-map" | null;
}

function gradeRow(row: RepeatedRow): GradedRow {
  // TIER 1: copy match.
  const literals = row.ownText.length === 0 ? [] : row.ownText.split(" | ");
  for (const lit of literals) {
    if (labelIsMatched(lit, NORMALIZED_CORPUS)) {
      return { ...row, grade: "MATCHED", evidence: lit, evidenceTier: "copy" };
    }
  }

  // TIER 2a: the list expression's own identifier, immediately followed by
  // `.map(` -- a real, deliberate array-render call, not a coincidental
  // substring, so no minimum-length guard is needed here the way sc-if's
  // bare-word search needed one.
  const ident = lastSegment(row.expr);
  const identRe = new RegExp(`\\b${ident}\\s*\\.\\s*map\\s*\\(`);
  if (STRIPPED_CORPUS.some((s) => identRe.test(s))) {
    return { ...row, grade: "MATCHED", evidence: `${ident}.map(`, evidenceTier: "ident-map" };
  }

  // TIER 2b: the frame's own declared per-item alias used as the `.map()`
  // callback's own parameter name -- only for aliases long enough to
  // discriminate safely (MIN_ALIAS_LENGTH).
  if (row.alias.length >= MIN_ALIAS_LENGTH) {
    const aliasRe = new RegExp(`\\.map\\(\\s*\\(?\\s*${row.alias}\\b`);
    if (STRIPPED_CORPUS.some((s) => aliasRe.test(s))) {
      return { ...row, grade: "MATCHED", evidence: `.map((${row.alias}`, evidenceTier: "alias-map" };
    }
  }

  return { ...row, grade: "GAP", evidence: null, evidenceTier: null };
}

const GRADED: GradedRow[] = ROWS.map(gradeRow);
const GAPS = GRADED.filter((r) => r.grade === "GAP");

// ---------------------------------------------------------------------------
// Distinct frames touched (for the vacuous-population tripwire's ">=8
// frames" clause) -- a "frame" here is the dc.html file, since a single
// screen file draws both its desktop and 390 extents and this population's
// own rows do not need finer per-extent frame identity to be gradeable.
// ---------------------------------------------------------------------------

function distinctFrameCount(rows: readonly RepeatedRow[]): number {
  return new Set(rows.map((r) => r.rel)).size;
}

describe("frame repeated-row ledger (DEC-180 wave-40)", () => {
  it("vacuous-population tripwire: exactly 201 sc-for/hint-placeholder-count blocks across 13 docs/design/*.dc.html files, spanning >=8 frames", () => {
    expect(DC_FILES.length).toBe(13);
    expect(ROWS.length).toBe(201);
    expect(distinctFrameCount(ROWS)).toBeGreaterThanOrEqual(8);
  });

  it("every row resolves a frame geometry line", () => {
    for (const r of ROWS) {
      expect(r.frameLine, `${r.rel}:${r.line} (${r.expr}) found no enclosing frame geometry`).not.toBeNull();
    }
  });

  it("every row's hint-placeholder-count is a positive drawn sample size", () => {
    for (const r of ROWS) {
      expect(r.count, `${r.rel}:${r.line} (${r.expr})`).toBeGreaterThan(0);
    }
  });

  describe("graded rows", () => {
    for (const r of GRADED) {
      it(`${r.rel}:${r.line} \`${r.expr}\` (as ${r.alias}, count ${r.count}) grades ${r.grade}`, () => {
        expect(r.grade).toBe(r.grade); // roster print below is the real assertion surface
      });
    }
  });

  it(`GAP_CEILING ratchet: at most ${FRAME_REPEATED_ROW_GAP_CEILING} GAP rows`, () => {
    if (GAPS.length > FRAME_REPEATED_ROW_GAP_CEILING) {
      const roster = GAPS.map((r) => `  - ${r.rel}:${r.line} \`${r.expr}\` (as ${r.alias}, count ${r.count})`).join("\n");
      throw new Error(`${GAPS.length} GAP rows > ceiling ${FRAME_REPEATED_ROW_GAP_CEILING}:\n${roster}`);
    }
    expect(GAPS.length).toBeLessThanOrEqual(FRAME_REPEATED_ROW_GAP_CEILING);
  });

  // Two-sided companion (test/campaign-ratchet-two-sided.scan.test.ts's own
  // discipline): a ratchet must also fail when the measurement falls BELOW
  // its ceiling without the ceiling being lowered in the same commit --
  // otherwise a future lane's fix could silently widen the gap between the
  // ceiling and reality with nothing forcing it down.
  it(`never sits BELOW FRAME_REPEATED_ROW_GAP_CEILING (${FRAME_REPEATED_ROW_GAP_CEILING}) without the ceiling being lowered to match`, () => {
    if (GAPS.length < FRAME_REPEATED_ROW_GAP_CEILING) {
      throw new Error(
        `${GAPS.length} GAP rows, below the ceiling of ${FRAME_REPEATED_ROW_GAP_CEILING}. ` +
          `Lower the ceiling in the same commit:\n  export const FRAME_REPEATED_ROW_GAP_CEILING = ${GAPS.length};`,
      );
    }
    expect(GAPS.length).toBeGreaterThanOrEqual(FRAME_REPEATED_ROW_GAP_CEILING);
  });

  describe("non-vacuity (DEC-099: positive and negative controls over a SYNTHETIC fixture, never a live row's own identity)", () => {
    it("ownLiterals extracts a literal and excludes a nested sc-for extent", () => {
      const inner = ` <div>text before <span>Outer literal text</span>
        <sc-for list="{{ x.y }}" as="z" hint-placeholder-count="2">
          <span>Inner literal text should not leak</span>
        </sc-for>
      </div>`;
      const fixtureRows = extractRepeatedRowsFromFixture(
        `<sc-for list="{{ fixture.outer }}" as="o" hint-placeholder-count="3">${inner}</sc-for>`,
      );
      expect(fixtureRows).toHaveLength(2);
      const outer = fixtureRows.find((r) => r.expr === "fixture.outer")!;
      expect(outer.ownText).toContain("Outer literal text");
      expect(outer.ownText).not.toContain("Inner literal text");
    });

    it("POSITIVE control: a fabricated row whose literal copy IS present in the product corpus grades MATCHED (TIER 1)", () => {
      // "Or paste this into your browser" is real copy in src/mail/shell.ts
      // -- reusing it here proves the positive path of the exact matcher
      // used above, over a fixture EXPRESSION rather than a real row's
      // identity (DEC-099/DEC-967).
      const row: RepeatedRow = {
        rel: "docs/design/Chautauqua Comms.dc.html",
        line: 1,
        expr: "fixture.copyProbeList",
        alias: "zz",
        count: 1,
        ownText: "Or paste this into your browser",
        frameLine: 1,
        is390: false,
      };
      expect(gradeRow(row).grade).toBe("MATCHED");
    });

    it("POSITIVE control: a fabricated row with no literal copy but a real `ident.map(` in the corpus grades MATCHED (TIER 2a)", () => {
      // `rooms.map(` is real, structural evidence in app/src/pages/agenda --
      // proves the ident-`.map(` path over a fixture expression.
      const row: RepeatedRow = {
        rel: "docs/design/Chautauqua Agenda.dc.html",
        line: 1,
        expr: "fixture.rooms",
        alias: "zz",
        count: 1,
        ownText: "",
        frameLine: 1,
        is390: false,
      };
      const graded = gradeRow(row);
      expect(graded.grade).toBe("MATCHED");
      expect(graded.evidenceTier).toBe("ident-map");
    });

    it("NEGATIVE control: a fully fabricated row with no matching literal, identifier or alias anywhere grades GAP", () => {
      const row: RepeatedRow = {
        rel: "docs/design/Chautauqua Comms.dc.html",
        line: 1,
        expr: "fixture.totallyUnbuiltRepeatedPopulationZzqxw",
        alias: "zzqxwAliasNeverUsed",
        count: 1,
        ownText: "Zzqxw Nonexistent Fixture Copy Zzqxw",
        frameLine: 1,
        is390: false,
      };
      expect(gradeRow(row).grade).toBe("GAP");
    });
  });
});

/** Test-only helper mirroring extractRepeatedRows but over an in-memory
 * fixture string (never a real dc.html row identity, DEC-099/DEC-967). */
function extractRepeatedRowsFromFixture(html: string): RepeatedRow[] {
  const rows: RepeatedRow[] = [];
  const openRe = /<sc-for\s+list="\{\{\s*([\w.]+)\s*\}\}"\s+as="([a-zA-Z_][a-zA-Z0-9_]*)"\s+hint-placeholder-count="(\d+)"\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const expr = m[1]!;
    const alias = m[2]!;
    const count = Number(m[3]);
    const openEnd = m.index + m[0].length;
    const { innerEnd } = matchScForClose(html, openEnd);
    const inner = html.slice(openEnd, innerEnd);
    rows.push({
      rel: "fixture",
      line: lineOf(html, m.index),
      expr,
      alias,
      count,
      ownText: ownLiterals(inner).join(" | "),
      frameLine: null,
      is390: false,
    });
  }
  return rows;
}
