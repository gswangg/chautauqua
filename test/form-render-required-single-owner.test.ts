import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import type { FormFieldDef } from "../src/forms/types";
import { FieldRulesScript, FormField } from "../src/views/form-render";

// ---------------------------------------------------------------------------
// DEC-986 (wave 138, ruled but never built until now): "One owner for
// `required`" -- FieldRulesScript's apply() is bound to a document-level
// `change` listener and, on ANY change anywhere on the page, re-arms
// `input.required` for every rule-bearing field it knows about. A field may
// legally be both conditional (has a rule) AND required (src/forms/validate
// enforces required only when visible), so a required conditional question
// sitting inside a step CfpStepsScript has hidden (display:none, a DIFFERENT
// ancestor than the field's own rule-toggled wrap) used to get `required`
// silently restored -- the browser then aborts Submit on a control it can
// neither focus nor see.
//
// The fix: apply()'s per-input loop now walks parentElement up to
// document.body; if any ancestor computes display:none, it forces
// required=false and (only when the wizard has already stashed a pre-hide
// value on data-chq-cfp-required-orig) rewrites that stash to the CURRENT
// conditional truth, so CfpStepsScript's later restore uses fresh state
// instead of its stale DOMContentLoaded snapshot. That stash attribute is
// the ONE handoff channel between the two scripts -- no second marker.
//
// Real jsdom (runScripts: "dangerously") is used throughout because the
// hidden-ancestor walk needs live getComputedStyle() across a DOM CfpStepsScript
// itself does not run here (this file owns form-render.tsx only, not
// cfp-steps-script.tsx) -- the wizard's hiding is simulated by an inline
// style="display:none" on an outer <section>, exactly the state
// CfpStepsScript leaves behind on a non-current step.
// ---------------------------------------------------------------------------

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 0,
  options: ["Talk", "Workshop"],
};

const materialsField: FormFieldDef = {
  id: "materials",
  section: "session",
  kind: "text",
  label: "Materials needed",
  required: true,
  position: 1,
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

/** Renders format (trigger, never hidden) + materials (conditional,
 * required) and, when `wizardHidden` is true, nests materials' own field
 * wrap inside an extra <section style="display:none"> -- the wizard-step
 * ancestor that is NOT the rule-toggled wrap itself. `origStash` seeds
 * materials' input with CfpStepsScript's handoff attribute when provided. */
function buildDom(opts: { format: string; wizardHidden: boolean; origStash?: "0" | "1" }) {
  const formatHtml = FormField({ field: formatField, value: opts.format, visible: true }).toString();
  let materialsHtml = FormField({ field: materialsField, value: "", visible: true }).toString();
  if (opts.origStash !== undefined) {
    materialsHtml = materialsHtml.replace(
      'data-field-id="materials"',
      `data-field-id="materials" data-chq-cfp-required-orig="${opts.origStash}"`,
    );
  }
  const materialsBlock = opts.wizardHidden
    ? `<section id="wizard-step" style="display:none">${materialsHtml}</section>`
    : materialsHtml;
  const rulesHtml = FieldRulesScript({ fields: [formatField, materialsField] }).toString();
  const dom = new JSDOM(
    `<!doctype html><html><body><form>${formatHtml}${materialsBlock}</form>${rulesHtml}</body></html>`,
    { url: "https://example.test/submit/test-conf", runScripts: "dangerously" },
  );
  const document = dom.window.document;
  const trigger = document.querySelector('[data-field-id="format"]') as HTMLSelectElement;
  const input = document.querySelector('[data-field-id="materials"]') as HTMLInputElement;
  return { window: dom.window, document, trigger, input };
}

describe("FieldRulesScript defers to the wizard's hidden ancestor (DEC-986 wave 138/139)", () => {
  it("(a) a required control inside a display:none wrapper is un-required, and a matching stash is left untouched", () => {
    const { window, document, input } = buildDom({ format: "Workshop", wizardHidden: true, origStash: "1" });
    expect(input.getAttribute("data-chq-cfp-required-orig")).toBe("1");

    document.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(input.required).toBe(false);
    expect(input.getAttribute("data-chq-cfp-required-orig")).toBe("1");
  });

  it("(b) when the conditional rule ALSO stops matching, the stash is rewritten to '0'", () => {
    const { window, document, trigger, input } = buildDom({
      format: "Workshop",
      wizardHidden: true,
      origStash: "1",
    });

    // Rule no longer matches: format is no longer "Workshop".
    trigger.value = "Talk";
    document.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(input.required).toBe(false);
    expect(input.getAttribute("data-chq-cfp-required-orig")).toBe("0");
  });

  it("(c) once the wizard un-hides the ancestor AND the rule matches again, required is armed from the current want", () => {
    const { window, document, trigger, input } = buildDom({
      format: "Workshop",
      wizardHidden: true,
      origStash: "1",
    });

    // Reach the DEC-986 dead end first (rule stops matching under the
    // wizard-hidden ancestor)...
    trigger.value = "Talk";
    document.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(input.required).toBe(false);

    // ...then the wizard advances to this step (un-hides the ancestor) and
    // the rule matches again -- required must be armed from the CURRENT
    // want, not stuck false forever.
    const wizardStep = document.getElementById("wizard-step")!;
    wizardStep.style.display = "";
    trigger.value = "Workshop";
    document.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(input.required).toBe(true);
    // The stash is only ever rewritten while the control is hidden -- once
    // visible, apply() arms `required` directly and leaves the stash as
    // whatever the hidden branch last wrote (CfpStepsScript's own restore
    // path owns it from here).
    expect(input.getAttribute("data-chq-cfp-required-orig")).toBe("0");
  });

  it("(d) the ordinary visible path (no hidden ancestor) is unchanged: a visible required conditional field ends required=true", () => {
    const { window, document, input } = buildDom({ format: "Workshop", wizardHidden: false });

    document.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(input.required).toBe(true);
    // No wizard ever stashed anything here -- the handoff attribute must
    // not be invented.
    expect(input.hasAttribute("data-chq-cfp-required-orig")).toBe(false);
  });
});
