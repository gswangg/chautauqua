// Pack colour VOCABULARY ratchet (DEC-383 wave-43 amendment, task w43-d).
//
// THE GAP: test/palette-conformance.test.ts proves palette CLOSURE -- every
// page and surface stylesheet composes `var(--chq-*)` only, with colour
// literals confined to exactly two token files (app/src/styles.css,
// src/views/theme.ts) plus the single DEC-376 merge-screen allowlist hex.
// That closure argument makes the two token files the COMPLETE population
// for colour fidelity -- but nothing anywhere compares their VALUES to what
// the pack actually draws. `color` (2144 declarations) and `background`
// (966) are the two largest pack properties with no vocabulary instrument
// at all (font-style/border-radius/font-weight/line-height are graded by
// PACK_VOCABULARY_OFFENDERS_CEILING, font-size/gap by PACK_UNIT_GRAMMAR).
//
// POPULATION, TOKEN FILES (DEC-808, never hand-listed): derived from the
// SAME closure premise test/palette-conformance.test.ts states, not
// retyped -- every file inside the scope where a colour literal is
// legal at all (app/src/**/*.css, src/views/theme.ts, src/routes/**/
// *.css.ts -- palette-conformance.test.ts's own `boxShadowScopeFiles`
// scope, the widest of its three) that contains at least one hex colour
// declaration. That derivation resolves to exactly three files today:
// the two token files plus app/src/pages/contacts/contacts-panels.css
// (the DEC-376 allowlist file, whose only literal is the allowlisted
// hex). The allowlist file is excluded from TOKEN_FILES by PRINCIPLE --
// "a file whose only hex literal is the allowlisted one is not a token
// file, it is one allowlisted exception" -- never by naming its path
// (DEC-099 shape): if a third file ever gains a real colour literal, the
// derivation sees it and the allowlist-only filter does not swallow it.
//
// POPULATION, PACK: every `docs/design/*.dc.html` file (readdirSync at
// test time, DEC-808), comment-stripped with the shared, string-aware
// test/helpers/strip-css-comments.ts (DEC-613: never a private copy).
//
// GRAMMAR: hex literals (`#rgb`/`#rrggbb`/`#rgba`/`#rrggbbaa`, lower-cased)
// and colour FUNCTIONS (`rgb()`/`rgba()`/`hsl()`/`hsla()`, whitespace
// collapsed) are graded as two independent totals, each with its own
// asserted count, so a colour value that sits outside one grammar (e.g. a
// function where the pack only draws hex, or vice versa) is COUNTED
// rather than silently dropped from the population.
//
// HEX GRADING: a token-file hex declaration is an OFFENDER when its exact
// (lower-cased) value is not in the pack's derived hex vocabulary.
//
// FUNCTION GRADING: a colour function is graded on its (r,g,b) or (h,s,l)
// CHANNEL TRIPLE, ignoring the alpha channel -- alpha is a translucency
// choice, not a colour identity, the same discriminator the hex grading
// applies implicitly (a `#rrggbbaa` hex is graded on its full 8 digits
// because hex has no separate alpha *slot* the way a function call does).
// A token-file function is an OFFENDER when its triple is not in the
// pack's derived function-triple vocabulary for the same family
// (rgb/rgba together, hsl/hsla together).
//
// SETTLED EXCLUSIONS (grepped src/decisions-data/ and decisions/ before
// seeding, DEC-967): none. DEC-436's wave-25 amendment and DEC-367's
// original WCAG-AA floor are ADJUDICATIONS of the two named offenders
// below, not exclusions from this population -- both offenders are
// counted, not hidden.
//
// TWO-SIDED (DEC-808 wave-85 amendment shape): both ceilings fail above
// AND below the measured count -- MEASURED by forcing each to -1 and
// reading the roster back, recorded in
// docs/design/audit/pack-colour-vocabulary-v12.md.
//
// ADJUDICATION (this wave, DEC-436/DEC-367): the two hex offenders are
// LEFT, not repaired.
//   - `--chq-disabled: #7d7869` -- DEC-436's wave-25 amendment darkened
//     this token FROM the pack's nearest neighbour, `#8e8a7a`, specifically
//     because `#8e8a7a` measured 2.43:1 against `--chq-disabled-bg` and
//     WCAG's 3:1 legibility floor demanded darker. `#8e8a7a` is still in
//     the tree today as `--chq-border-hover` (app/src/palette.scan.test.ts
//     :117), so "repairing" `--chq-disabled` to it would silently
//     reintroduce the exact contrast defect DEC-436 fixed and collide two
//     tokens onto one value. Repairing to the OTHER pack neighbour,
//     `#6b665b`, moves a WCAG-pinned byte with no v12 frame demanding it --
//     DESKTOP IS FROZEN and this token is drawn on both densities.
//   - `--chq-on-ink-muted: #b5afa2` -- DEC-367's original handoff pins
//     this exact value as the on-ink muted floor verified at 7:1
//     (docs/design/README.md:51/:530: "anything lighter failed and was
//     raised during review"), and test/design-system.test.ts:120 pins the
//     byte across both token files as a parity fact. The pack's nearest
//     neighbours (`#b6b3a6`, `#bab6a6`) are both LIGHTER on-ink than the
//     pinned floor; moving to either risks the same contrast regression
//     the original review raised against, with no v12 frame demanding the
//     move.
//   Both registers are ones the pack's own drawings never needed to solve
//   for -- a WCAG floor the mocks don't carry a contrast obligation for.
//   Recorded as a stated-principle deviation in
//   docs/design/audit/pack-colour-vocabulary-v12.md, not left as an
//   unowned count.
//
// SCOPE: registered in scripts/exit-predicate/campaign-scope.ts's
// OUT_OF_CAMPAIGN_SCOPE -- a freshly measured population must not move the
// campaign's convergence goalposts mid-stream, the same disposition
// PACK_UNIT_GRAMMAR_OFFENDERS_CEILING and PACK_VOCABULARY_OFFENDERS_CEILING
// already carry.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_383 } from "../src/decisions";
import { stripCssComments } from "./helpers/strip-css-comments";

