// User-filed (gate-12 era): the Overview "New submission" primary — a router
// <Link> — blended its label into the fill on hover. Root cause class: the
// global `a:hover { color: var(--chq-brand-hover) }` (specificity 0,1,1)
// beats a filled tier's BASE color (0,1,0) while hovered, so any filled
// control rendered as an anchor repaints its label link-olive on top of its
// own (darkening) fill — dark-on-dark. <button> elements are immune, which
// is why button-element probes kept passing.
//
// INVARIANT: every class whose base rule declares BOTH a background fill and
// a label color, and which has a :hover rule, must RE-ASSERT `color` inside
// that :hover rule — `.X:hover { color: ... }` is (0,2,0) and beats a:hover
// for anchors, and is a harmless no-op for buttons. B8's tier table says the
// same thing in design terms: on hover the FILL darkens, the label never
// repaints.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "src");

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...cssFiles(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Parse rule blocks: selector -> concatenated declarations (a selector may
// appear in several blocks, incl. inside @media — concatenate them all).
function ruleMap(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    for (const rawSel of m[1].split(",")) {
      const sel = rawSel.trim();
      if (!sel) continue;
      map.set(sel, (map.get(sel) ?? "") + ";" + m[2]);
    }
  }
  return map;
}

describe("filled-control hover keeps its label (a:hover-proof)", () => {
  const files = cssFiles(APP);
  it("finds the stylesheet population (vacuous-scan tripwire)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("every filled class with a :hover rule re-asserts color in it", () => {
    const violations: string[] = [];
    for (const file of files) {
      const css = stripComments(readFileSync(file, "utf8"));
      const rules = ruleMap(css);
      // Filled classes: base selector is a single class whose declarations
      // include BOTH background(+-color) and color.
      for (const [sel, body] of rules) {
        const cls = /^\.([A-Za-z0-9_-]+)$/.exec(sel)?.[1];
        if (!cls) continue;
        const hasFill = /background(?:-color)?\s*:/.test(body);
        const hasLabel = /[^-]color\s*:|^;?\s*color\s*:/m.test(body.replace(/border-color|background-color|outline-color|text-decoration-color/g, ""));
        if (!hasFill || !hasLabel) continue;
        // Collect this class's :hover blocks (plain and compound).
        let hoverBody = "";
        for (const [hsel, hbody] of rules) {
          if (hsel.startsWith(`.${cls}:hover`) || hsel === `.${cls}:hover`) hoverBody += hbody;
        }
        if (!hoverBody) continue; // no hover styling at all — inert on hover, a:hover can still bite
        const hoverAsserts = /(^|;)\s*color\s*:/.test(
          hoverBody.replace(/border-color|background-color|outline-color|text-decoration-color/g, ""),
        );
        if (!hoverAsserts) {
          violations.push(`${file.split("/app/src/")[1]} .${cls}:hover lacks a color re-assert`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
