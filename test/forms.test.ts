import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { isVisible } from "../src/forms/visibility";
import { validateAnswers } from "../src/forms/validate";

const titleField: FormFieldDef = {
  id: "title",
  section: "session",
  kind: "text",
  label: "Title",
  required: true,
  position: 0,
};

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 1,
  options: ["Talk", "Workshop", "Panel"],
};

const materialsField: FormFieldDef = {
  id: "materials",
  section: "session",
  kind: "text",
  label: "Materials needed",
  required: true,
  position: 2,
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

const agreeField: FormFieldDef = {
  id: "agree",
  section: "session",
  kind: "checkbox",
  label: "Agree to terms",
  required: false,
  position: 3,
};

const attendeesField: FormFieldDef = {
  id: "attendees",
  section: "session",
  kind: "number",
  label: "Expected attendees",
  required: false,
  position: 4,
};

const slidesField: FormFieldDef = {
  id: "slides",
  section: "session",
  kind: "file",
  label: "Slides",
  required: false,
  position: 5,
};

describe("isVisible", () => {
  it("is visible when there is no rule", () => {
    expect(isVisible(titleField, {})).toBe(true);
  });

  it("eq rule: hidden when trigger does not match", () => {
    expect(isVisible(materialsField, { format: "Talk" })).toBe(false);
  });

  it("eq rule: visible when trigger matches (J1 show-when-Workshop scenario)", () => {
    expect(isVisible(materialsField, { format: "Workshop" })).toBe(true);
  });

  it("ne rule: visible when trigger differs", () => {
    const field: FormFieldDef = {
      ...materialsField,
      rule: { fieldId: "format", op: "ne", value: "Workshop" },
    };
    expect(isVisible(field, { format: "Talk" })).toBe(true);
    expect(isVisible(field, { format: "Workshop" })).toBe(false);
  });

  it("in rule: visible when trigger value is a member of the value array", () => {
    const field: FormFieldDef = {
      ...materialsField,
      rule: { fieldId: "format", op: "in", value: ["Workshop", "Panel"] },
    };
    expect(isVisible(field, { format: "Panel" })).toBe(true);
    expect(isVisible(field, { format: "Talk" })).toBe(false);
  });

  it("in rule: hidden when rule value is not an array", () => {
    const field: FormFieldDef = {
      ...materialsField,
      rule: { fieldId: "format", op: "in", value: "Workshop" },
    };
    expect(isVisible(field, { format: "Workshop" })).toBe(false);
  });
});

describe("validateAnswers", () => {
  it("requires visible required fields", () => {
    const result = validateAnswers([titleField], {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeDefined();
    }
  });

  it("passes when visible required fields are answered", () => {
    const result = validateAnswers([titleField], { title: "My talk" });
    expect(result).toEqual({ ok: true, cleaned: { title: "My talk" } });
  });

  it("does not block on a hidden required field (conditional case)", () => {
    const result = validateAnswers([formatField, materialsField], {
      format: "Talk",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned).toEqual({ format: "Talk" });
      expect(result.cleaned).not.toHaveProperty("materials");
    }
  });

  it("becomes required when its trigger matches (J1 scenario)", () => {
    const result = validateAnswers([formatField, materialsField], {
      format: "Workshop",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.materials).toBeDefined();
    }
  });

  it("passes the conditional case once the visible required field is answered", () => {
    const result = validateAnswers([formatField, materialsField], {
      format: "Workshop",
      materials: "Laptops for all attendees",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned.materials).toBe("Laptops for all attendees");
    }
  });

  it("strips answers for hidden fields even when supplied by the client", () => {
    const result = validateAnswers([formatField, materialsField], {
      format: "Talk",
      materials: "should be stripped",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned).not.toHaveProperty("materials");
    }
  });

  it("rejects dropdown values not in options", () => {
    const result = validateAnswers([formatField], { format: "Keynote" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.format).toBeDefined();
    }
  });

  it("accepts a valid dropdown value", () => {
    const result = validateAnswers([formatField], { format: "Panel" });
    expect(result).toEqual({ ok: true, cleaned: { format: "Panel" } });
  });

  it("coerces checkbox values to boolean", () => {
    const result = validateAnswers([agreeField], { agree: "yes" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned.agree).toBe(true);
    }
  });

  it("coerces checkbox absence/false correctly when not required", () => {
    const result = validateAnswers([agreeField], { agree: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned.agree).toBe(false);
    }
  });

  it("validates numeric fields and rejects non-numeric input", () => {
    const good = validateAnswers([attendeesField], { attendees: "42" });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.cleaned.attendees).toBe(42);
    }

    const bad = validateAnswers([attendeesField], { attendees: "not-a-number" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.attendees).toBeDefined();
    }
  });

  it("carries an opaque file-id string for file fields", () => {
    const result = validateAnswers([slidesField], { slides: "file_abc123" });
    expect(result).toEqual({ ok: true, cleaned: { slides: "file_abc123" } });
  });

  it("rejects unknown answer keys", () => {
    const result = validateAnswers([titleField], {
      title: "My talk",
      bogus: "nope",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.bogus).toBeDefined();
    }
  });
});