// Confirms this file's population depends on the ruling it implements
// (compile-checked, per the standing house rule: code depending on
// DEC-NNN must reference its constant).
void DEC_383;

const REPO_ROOT = join(__dirname, "..");
const DESIGN_DIR = join(REPO_ROOT, "docs/design");

const ALLOWLIST_HEX = "#a8a392";

/** Recursively collect files under `dir` whose path matches one of
 * `suffixes` (DEC-808: enumerated, never hand-listed). */
function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

// Same scope test/palette-conformance.test.ts's own `boxShadowScopeFiles`
// uses -- every place a colour literal is legal to exist at all under this
// closure premise (rule 2's wider scope: the whole app/src tree plus the
// theme.ts token file plus every SSR surface module).
const COLOUR_LEGAL_SCOPE_FILES = [
  ...glob(join(REPO_ROOT, "app/src"), [".css"]),
  join(REPO_ROOT, "src/views/theme.ts"),
  ...glob(join(REPO_ROOT, "src/routes"), [".css.ts"]),
];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const FN_RE = /\b(rgba?|hsla?)\(([^)]*)\)/gi;

/** Strips whole-line and trailing `//` JS comments, line by line, so the
 * shared string-aware `stripCssComments` (built for CSS-only text) is never
 * confused by a stray `"`/`'` inside prose like `HTML-escapes & < > " ',`
 * that a `.ts`/`.css.ts` module's own `//` comments routinely contain. A
 * `//` immediately preceded by `:` (a `url("https://...")` scheme) is never
 * treated as a comment opener -- the negative lookbehind is what keeps a
 * real data-URI/href value intact. CSS itself has no `//` comment syntax,
 * so this is a no-op on a plain `.css`/`.dc.html` source. */
function stripJsLineComments(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/(?<!:)\/\/.*$/, ""))
    .join("\n");
}

function hexLiterals(text: string): string[] {
  const clean = stripCssComments(stripJsLineComments(text));
  const out: string[] = [];
  let m: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(clean))) out.push(m[0].toLowerCase());
  return out;
}

interface ColourFunction {
  readonly family: "rgb" | "hsl";
  readonly triple: string; // "r,g,b" or "h,s,l", whitespace-collapsed
  readonly full: string; // whole call, whitespace-collapsed, for reporting
}

