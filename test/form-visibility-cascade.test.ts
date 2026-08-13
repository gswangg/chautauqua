import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { isVisible, makeVisibilityPredicate, resolveHiddenFieldIds } from "../src/forms/visibility";
import { validateAnswers } from "../src/forms/validate";

// DEC-532: conditional-field visibility is transitive (a fixed point) — a
// field whose rule points at an ALREADY-HIDDEN field is itself hidden, even
// if the raw answer map still carries the middle field's stale answer.

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 0,
  options: ["Talk", "Workshop"],
};

const workshopLengthField: FormFieldDef = {
  id: "workshopLength",
  section: "session",
  kind: "dropdown",
  label: "Workshop length",
  required: true,
  position: 1,
  options: ["60 min", "90 min"],
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

const projectorField: FormFieldDef = {
  id: "projector",
  section: "session",
  kind: "checkbox",
  label: "Need a projector?",
  required: true,
  position: 2,
  rule: { fieldId: "workshopLength", op: "eq", value: "90 min" },
};

const threeDeepFields = [formatField, workshopLengthField, projectorField];

describe("resolveHiddenFieldIds — three-deep chain with a stale middle answer", () => {
  it("hides the grandchild when the top of the chain no longer selects the middle field", () => {
    // format switched away from "Workshop", but the raw answer map still
    // carries workshopLength's stale answer from when it was visible.
    const answers = { format: "Talk", workshopLength: "90 min" };

    const hidden = resolveHiddenFieldIds(threeDeepFields, answers);

    expect(hidden.has("workshopLength")).toBe(true);
    expect(hidden.has("projector")).toBe(true);
    expect(hidden.has("format")).toBe(false);

    // Without the fixed point, the raw (naive) single-pass check would find
    // projector visible, since it only looks at workshopLength's stale
    // answer — this is exactly the bug DEC-532 closes.
    expect(isVisible(projectorField, answers, "dropdown")).toBe(true);
  });

  it("a required grandchild no longer produces a required error once transitively hidden", () => {
    const answers = { format: "Talk", workshopLength: "90 min" };

    const result = validateAnswers(threeDeepFields, answers);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.hiddenFieldIds).toContain("projector");
    expect(result.hiddenFieldIds).toContain("workshopLength");
    expect(result.cleaned.projector).toBeUndefined();
  });

  it("includes the grandchild's id in hiddenFieldIds so DEC-501 deletes its stale answer", () => {
    const answers = { format: "Talk", workshopLength: "90 min", projector: true };

    const result = validateAnswers(threeDeepFields, answers);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.hiddenFieldIds.sort()).toEqual(["projector", "workshopLength"]);
  });

  it("keeps the grandchild visible when the full chain resolves true", () => {
    const answers = { format: "Workshop", workshopLength: "90 min" };
    const hidden = resolveHiddenFieldIds(threeDeepFields, answers);
    expect(hidden.has("projector")).toBe(false);
    expect(hidden.has("workshopLength")).toBe(false);
  });
});

describe("resolveHiddenFieldIds — rule naming an unknown fieldId", () => {
  it("hides the field whose rule points at a nonexistent field", () => {
    const orphan: FormFieldDef = {
      id: "orphan",
      section: "session",
      kind: "text",
      label: "Orphan",
      required: false,
      position: 0,
      rule: { fieldId: "doesNotExist", op: "eq", value: "x" },
    };

    const hidden = resolveHiddenFieldIds([orphan], {});
    expect(hidden.has("orphan")).toBe(true);
  });
});

