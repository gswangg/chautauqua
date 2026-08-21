import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { stripCssComments as stripComments } from "../../../test/helpers/strip-css-comments";

// w6-b: source-order shadowing detector for the page-level stylesheets.
//
// DEC-385 says narrow overrides wide via max-width media queries ONLY --
// but CSS cascade is source-order-sensitive at equal specificity, so a
// `@media (max-width: 700px)` block that is declared ABOVE the top-level
// (unconditional) rule it means to override LOSES: the later,
// unconditional declaration wins on every viewport, including 390. None
// of the existing phone gates (phone-page-scaffold, phone-tap-target.scan,
// phone-block-visibility) read a stylesheet's declaration order, so this
// shadowing shape is invisible to all of them (field guide, wave 6).
//
// This is the same brace-matched detector class used for w6-a (styles.css
// + comms.css/review.css's shared-vocabulary source order), but scoped to
// every stylesheet under app/src/pages, discovered by directory walk --
// never a hand-listed manifest (DEC-180/DEC-367/DEC-808: a hand-listed
// population is not a population).
//
// MERGE NOTE for the merge train (not acted on in this task): v12m-w3-j
// and v12m-w4-j each carry a tree-wide `SHADOWED_CEILING` constant (20 and
// 22) that is two-sided -- it fails if the measured shadow count drops
// without the ceiling dropping too. This task's fix (review.css:
// .chq-review-reviewer-row + .chq-review-summary-grid; contacts-panels.css:
// .chq-contacts-duplicate-group{grid-template-columns},
// .chq-contacts-duplicate-names{white-space},
// .chq-contacts-duplicate-group .chq-contacts-import-actions{flex-wrap})
// removes 5 pairs from whatever tree-wide count those ceilings track. The
// merge commit that lands both those branches and this one must lower
// both ceilings by 5, or they will fail-closed on a real improvement.

const PAGES_ROOT = path.resolve(__dirname, "."); // app/src/pages

interface Decl {
  selector: string;
  prop: string;
  line: number;
  phoneScope: boolean; // declared directly inside a `@media (max-width: 700px)` block
  nested: boolean; // declared inside ANY block nesting (media or otherwise) beyond top level
}

interface ParsedSheet {
  file: string;
  decls: Decl[];
  maxWidthBlocks: number;
}

/**
 * Brace-matched parser. Tracks a stack of open blocks; each selector-level
 * block (prelude not starting with `@`) yields one Decl per
 * `property: value` pair found directly inside it, tagged with whether its
 * immediate parent is a `@media (max-width: 700px)` block, and whether it
 * is nested at all (i.e. not a bare top-level rule).
 */
function parseSheet(file: string, css: string): ParsedSheet {
  const text = stripComments(css);
  const decls: Decl[] = [];
  let maxWidthBlocks = 0;

  type Frame = {
    prelude: string;
    isPhoneMedia: boolean;
    isAtRule: boolean;
    startLine: number;
  };

  const frameStack: Frame[] = [];
  const bufStack: string[] = [""];
  let preludeBuf = "";
  let line = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\n") line++;

    if (ch === "{") {
      const prelude = preludeBuf.trim();
      preludeBuf = "";
      const isAtRule = prelude.startsWith("@");
      const isPhoneMedia =
        isAtRule && /@media[^{]*max-width\s*:\s*700px/.test(prelude);
      if (isAtRule && /max-width\s*:\s*\d/.test(prelude)) {
        maxWidthBlocks++;
      }
      frameStack.push({ prelude, isAtRule, isPhoneMedia, startLine: line });
      bufStack.push("");
      continue;
    }

    if (ch === "}") {
      const content = bufStack.pop() ?? "";
      const frame = frameStack.pop();
      if (frame && !frame.isAtRule) {
        // This is a selector-level rule block: parse its direct
        // declarations. Immediate parent (if any) tells us phoneScope.
        const parent = frameStack[frameStack.length - 1];
        const phoneScope = !!parent && parent.isPhoneMedia;
        const nested = frameStack.length > 0; // anything but a bare root rule
        let declLine = frame.startLine;
        for (const rawLine of content.split("\n")) {
          const parts = rawLine.split(";");
          for (const part of parts) {
            const m = /^\s*([a-zA-Z-]+)\s*:/.exec(part);
            const propName = m?.[1];
            if (propName) {
              decls.push({
                selector: frame.prelude,
                prop: propName.toLowerCase(),
                line: declLine,
                phoneScope,
                nested,
              });
            }
          }
          declLine++;
        }
      }
      preludeBuf = "";
      continue;
    }

    // Regular character: always feeds the "next selector" prelude buffer
    // (which must accumulate across ANY nesting depth so a rule declared
    // inside a `@media` block gets its own selector text captured), and
    // also feeds the current frame's raw content buffer, if any is open.
    preludeBuf += ch;
    if (frameStack.length > 0) {
      const top = bufStack.length - 1;
      bufStack[top] = (bufStack[top] ?? "") + ch;
    }
  }

  return { file, decls, maxWidthBlocks };
}

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