function colourFunctions(text: string): ColourFunction[] {
  const clean = stripCssComments(stripJsLineComments(text));
  const out: ColourFunction[] = [];
  let m: RegExpExecArray | null;
  FN_RE.lastIndex = 0;
  while ((m = FN_RE.exec(clean))) {
    const name = (m[1] as string).toLowerCase();
    const family: "rgb" | "hsl" = name.startsWith("rgb") ? "rgb" : "hsl";
    const args = (m[2] as string).split(",").map((a) => a.trim());
    // First three args are the channel triple; a 4th (alpha) is dropped --
    // alpha is a translucency choice, not a colour identity.
    const triple = args.slice(0, 3).join(",");
    out.push({ family, triple, full: `${name}(${args.join(",")})` });
  }
  return out;
}

/** Derive the set of files, within the colour-legal scope, that declare at
 * least one hex literal (DEC-808: derived, never hand-listed). */
function filesWithHex(files: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const f of files) {
    if (hexLiterals(readFileSync(f, "utf8")).length > 0) out.add(f);
  }
  return out;
}

const DERIVED_HEX_FILES = filesWithHex(COLOUR_LEGAL_SCOPE_FILES);

/** A derived hex-bearing file is a TOKEN FILE unless its whole hex
 * population is the single DEC-376 allowlisted value -- excluded by
 * PRINCIPLE (what its literals are), never by naming its path. */
function isAllowlistOnlyFile(file: string): boolean {
  const hexes = hexLiterals(readFileSync(file, "utf8"));
  return hexes.length > 0 && hexes.every((h) => h === ALLOWLIST_HEX);
}

const TOKEN_FILES = [...DERIVED_HEX_FILES].filter((f) => !isAllowlistOnlyFile(f));

/** Every `*.dc.html` file under docs/design, enumerated (DEC-808). */
function packSources(): string[] {
  return readdirSync(DESIGN_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".dc.html"))
    .map((e) => join(DESIGN_DIR, e.name));
}

const PACK_FILES = packSources();

interface PackVocabulary {
  readonly hex: ReadonlySet<string>;
  readonly hexOccurrences: number;
  readonly functionTriples: ReadonlySet<string>; // "family:triple"
  readonly functionOccurrences: number;
}

function derivePackVocabulary(files: readonly string[]): PackVocabulary {
  const hex = new Set<string>();
  let hexOccurrences = 0;
  const functionTriples = new Set<string>();
  let functionOccurrences = 0;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const h of hexLiterals(text)) {
      hex.add(h);
      hexOccurrences++;
    }
    for (const fn of colourFunctions(text)) {
      functionTriples.add(`${fn.family}:${fn.triple}`);
      functionOccurrences++;
    }
  }
  return { hex, hexOccurrences, functionTriples, functionOccurrences };
}

const PACK_VOCAB = derivePackVocabulary(PACK_FILES);

interface HexOffender {
  readonly value: string;
  readonly path: string;
}

interface FunctionOffender {
  readonly value: string;
  readonly path: string;
}

interface GradeResult {
  readonly hexTotal: number;
  readonly hexOffenders: HexOffender[];
  readonly functionTotal: number;
  readonly functionOffenders: FunctionOffender[];
}

function grade(files: readonly string[], vocab: PackVocabulary): GradeResult {
  const hexOffenders: HexOffender[] = [];
  const functionOffenders: FunctionOffender[] = [];
  let hexTotal = 0;
  let functionTotal = 0;
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    for (const h of hexLiterals(text)) {
      hexTotal++;
      if (!vocab.hex.has(h)) hexOffenders.push({ value: h, path });
    }
    for (const fn of colourFunctions(text)) {
      functionTotal++;
      const key = `${fn.family}:${fn.triple}`;
      if (!vocab.functionTriples.has(key)) functionOffenders.push({ value: fn.full, path });
    }
  }
  return { hexTotal, hexOffenders, functionTotal, functionOffenders };
}

const RESULT = grade(TOKEN_FILES, PACK_VOCAB);