describe("resolveHiddenFieldIds — a two-field rule cycle", () => {
  it("terminates (no infinite loop) and settles with both hidden when neither rule currently matches", () => {
    const a: FormFieldDef = {
      id: "a",
      section: "session",
      kind: "text",
      label: "A",
      required: false,
      position: 0,
      rule: { fieldId: "b", op: "eq", value: "show-a" },
    };
    const b: FormFieldDef = {
      id: "b",
      section: "session",
      kind: "text",
      label: "B",
      required: false,
      position: 1,
      rule: { fieldId: "a", op: "eq", value: "show-b" },
    };

    // Neither answer matches the other's expected trigger value, so each
    // rule evaluates false independent of the cycle — this exercises that
    // a mutual rule reference terminates the fixed-point loop rather than
    // looping forever, and both settle hidden.
    const hidden = resolveHiddenFieldIds([a, b], { a: "something-else", b: "something-else" });
    expect(hidden.has("a")).toBe(true);
    expect(hidden.has("b")).toBe(true);
  });

  it("does not hide a cyclic pair whose rules currently both match (no infinite loop either way)", () => {
    const a: FormFieldDef = {
      id: "a",
      section: "session",
      kind: "text",
      label: "A",
      required: false,
      position: 0,
      rule: { fieldId: "b", op: "eq", value: "yes" },
    };
    const b: FormFieldDef = {
      id: "b",
      section: "session",
      kind: "text",
      label: "B",
      required: false,
      position: 1,
      rule: { fieldId: "a", op: "eq", value: "yes" },
    };

    const hidden = resolveHiddenFieldIds([a, b], { a: "yes", b: "yes" });
    expect(hidden.has("a")).toBe(false);
    expect(hidden.has("b")).toBe(false);
  });
});

// DEC-973: a hidden trigger hides its dependents structurally — a dependent
// ruled against a checkbox trigger that is itself currently hidden must be
// hidden too, regardless of what the checkbox's stale answer says, and must
// not be required. When the trigger is visible and unanswered, the
// canonicalizer's "absent checkbox => false" behaviour is unchanged.
describe("resolveHiddenFieldIds — dependent on a hidden checkbox trigger (DEC-973)", () => {
  const gateField: FormFieldDef = {
    id: "gate",
    section: "session",
    kind: "dropdown",
    label: "Gate",
    required: false,
    position: 0,
    options: ["Open", "Closed"],
  };

  const triggerField: FormFieldDef = {
    id: "trigger",
    section: "session",
    kind: "checkbox",
    label: "Trigger",
    required: false,
    position: 1,
    rule: { fieldId: "gate", op: "eq", value: "Open" },
  };

  const dependentField: FormFieldDef = {
    id: "dependent",
    section: "session",
    kind: "text",
    label: "Dependent",
    required: true,
    position: 2,
    rule: { fieldId: "trigger", op: "ne", value: true },
  };

  const chainFields = [gateField, triggerField, dependentField];

  it("hides the dependent (and drops its required-ness) when the trigger is itself hidden, even though the stale checked=true answer would otherwise satisfy ne:true", () => {
    const answers = { gate: "Closed", trigger: true };

    const hidden = resolveHiddenFieldIds(chainFields, answers);
    expect(hidden.has("trigger")).toBe(true);
    expect(hidden.has("dependent")).toBe(true);

    const result = validateAnswers(chainFields, answers);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.hiddenFieldIds).toContain("dependent");
    expect(result.cleaned.dependent).toBeUndefined();
  });

  it("keeps the dependent visible using the unchanged absent-checkbox=>false canonicalizer when the trigger is visible and unanswered", () => {
    const answers = { gate: "Open" };

    const hidden = resolveHiddenFieldIds(chainFields, answers);
    expect(hidden.has("trigger")).toBe(false);
    // trigger unanswered canonicalizes to false; ne:true against false is true
    expect(hidden.has("dependent")).toBe(false);
  });
});

describe("makeVisibilityPredicate", () => {
  it("drops into the two-arg isVisible shape and matches resolveHiddenFieldIds", () => {
    const answers = { format: "Talk", workshopLength: "90 min" };
    const predicate = makeVisibilityPredicate(threeDeepFields, answers);

    expect(predicate(formatField, answers)).toBe(true);
    expect(predicate(workshopLengthField, answers)).toBe(false);
    expect(predicate(projectorField, answers)).toBe(false);
  });
});
