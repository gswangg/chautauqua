import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { lockedFieldId, lockedFieldName } from "../src/forms/types";
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

const requiredAgreeField: FormFieldDef = {
  id: "required_agree",
  section: "session",
  kind: "checkbox",
  label: "I agree to the code of conduct",
  required: true,
  position: 6,
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

describe("lockedFieldId / lockedFieldName (DEC-050)", () => {
  it("mints a per-form PK for a locked name", () => {
    expect(lockedFieldId("form_abc", "title")).toBe("form_abc:title");
  });

  it("resolves a per-form PK back to its short locked name", () => {
    expect(lockedFieldName("form_abc:title")).toBe("title");
    expect(lockedFieldName("form_xyz:first_name")).toBe("first_name");
  });

  it("resolves a plain unprefixed locked name (pre-existing seeded rows)", () => {
    expect(lockedFieldName("title")).toBe("title");
    expect(lockedFieldName("description")).toBe("description");
    expect(lockedFieldName("first_name")).toBe("first_name");
    expect(lockedFieldName("last_name")).toBe("last_name");
    expect(lockedFieldName("email")).toBe("email");
  });

  it("returns null for a custom (non-locked) field id, prefixed or not", () => {
    expect(lockedFieldName("format")).toBeNull();
    expect(lockedFieldName("form_abc:format")).toBeNull();
  });

  it("round-trips through both directions for every locked name", () => {
    for (const name of ["title", "description", "first_name", "last_name", "email"]) {
      expect(lockedFieldName(lockedFieldId("form_1", name))).toBe(name);
    }
  });
});

describe("isVisible", () => {
  it("is visible when there is no rule", () => {
    expect(isVisible(titleField, {})).toBe(true);
  });

  it("eq rule: hidden when trigger does not match", () => {
    expect(isVisible(materialsField, { format: "Talk" }, "dropdown")).toBe(false);
  });

  it("eq rule: visible when trigger matches (J1 show-when-Workshop scenario)", () => {
    expect(isVisible(materialsField, { format: "Workshop" }, "dropdown")).toBe(true);
  });

  it("ne rule: visible when trigger differs", () => {
    const field: FormFieldDef = {
      ...materialsField,
      rule: { fieldId: "format", op: "ne", value: "Workshop" },
    };
    expect(isVisible(field, { format: "Talk" }, "dropdown")).toBe(true);
    expect(isVisible(field, { format: "Workshop" }, "dropdown")).toBe(false);
  });

  it("in rule: visible when trigger value is a member of the value array", () => {
    const field: FormFieldDef = {
      ...materialsField,
      rule: { fieldId: "format", op: "in", value: ["Workshop", "Panel"] },
    };
    expect(isVisible(field, { format: "Panel" }, "dropdown")).toBe(true);
    expect(isVisible(field, { format: "Talk" }, "dropdown")).toBe(false);
  });

  it("in rule: hidden when rule value is not an array", () => {
    const field: FormFieldDef = {
      ...materialsField,
      rule: { fieldId: "format", op: "in", value: "Workshop" },
    };
    expect(isVisible(field, { format: "Workshop" }, "dropdown")).toBe(false);
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
    expect(result).toEqual({ ok: true, cleaned: { title: "My talk" }, hiddenFieldIds: [] });
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
    expect(result).toEqual({ ok: true, cleaned: { format: "Panel" }, hiddenFieldIds: [] });
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

  it("DEC-227: rejects an unchecked required checkbox (value false) as required", () => {
    const result = validateAnswers([requiredAgreeField], { required_agree: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.required_agree).toBe("required");
    }
  });

  it("DEC-227: rejects an absent required checkbox as required", () => {
    const result = validateAnswers([requiredAgreeField], {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.required_agree).toBe("required");
    }
  });

  it("DEC-227: accepts a checked required checkbox and cleans it to true", () => {
    const result = validateAnswers([requiredAgreeField], { required_agree: true });
    expect(result).toEqual({ ok: true, cleaned: { required_agree: true }, hiddenFieldIds: [] });
  });

  it("DEC-227: a non-required unchecked checkbox still cleans to false without error", () => {
    const result = validateAnswers([agreeField], { agree: false });
    expect(result).toEqual({ ok: true, cleaned: { agree: false }, hiddenFieldIds: [] });
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
    expect(result).toEqual({ ok: true, cleaned: { slides: "file_abc123" }, hiddenFieldIds: [] });
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
