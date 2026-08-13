// User-reported (2026-08-13): the public submit form's track checkboxes
// rendered as full-width boxes with the checkbox CENTERED ABOVE its label.
// Cause: `.chq-cfp-fieldset label { flex-direction: column }` outranks
// `.chq-cfp-option { display:flex; align-items:center }` by specificity, so
// option rows inherited the text-field stacking. The stacking selectors must
// exclude .chq-cfp-option so checkbox rows stay horizontal.

import { describe, expect, it } from "vitest";
import { CFP_CSS } from "../src/routes/public/cfp.css";

describe("public CFP option-row layout", () => {
  it("label-stacking selectors exclude .chq-cfp-option", () => {
    const css = CFP_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const stackingRules = css.split("}")
      .filter((rule) => rule.includes("flex-direction: column"))
      .filter((rule) => /(^|,)\s*[^,{]*\blabel\b[^,{]*\{/m.test(rule + "}"));
    expect(stackingRules.length).toBeGreaterThan(0);
    for (const rule of stackingRules) {
      const selector = rule.split("{")[0];
      for (const part of selector.split(",")) {
        if (/\blabel\b/.test(part)) {
          expect(part).toContain(":not(.chq-cfp-option)");
        }
      }
    }
  });

  it("option rows keep their horizontal layout rule", () => {
    const option = CFP_CSS.split("}").find((r) => r.includes(".chq-cfp-option {"));
    expect(option).toBeDefined();
    expect(option).toContain("display: flex");
    expect(option).not.toContain("flex-direction: column");
  });
});
