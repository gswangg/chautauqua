// DEC-180/DEC-996 wave-35 amendment: pure unit tests over
// scripts/render-sweep.ts's exported pure helpers only -- no playwright, no
// live gate, no wrangler (this file must never take a dependency on the
// playwright package, and must never spawn a process). NOTE: that sentence
// deliberately does NOT spell the package name as a quoted module specifier
// -- test/test-tiers.test.ts derives FAST/SLOW tier membership by regexing
// import specifiers out of this file's RAW source, comments included, so
// the phrase `import "<slow package>"` written in prose here would tier this
// node-only file as SLOW and redden that check. Three things this wave's fix
// does, three things this file checks:
//   (1) the BLOCKING public mobile pass's control selector swap --
//       MOBILE_CONTROL_SELECTOR (the hand-listed six-selector population)
//       is retired from scripts/render-sweep.ts entirely, and the public
//       mobile-pass call site hands INTERACTIVE_CONTROL_SELECTOR for
//       controlSelector -- checked as a source scan (byte-identical idiom to
//       other scan tests in this tree), since the selector actually used at
//       runtime is an argument to a playwright-only function this file must
//       not call.
//   (2) describeInteractiveElement's selector-shape algorithm: a classed
//       element is described exactly as before; a classless element prints
//       its nearest classed ancestor (`label.chq-cfp-option > input`).
//   (3) deriveAncestorWrapperExemptTokens's derived wrapper idiom: positive
//       control (an ancestor `chq-` class whose own CSS rule carries
//       min-height >= 44px is EXEMPT) and negative controls (a non-`chq-`
//       ancestor class, a `chq-` ancestor whose rule has no min-height or a
//       sub-44px one, and an offender line with no " > " ancestor compound
//       at all) over synthetic CSS text -- never against real repo files.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEC_180, DEC_996 } from "../src/decisions";
import {
  deriveAncestorWrapperExemptTokens,
  describeInteractiveElement,
  type ElementDescriptor,
} from "../scripts/render-sweep";

void DEC_180; // Part 1/2: the hand-listed MOBILE_CONTROL_SELECTOR is retired and its vacuity floor is a falling defect count
void DEC_996; // Part 3: the derived ancestor label-wrapper idiom lets the classifier reach a classless element's wrapper receipt

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const RENDER_SWEEP_SOURCE = readFileSync(join(REPO_ROOT, "scripts", "render-sweep.ts"), "utf8");