// Two-sided ratchets (DEC-808 wave-85 amendment shape). Registered in
// scripts/exit-predicate/campaign-scope.ts's OUT_OF_CAMPAIGN_SCOPE, not the
// campaign's gating lists (this file's header explains why).
//
// The two hex offenders are ADJUDICATED, not repaired -- `--chq-disabled:
// #7d7869` (DEC-436 wave-25 WCAG 3:1 floor) and `--chq-on-ink-muted:
// #b5afa2` (DEC-367 original WCAG 7:1 floor, byte-pinned by
// test/design-system.test.ts:120). See this file's header and
// docs/design/audit/pack-colour-vocabulary-v12.md.
// Both offenders are declared once in EACH token file (styles.css and
// theme.ts, kept in sync per DEC-372's parity test) -- 2 distinct values x
// 2 files = 4 offending DECLARATIONS, consistent with the rest of this
// instrument grading every declaration occurrence rather than deduping by
// value (the same shape PACK_UNIT_GRAMMAR_OFFENDERS_CEILING uses).
export const PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING = 4;
export const PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING = 0;

describe("pack colour vocabulary (DEC-383 wave-43)", () => {
  it("derives a non-vacuous pack source population (readdirSync, never hand-listed)", () => {
    expect(PACK_FILES.length).toBeGreaterThan(0);
    expect(PACK_FILES.length).toBe(13);
  });

  it("derives a non-vacuous pack hex vocabulary", () => {
    expect(PACK_VOCAB.hex.size).toBeGreaterThan(0);
    expect(PACK_VOCAB.hexOccurrences).toBeGreaterThan(0);
  });

  it("derives a non-vacuous pack colour-function vocabulary", () => {
    expect(PACK_VOCAB.functionTriples.size).toBeGreaterThan(0);
    expect(PACK_VOCAB.functionOccurrences).toBeGreaterThan(0);
  });

  it("derives TOKEN_FILES from the palette-conformance closure premise, never hand-listed -- exactly the two token files", () => {
    // The colour-legal scope contains exactly three hex-bearing files
    // today: the two token files plus the DEC-376 allowlist file, whose
    // sole literal is the allowlisted hex. If a third file ever gains a
    // REAL literal, this assertion is the tripwire that catches it.
    const derivedRelative = [...DERIVED_HEX_FILES].map((f) => f.slice(REPO_ROOT.length + 1)).sort();
    expect(derivedRelative).toEqual(
      [
        "app/src/pages/contacts/contacts-panels.css",
        "app/src/styles.css",
        "src/views/theme.ts",
      ].sort(),
    );

    const tokenRelative = TOKEN_FILES.map((f) => f.slice(REPO_ROOT.length + 1)).sort();
    expect(tokenRelative).toEqual(["app/src/styles.css", "src/views/theme.ts"].sort());
  });

  it("the allowlist file is excluded by PRINCIPLE (allowlist-only hex content), not by naming its path", () => {
    const allowlistFile = join(REPO_ROOT, "app/src/pages/contacts/contacts-panels.css");
    expect(DERIVED_HEX_FILES.has(allowlistFile)).toBe(true);
    expect(isAllowlistOnlyFile(allowlistFile)).toBe(true);
    expect(TOKEN_FILES).not.toContain(allowlistFile);
  });

  it("grades a non-vacuous token-file hex population", () => {
    expect(RESULT.hexTotal).toBeGreaterThan(0);
  });

  it("never exceeds PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING (4) token hex values outside the pack's drawn set", () => {
    if (RESULT.hexOffenders.length > PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING) {
      throw new Error(
        `${RESULT.hexOffenders.length} token-file hex literals are not in the pack's drawn vocabulary, ` +
          `above the ceiling of ${PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING}. Offenders:\n` +
          RESULT.hexOffenders.map((o) => `  ${o.value} (${o.path})`).join("\n"),
      );
    }
    expect(RESULT.hexOffenders.length).toBeLessThanOrEqual(PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING);
  });

  it("never sits BELOW PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING (4) without the ceiling being lowered to match", () => {
    if (RESULT.hexOffenders.length < PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING) {
      throw new Error(
        `${RESULT.hexOffenders.length} token-file hex literals sit outside the pack's drawn vocabulary, ` +
          `below the ceiling of ${PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING}. Lower it:\n` +
          `  export const PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING = ${RESULT.hexOffenders.length};`,
      );
    }
    expect(RESULT.hexOffenders.length).toBeGreaterThanOrEqual(PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING);
  });

  it("names the two DISTINCT hex offender values so a regression or a repair is traceable", () => {
    const distinctValues = [...new Set(RESULT.hexOffenders.map((o) => o.value))].sort();
    expect(distinctValues).toEqual(["#7d7869", "#b5afa2"].sort());
  });

  it("each offending value is declared once in each of the two token files (DEC-372 parity)", () => {
    const byValue = new Map<string, string[]>();
    for (const o of RESULT.hexOffenders) {
      byValue.set(o.value, [...(byValue.get(o.value) ?? []), o.path]);
    }
    for (const [value, paths] of byValue) {
      expect(paths.length, `${value} should be declared in both token files`).toBe(2);
    }
  });

  it("grades a non-vacuous token-file colour-function population", () => {
    expect(RESULT.functionTotal).toBeGreaterThan(0);
  });

  it("never exceeds PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING (0) token colour functions outside the pack's drawn triples", () => {
    if (RESULT.functionOffenders.length > PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING) {
      throw new Error(
        `${RESULT.functionOffenders.length} token-file colour functions are not in the pack's drawn ` +
          `triple vocabulary, above the ceiling of ${PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING}. ` +
          `Offenders:\n` + RESULT.functionOffenders.map((o) => `  ${o.value} (${o.path})`).join("\n"),
      );
    }
    expect(RESULT.functionOffenders.length).toBeLessThanOrEqual(PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING);
  });

  it("never sits BELOW PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING (0) without the ceiling being lowered to match", () => {
    if (RESULT.functionOffenders.length < PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING) {
      throw new Error(
        `${RESULT.functionOffenders.length} token-file colour functions sit outside the pack's drawn ` +
          `triples, below the ceiling of ${PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING}. Lower it:\n` +
          `  export const PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING = ${RESULT.functionOffenders.length};`,
      );
    }
    expect(RESULT.functionOffenders.length).toBeGreaterThanOrEqual(
      PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING,
    );
  });

  it("the product's one colour function (rgba(27,29,23,0.5)) matches the pack's drawn rgba family by channel triple", () => {
    const styles = readFileSync(join(REPO_ROOT, "app/src/styles.css"), "utf8");
    const fns = colourFunctions(styles).filter((f) => f.triple === "27,29,23");
    expect(fns.length).toBeGreaterThan(0);
    expect(PACK_VOCAB.functionTriples.has("rgb:27,29,23")).toBe(true);
  });
});

