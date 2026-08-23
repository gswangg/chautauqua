// DEC-393 wave-45 (task w45-f): ONE token, ONE receipt, ONE sheet.
//
// src/routes/portal/portal.css.ts's phone-only max-width block declared
// `.chq-portal-file-link {}` TWICE -- once at (then-)line 1349 under a
// `tap-floor-exempt: inline-in-prose -- DEC-393 wave-38 amendment` comment,
// and again ~30 lines later under a second, near-identical
// `tap-floor-exempt:` comment -- because two wave-38 lanes landed the same
// receipt and neither could see the other. `hasExemptionForToken`-shaped
// instruments ask "is there a receipt for this token", a question two
// receipts answer as well as one, so nothing caught it. This scan closes
// the shape:
//
//   (i)  a single `chq-` class TOKEN carrying two or more
//        `tap-floor-exempt:` receipt comments (each immediately followed
//        by that token's empty-body rule, the house idiom) within one
//        sheet;
//   (ii) one selector declared twice with an IDENTICAL EMPTY body within
//        one sheet, regardless of whether either copy carries a receipt
//        comment -- a defensive net for the same duplicate-declaration
//        shape without the receipt-comment idiom.
//
// Driven off `ssrCssSources()` (test/helpers/ssr-css-sources.ts), the
// DERIVED population of every SSR `*_CSS` module under src/ -- never a
// hand-listed file set (DEC-808) -- so a new sheet is swept automatically.
import { describe, expect, it } from "vitest";
import { DEC_393 } from "../src/decisions";
import { ssrCssSources } from "./helpers/ssr-css-sources";
import { stripCssComments } from "./helpers/strip-css-comments";

/** Finds every `chq-` class token that carries two or more
 * `tap-floor-exempt:` receipt comments, each immediately followed (across
 * blank lines allowed, matching the house idiom) by that token's
 * empty-body rule `.token {}`, within one sheet's RAW (unstripped) source
 * -- the receipt comment itself is the thing being counted, so comments
 * must stay visible. Returns `file:line` strings, one per DUPLICATE
 * occurrence (i.e. every occurrence past the first for a given token). */
function findDuplicateExemptionReceipts(rel: string, src: string): string[] {
  const RECEIPT_RE = /\/\*\s*tap-floor-exempt:[\s\S]*?\*\/\s*\r?\n\s*\.([a-zA-Z0-9_-]+)\s*\{\}/g;
  const seen = new Map<string, number>();
  const violations: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = RECEIPT_RE.exec(src))) {
    const token = m[1] as string;
    const line = src.slice(0, m.index).split("\n").length;
    const count = (seen.get(token) ?? 0) + 1;
    seen.set(token, count);
    if (count >= 2) violations.push(`${rel}:${line}`);
  }
  return violations;
}

/** Finds every selector declared twice (or more) with an IDENTICAL EMPTY
 * body (`.token {}`, whitespace-insensitive) within one sheet's
 * comment-stripped source. `stripCssComments` preserves line count, so
 * lines computed here agree with the original file. Returns `file:line`
 * strings, one per DUPLICATE occurrence. */
function findDuplicateEmptySelectors(rel: string, src: string): string[] {
  const stripped = stripCssComments(src);
  const EMPTY_RULE_RE = /\.([a-zA-Z0-9_-]+)\s*\{\s*\}/g;
  const seen = new Map<string, number>();
  const violations: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = EMPTY_RULE_RE.exec(stripped))) {
    const token = m[1] as string;
    const line = stripped.slice(0, m.index).split("\n").length;
    const count = (seen.get(token) ?? 0) + 1;
    seen.set(token, count);
    if (count >= 2) violations.push(`${rel}:${line}`);
  }
  return violations;
}

/** DEC-393 wave-45 (task w45-f): the duplicate `.chq-portal-file-link {}`
 * receipt repaired on this branch is the only known offender; the honest
 * post-repair count across the whole SSR population is 0 (DEC-967: a
 * ceiling is measured by running the scan, never invented). */
export const SSR_DUPLICATE_EXEMPTION_RECEIPT_CEILING = 0;

/** DEC-393 wave-45 (task w45-f): sibling ceiling for clause (ii)'s broader,
 * receipt-comment-independent duplicate-empty-selector check. Measured 0
 * across the whole SSR population post-repair. */
export const SSR_DUPLICATE_EMPTY_SELECTOR_CEILING = 0;