interface Finding {
  file: string;
  selector: string;
  prop: string;
  phoneLine: number;
  shadowLine: number;
}

function findShadowedPhoneOverrides(sheet: ParsedSheet): Finding[] {
  // Cascade rule at equal specificity: for a given (selector, prop), the
  // declaration that appears LAST in source order among the ones
  // applicable at 390px width wins. Applicable-at-390 declarations are:
  // every unconditional (non-nested) top-level rule, and every rule
  // declared directly inside a `@media (max-width: 700px)` block. So a
  // phone override is only genuinely in effect at 390px if the LAST
  // applicable declaration for its (selector, prop) is itself
  // phone-scoped -- appending a later phone-scoped restatement (the fix
  // pattern this task uses) makes it win again even though the original,
  // earlier phone-scoped declaration is still sitting there, still
  // literally shadowed by the rule between it and the appended fix.
  const applicable = sheet.decls.filter((d) => !d.nested || d.phoneScope);

  const byKey = new Map<string, Decl[]>();
  for (const d of applicable) {
    const key = `${d.selector}\u0000${d.prop}`;
    const list = byKey.get(key) ?? [];
    list.push(d);
    byKey.set(key, list);
  }

  const findings: Finding[] = [];
  for (const list of byKey.values()) {
    const hasPhoneEntry = list.some((d) => d.phoneScope);
    if (!hasPhoneEntry) continue;
    const winner = list.reduce((a, b) => (b.line > a.line ? b : a));
    if (!winner.phoneScope) {
      const lastPhone = list
        .filter((d) => d.phoneScope)
        .reduce((a, b) => (b.line > a.line ? b : a));
      findings.push({
        file: sheet.file,
        selector: lastPhone.selector,
        prop: lastPhone.prop,
        phoneLine: lastPhone.line,
        shadowLine: winner.line,
      });
    }
  }
  return findings;
}

describe("page-sheet phone source order", () => {
  const cssFiles = listCssFiles(PAGES_ROOT);
  const sheets = cssFiles.map((f) => parseSheet(f, readFileSync(f, "utf8")));

  it("parsed a real population of page stylesheets and max-width blocks (vacuous-population tripwire)", () => {
    expect(sheets.length).toBeGreaterThanOrEqual(10);
    const totalMaxWidthBlocks = sheets.reduce(
      (sum, s) => sum + s.maxWidthBlocks,
      0,
    );
    expect(totalMaxWidthBlocks).toBeGreaterThanOrEqual(8);
  });

  it("has zero phone overrides shadowed by a later unconditional rule", () => {
    const allFindings = sheets.flatMap(findShadowedPhoneOverrides);
    if (allFindings.length > 0) {
      const report = allFindings
        .map(
          (f) =>
            `${path.relative(PAGES_ROOT, f.file)} — ${f.selector} {${f.prop}}, phone line ${f.phoneLine} shadowed by line ${f.shadowLine}`,
        )
        .join("\n");
      throw new Error(
        `Found ${allFindings.length} phone override(s) shadowed by a later unconditional rule:\n${report}`,
      );
    }
    expect(allFindings).toHaveLength(0);
  });
});