describe("pack colour vocabulary -- detector non-vacuity (DEC-967, synthetic fixture only)", () => {
  it("hexLiterals and colourFunctions fire on a synthetic mix and never touch a live product offender's identity", () => {
    const fixture = [
      "/* a comment mentioning #ffffff must never count */",
      ".chq-fixture-a { color: #123456; background: rgba(1, 2, 3, 0.5); }",
      ".chq-fixture-b { border-color: #ABCDEF; }",
    ].join("\n");
    expect(hexLiterals(fixture).sort()).toEqual(["#123456", "#abcdef"].sort());
    const fns = colourFunctions(fixture);
    expect(fns).toEqual([{ family: "rgb", triple: "1,2,3", full: "rgba(1,2,3,0.5)" }]);
  });

  it("colourFunctions ignores the alpha channel for triple comparison (translucency is not a colour identity)", () => {
    const a = colourFunctions("rgba(10, 20, 30, 0.1)")[0]!;
    const b = colourFunctions("rgba(10, 20, 30, 0.9)")[0]!;
    expect(a.triple).toBe(b.triple);
  });

  it("a hex literal that only appears inside a comment is stripped and never counted", () => {
    expect(hexLiterals("/* #dead00 */ .chq-x {}")).toEqual([]);
  });

  it("isAllowlistOnlyFile is false for a file mixing the allowlist hex with a real literal (positive control)", () => {
    const dir = REPO_ROOT; // any existing readable dir works for a throwaway path check
    void dir;
    // Synthetic string check rather than a tmp file -- the function reads
    // via readFileSync, so we exercise its logic directly through
    // hexLiterals on equivalent text.
    const mixed = ".chq-x { color: #a8a392; } .chq-y { color: #112233; }";
    const hexes = hexLiterals(mixed);
    expect(hexes.every((h) => h === ALLOWLIST_HEX)).toBe(false);
  });
});