describe(`SSR CSS modules never ship a duplicate exemption receipt for one token (${DEC_393})`, () => {
  const sources = ssrCssSources();

  it("swept a real population, not an empty or truncated one (vacuous-population tripwire)", () => {
    expect(sources.length).toBeGreaterThanOrEqual(14);
  });

  it("DEC-393 is a non-empty grounding string (compile-checked dependency, DEC-069)", () => {
    expect(DEC_393.length).toBeGreaterThan(0);
  });

  it("positive control (clause i): a token with two tap-floor-exempt receipts in one sheet IS flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  @media (max-width: 700px) {
    /* tap-floor-exempt: inline-in-prose -- first receipt */
    .chq-fake {}

    /* tap-floor-exempt: inline-in-prose -- second, duplicate receipt */
    .chq-fake {}
  }
\`;
`;
    const violations = findDuplicateExemptionReceipts("synthetic.css.ts", synthetic);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/^synthetic\.css\.ts:\d+$/);
  });

  it("negative control (clause i): a token with exactly one tap-floor-exempt receipt is NOT flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  @media (max-width: 700px) {
    /* tap-floor-exempt: inline-in-prose -- the only receipt */
    .chq-fake {}
  }
\`;
`;
    expect(findDuplicateExemptionReceipts("synthetic.css.ts", synthetic)).toEqual([]);
  });

  it("negative control (clause i): two DIFFERENT tokens, each with one receipt, are NOT flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  @media (max-width: 700px) {
    /* tap-floor-exempt: inline-in-prose -- token A */
    .chq-fake-a {}

    /* tap-floor-exempt: inline-in-prose -- token B */
    .chq-fake-b {}
  }
\`;
`;
    expect(findDuplicateExemptionReceipts("synthetic.css.ts", synthetic)).toEqual([]);
  });

  it("positive control (clause ii): one selector declared twice with an identical empty body IS flagged, even with no receipt comment", () => {
    const synthetic = `
export const FAKE_CSS = \`
  @media (max-width: 700px) {
    .chq-fake {}

    .chq-fake {}
  }
\`;
`;
    const violations = findDuplicateEmptySelectors("synthetic.css.ts", synthetic);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/^synthetic\.css\.ts:\d+$/);
  });

  it("negative control (clause ii): one selector declared once with an empty body is NOT flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  @media (max-width: 700px) {
    .chq-fake {}
  }
\`;
`;
    expect(findDuplicateEmptySelectors("synthetic.css.ts", synthetic)).toEqual([]);
  });

  it("negative control (clause ii): a selector declared twice with DIFFERENT (non-empty) bodies is NOT flagged -- clause (ii) is about identical EMPTY bodies only", () => {
    const synthetic = `
export const FAKE_CSS = \`
  .chq-fake {
    color: red;
  }
  @media (max-width: 700px) {
    .chq-fake {
      color: blue;
    }
  }
\`;
`;
    expect(findDuplicateEmptySelectors("synthetic.css.ts", synthetic)).toEqual([]);
  });

  it("the real portal sheet no longer carries the wave-38 duplicate .chq-portal-file-link receipt (repaired this wave)", () => {
    const portal = sources.find((s) => s.path === "src/routes/portal/portal.css.ts");
    expect(portal, "src/routes/portal/portal.css.ts must be in the swept SSR population").toBeDefined();
    expect(findDuplicateExemptionReceipts(portal!.path, portal!.text)).toEqual([]);
    expect(findDuplicateEmptySelectors(portal!.path, portal!.text)).toEqual([]);
  });

  for (const { path, text } of sources) {
    it(`${path}: no chq- token carries two or more tap-floor-exempt receipts in this sheet`, () => {
      const violations = findDuplicateExemptionReceipts(path, text);
      expect(
        violations,
        `duplicate tap-floor-exempt receipt(s) found at: ${violations.join(", ")}`,
      ).toEqual([]);
    });

    it(`${path}: no selector is declared twice with an identical empty body in this sheet`, () => {
      const violations = findDuplicateEmptySelectors(path, text);
      expect(
        violations,
        `duplicate empty-body selector(s) found at: ${violations.join(", ")}`,
      ).toEqual([]);
    });
  }

  it(`whole-population duplicate-receipt count stays at its ceiling (${SSR_DUPLICATE_EXEMPTION_RECEIPT_CEILING})`, () => {
    const all = sources.flatMap(({ path, text }) => findDuplicateExemptionReceipts(path, text));
    expect(all, `offenders: ${all.join(", ")}`).toHaveLength(SSR_DUPLICATE_EXEMPTION_RECEIPT_CEILING);
  });

  it(`whole-population duplicate-empty-selector count stays at its ceiling (${SSR_DUPLICATE_EMPTY_SELECTOR_CEILING})`, () => {
    const all = sources.flatMap(({ path, text }) => findDuplicateEmptySelectors(path, text));
    expect(all, `offenders: ${all.join(", ")}`).toHaveLength(SSR_DUPLICATE_EMPTY_SELECTOR_CEILING);
  });
});