describe("render-sweep public gate (DEC-180/DEC-996 wave-35 amendment)", () => {
  describe("Part 1: the hand-listed MOBILE_CONTROL_SELECTOR is retired", () => {
    it("scripts/render-sweep.ts no longer declares a MOBILE_CONTROL_SELECTOR constant", () => {
      expect(RENDER_SWEEP_SOURCE).not.toMatch(/const MOBILE_CONTROL_SELECTOR/);
    });

    it("the public mobile-pass call site hands INTERACTIVE_CONTROL_SELECTOR as controlSelector", () => {
      // The public pass's own visitMobileRoute call -- distinguished from the
      // admin pass's call (which already passed INTERACTIVE_CONTROL_SELECTOR
      // before this wave, per w7-dd) by its surrounding
      // PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING argument, unique to that call.
      const callSiteMatch = RENDER_SWEEP_SOURCE.match(
        /await visitMobileRoute\(\s*context,\s*baseUrl,\s*entry,\s*([A-Za-z_]+),\s*fontFloorResults,\s*([A-Za-z_]+),\s*PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING,\s*\)/,
      );
      expect(callSiteMatch, "could not find the public mobile pass's visitMobileRoute call site").not.toBeNull();
      expect(callSiteMatch?.[1]).toBe("INTERACTIVE_CONTROL_SELECTOR");
      expect(callSiteMatch?.[2]).toBe("INTERACTIVE_CONTROL_SELECTOR");
    });

    it("visitMobileRoute's controlSelector parameter defaults to INTERACTIVE_CONTROL_SELECTOR, not a hand-listed constant", () => {
      expect(RENDER_SWEEP_SOURCE).toMatch(/controlSelector: string = INTERACTIVE_CONTROL_SELECTOR/);
    });
  });

  describe("Part 2: the vacuity floor is documented as a falling defect count", () => {
    it("render-sweep.ts's vacuity-row comment states the DEC-180 wave-35 falling-defect framing", () => {
      expect(RENDER_SWEEP_SOURCE).toMatch(/defect count that must fall to 0/);
    });
  });

  describe("Part 3: describeInteractiveElement selector-shape", () => {
    const input: ElementDescriptor = { tag: "input", classes: [] };

    it("a classed element is described exactly as before (own tag + classes, no ancestor walk)", () => {
      const button: ElementDescriptor = { tag: "button", classes: ["chq-btn", "chq-btn-primary"] };
      const ancestors: ElementDescriptor[] = [{ tag: "form", classes: ["chq-cfp-fieldset"] }];
      expect(describeInteractiveElement(button, ancestors)).toBe("button.chq-btn.chq-btn-primary");
    });

    it("a classless element prints its nearest classed ancestor as an ancestor compound", () => {
      const ancestors: ElementDescriptor[] = [
        { tag: "span", classes: [] },
        { tag: "label", classes: ["chq-cfp-option"] },
        { tag: "fieldset", classes: ["chq-cfp-fieldset"] },
      ];
      expect(describeInteractiveElement(input, ancestors)).toBe("label.chq-cfp-option > input");
    });

    it("a classless element with no classed ancestor at all falls back to its own (classless) tag", () => {
      const ancestors: ElementDescriptor[] = [
        { tag: "span", classes: [] },
        { tag: "div", classes: [] },
      ];
      expect(describeInteractiveElement(input, ancestors)).toBe("input");
    });

    it("stops at the NEAREST classed ancestor, never a farther one", () => {
      const ancestors: ElementDescriptor[] = [
        { tag: "label", classes: ["chq-cfp-option"] },
        { tag: "fieldset", classes: ["chq-cfp-fieldset"] },
      ];
      expect(describeInteractiveElement(input, ancestors)).toBe("label.chq-cfp-option > input");
    });
  });

  describe("Part 3: deriveAncestorWrapperExemptTokens derived wrapper idiom", () => {
    const wrapperCss = `
      .chq-cfp-option {
        display: flex;
        align-items: center;
        min-height: 46px;
        padding: 0 14px;
      }
      .chq-cfp-option.chq-cfp-pill { width: auto; border-radius: 99px; }
      .chq-no-floor-wrap { display: flex; padding: 4px; }
      .chq-short-wrap { display: flex; min-height: 30px; }
    `;

    it("POSITIVE: an ancestor chq- class whose own solitary CSS rule carries min-height >= 44px is EXEMPT", () => {
      const offenderLines = ["label.chq-cfp-option > input w=18px h=18px"];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [wrapperCss]);
      expect(exempt.has("chq-cfp-option")).toBe(true);
    });

    it("NEGATIVE: a non-chq- ancestor class never qualifies, even with a >=44px rule", () => {
      const genericCss = `.other-wrap { display: flex; min-height: 60px; }`;
      const offenderLines = ["label.other-wrap > input w=18px h=18px"];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [genericCss]);
      expect(exempt.size).toBe(0);
    });

    it("NEGATIVE: a chq- ancestor class with no min-height rule at all does not qualify", () => {
      const offenderLines = ["div.chq-no-floor-wrap > input w=18px h=18px"];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [wrapperCss]);
      expect(exempt.has("chq-no-floor-wrap")).toBe(false);
    });

    it("NEGATIVE: a chq- ancestor class with a sub-44px min-height rule does not qualify", () => {
      const offenderLines = ["div.chq-short-wrap > input w=18px h=18px"];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [wrapperCss]);
      expect(exempt.has("chq-short-wrap")).toBe(false);
    });

    it("NEGATIVE: an offender line with no printed ancestor compound (no ' > ') derives nothing", () => {
      const offenderLines = ["input w=18px h=18px"];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [wrapperCss]);
      expect(exempt.size).toBe(0);
    });

    it("NEGATIVE: a compound ancestor selector (.chq-cfp-option.chq-cfp-pill) never grants the bare token a receipt from the compound rule alone", () => {
      // .chq-cfp-option.chq-cfp-pill carries no min-height of its own -- only
      // the solitary .chq-cfp-option rule above does, so this asserts the
      // regex is anchored to a SOLITARY class selector, not a fragment match
      // inside a compound one.
      const compoundOnlyCss = `.chq-cfp-option.chq-cfp-pill { width: auto; border-radius: 99px; }`;
      const offenderLines = ["label.chq-cfp-option > input w=18px h=18px"];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [compoundOnlyCss]);
      expect(exempt.has("chq-cfp-option")).toBe(false);
    });

    it("the real cfp.css.ts and portal.css.ts .chq-cfp-option rules (the actual wave-35 target) derive as EXEMPT", () => {
      const cfpCss = readFileSync(join(REPO_ROOT, "src", "routes", "public", "cfp.css.ts"), "utf8");
      const portalCss = readFileSync(join(REPO_ROOT, "src", "routes", "portal", "portal.css.ts"), "utf8");
      const offenderLines = [
        "label.chq-cfp-option > input w=18px h=18px",
        "label.chq-cfp-option > input w=18px h=18px",
      ];
      const exempt = deriveAncestorWrapperExemptTokens(offenderLines, [cfpCss, portalCss]);
      expect(exempt.has("chq-cfp-option")).toBe(true);
    });
  });
});
