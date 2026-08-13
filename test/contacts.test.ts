import { describe, expect, it } from "vitest";
import {
  findDuplicateGroups,
  planMerge,
  previewMerge,
  matchesSegment,
  mapImportRow,
  type ContactRecord,
  type SegmentRule,
} from "../src/domain/contacts";

function contact(overrides: Partial<ContactRecord> & { id: string }): ContactRecord {
  return {
    email: "",
    firstName: "",
    lastName: "",
    ...overrides,
  };
}

describe("findDuplicateGroups", () => {
  it("groups by case-insensitive trimmed email", () => {
    const contacts = [
      contact({ id: "1", email: "  Jane@Example.com ", firstName: "Jane", lastName: "Doe" }),
      contact({ id: "2", email: "jane@example.com", firstName: "Janey", lastName: "D" }),
      contact({ id: "3", email: "other@example.com", firstName: "Bob", lastName: "Smith" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([{ contactIds: ["1", "2"], reason: "email" }]);
  });

  it("groups remainder by normalized name when emails differ/blank", () => {
    const contacts = [
      contact({ id: "1", email: "", firstName: "  Jane ", lastName: "Doe" }),
      contact({ id: "2", email: "", firstName: "jane", lastName: "  doe" }),
      contact({ id: "3", email: "", firstName: "Bob", lastName: "Smith" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([{ contactIds: ["1", "2"], reason: "name_and_company" }]);
  });

  it("flags same-name same-company contacts even across different emails (DEC-143)", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe", company: "acme corp" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([{ contactIds: ["1", "2"], reason: "name_and_company" }]);
  });

  it("flags same-name contacts with different companies as a 'name' candidate (DEC-800)", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe", company: "Beta Inc" }),
    ];
    const groups = findDuplicateGroups(contacts);
    // Each company sub-group here has only one member (below the >=2
    // threshold), so only the whole-bucket 'name' candidate is emitted.
    expect(groups).toEqual([{ contactIds: ["1", "2"], reason: "name" }]);
  });

  it("emits both 'name_and_company' and 'name' when a same-name bucket has a real 2+ company sub-group plus a third, different-company member (DEC-800)", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe", company: "acme corp" }),
      contact({ id: "3", email: "c@example.com", firstName: "Jane", lastName: "Doe", company: "Beta Inc" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([
      { contactIds: ["1", "2"], reason: "name_and_company" },
      { contactIds: ["1", "2", "3"], reason: "name" },
    ]);
  });

  it("joins a blank-company contact into a named-company group (DEC-143)", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([{ contactIds: ["1", "2"], reason: "name_and_company" }]);
  });

  it("does not group unique singleton contacts", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "A", lastName: "One" }),
      contact({ id: "2", email: "b@example.com", firstName: "B", lastName: "Two" }),
    ];
    expect(findDuplicateGroups(contacts)).toEqual([]);
  });

  it("does not group contacts with blank names and blank emails", () => {
    const contacts = [
      contact({ id: "1", email: "", firstName: "", lastName: "" }),
      contact({ id: "2", email: "", firstName: "", lastName: "" }),
    ];
    expect(findDuplicateGroups(contacts)).toEqual([]);
  });
});

describe("planMerge", () => {
  it("primary wins on every populated field", () => {
    const primary = contact({
      id: "p",
      email: "primary@example.com",
      firstName: "Primary",
      lastName: "Person",
      company: "PrimaryCo",
    });
    const duplicate = contact({
      id: "d",
      email: "dup@example.com",
      firstName: "Dup",
      lastName: "Person",
      company: "DupCo",
      title: "Duplicate Title",
    });
    const { merged, duplicateId } = planMerge(primary, duplicate);
    expect(duplicateId).toBe("d");
    expect(merged.id).toBe("p");
    expect(merged.email).toBe("primary@example.com");
    expect(merged.firstName).toBe("Primary");
    expect(merged.company).toBe("PrimaryCo");
    // title missing on primary -> filled from duplicate
    expect(merged.title).toBe("Duplicate Title");
  });

  it("fills blank/missing primary fields from duplicate", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "", lastName: "Doe" });
    const duplicate = contact({ id: "d", email: "d@example.com", firstName: "Jane", lastName: "Smith" });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.firstName).toBe("Jane");
    expect(merged.lastName).toBe("Doe");
  });

  it("unions customFields with primary precedence", () => {
    const primary = contact({
      id: "p",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      customFields: { shirt: "L", key1: "primaryVal" },
    });
    const duplicate = contact({
      id: "d",
      email: "d@example.com",
      firstName: "D",
      lastName: "D",
      customFields: { key1: "dupVal", key2: "dupOnly" },
    });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.customFields).toEqual({ shirt: "L", key1: "primaryVal", key2: "dupOnly" });
  });

  it("fills phone/bio/headshotUrl from duplicate when primary is blank (DEC-167)", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P" });
    const duplicate = contact({
      id: "d",
      email: "d@example.com",
      firstName: "D",
      lastName: "D",
      phone: "555-1234",
      bio: "A speaker bio.",
      headshotUrl: "https://example.com/headshot.jpg",
    });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.phone).toBe("555-1234");
    expect(merged.bio).toBe("A speaker bio.");
    expect(merged.headshotUrl).toBe("https://example.com/headshot.jpg");
  });

  it("keeps primary's phone/bio/headshotUrl when both are populated (DEC-167)", () => {
    const primary = contact({
      id: "p",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      phone: "primary-phone",
      bio: "primary bio",
      headshotUrl: "primary.jpg",
    });
    const duplicate = contact({
      id: "d",
      email: "d@example.com",
      firstName: "D",
      lastName: "D",
      phone: "dup-phone",
      bio: "dup bio",
      headshotUrl: "dup.jpg",
    });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.phone).toBe("primary-phone");
    expect(merged.bio).toBe("primary bio");
    expect(merged.headshotUrl).toBe("primary.jpg");
  });

  it("fills socialLinks per-key from duplicate (DEC-167)", () => {
    const primary = contact({
      id: "p",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      socialLinks: { twitter: "@primary", linkedin: "", github: "", website: "" },
    });
    const duplicate = contact({
      id: "d",
      email: "d@example.com",
      firstName: "D",
      lastName: "D",
      socialLinks: { twitter: "@dup", linkedin: "dup-linkedin", github: "dup-github", website: "" },
    });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.socialLinks).toEqual({
      twitter: "@primary",
      linkedin: "dup-linkedin",
      github: "dup-github",
      website: "",
    });
  });

  it("concatenates notes with a separator when duplicate's notes are non-blank and differ (DEC-167)", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P", notes: "Primary note." });
    const duplicate = contact({ id: "d", email: "d@example.com", firstName: "D", lastName: "D", notes: "Duplicate note." });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.notes).toBe("Primary note.\n\n---\n\nDuplicate note.");
  });

  it("leaves notes absent when both primary and duplicate have blank notes (DEC-167)", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P" });
    const duplicate = contact({ id: "d", email: "d@example.com", firstName: "D", lastName: "D" });
    const { merged } = planMerge(primary, duplicate);
    expect(merged.notes).toBeUndefined();
  });

  it("uses duplicate's notes alone when primary has none, and doesn't duplicate identical notes", () => {
    const primaryBlank = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P" });
    const dup = contact({ id: "d", email: "d@example.com", firstName: "D", lastName: "D", notes: "Shared note." });
    expect(planMerge(primaryBlank, dup).merged.notes).toBe("Shared note.");

    const primarySame = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P", notes: "Shared note." });
    expect(planMerge(primarySame, dup).merged.notes).toBe("Shared note.");
  });
});

describe("previewMerge (DEC-748)", () => {
  it("emits a 'keep' row with a blank discarded entry when the duplicate's side is empty and the primary's is not", () => {
    const primary = contact({
      id: "p",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      company: "AcmeCo",
      title: "Engineer",
    });
    const duplicate = contact({ id: "d", email: "p@example.com", firstName: "P", lastName: "P" });

    const fields = previewMerge(primary, [duplicate]);
    const byKey = new Map(fields.map((f) => [f.key, f]));

    const company = byKey.get("company");
    expect(company).toBeDefined();
    expect(company!.outcome).toBe("keep");
    expect(company!.kept).toBe("AcmeCo");
    expect(company!.discarded).toEqual([""]);

    const title = byKey.get("title");
    expect(title).toBeDefined();
    expect(title!.outcome).toBe("keep");
    expect(title!.kept).toBe("Engineer");
    expect(title!.discarded).toEqual([""]);
  });

  it("emits a 'fill' row (not a blank-discard 'keep') when the primary's side is empty and the duplicate's is not", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P" });
    const duplicate = contact({
      id: "d",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      company: "AcmeCo",
    });

    const fields = previewMerge(primary, [duplicate]);
    const company = fields.find((f) => f.key === "company");
    expect(company).toBeDefined();
    expect(company!.outcome).toBe("fill");
    expect(company!.kept).toBe("AcmeCo");
    expect(company!.discarded).toEqual([]);
  });

  it("suppresses a field entirely when both sides are blank or identical", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P", company: "AcmeCo" });
    const duplicateBlank = contact({ id: "d1", email: "p@example.com", firstName: "P", lastName: "P" });
    const duplicateSame = contact({ id: "d2", email: "p@example.com", firstName: "P", lastName: "P", company: "AcmeCo" });

    // both blank (a field neither side has) never appears
    const bothBlank = previewMerge(
      contact({ id: "p2", email: "p@example.com", firstName: "P", lastName: "P" }),
      [contact({ id: "d3", email: "p@example.com", firstName: "P", lastName: "P" })],
    );
    expect(bothBlank.some((f) => f.key === "company")).toBe(false);

    // primary non-blank, duplicate blank -> still reported (asserted above);
    // primary non-blank, duplicate identical -> suppressed
    const identical = previewMerge(primary, [duplicateSame]);
    expect(identical.some((f) => f.key === "company")).toBe(false);

    // sanity: the blank-duplicate case from the prior test is not itself
    // suppressed by this same-primary setup
    const blankDup = previewMerge(primary, [duplicateBlank]);
    expect(blankDup.find((f) => f.key === "company")?.outcome).toBe("keep");
  });
});

describe("previewMerge custom fields and notes (DEC-802)", () => {
  it("emits a 'keep' row with an empty discarded array for a keeper-only custom field key", () => {
    const primary = contact({
      id: "p",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      customFields: { shirt: "L" },
    });
    const duplicate = contact({ id: "d", email: "p@example.com", firstName: "P", lastName: "P" });

    const fields = previewMerge(primary, [duplicate]);
    const shirt = fields.find((f) => f.key === "customFields.shirt");
    expect(shirt).toBeDefined();
    expect(shirt!.outcome).toBe("keep");
    expect(shirt!.kept).toBe("L");
    expect(shirt!.discarded).toEqual([]);
  });

  it("still emits a 'combine' row for a duplicate-only custom field key", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P" });
    const duplicate = contact({
      id: "d",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      customFields: { shirt: "L" },
    });

    const fields = previewMerge(primary, [duplicate]);
    const shirt = fields.find((f) => f.key === "customFields.shirt");
    expect(shirt).toBeDefined();
    expect(shirt!.outcome).toBe("combine");
    expect(shirt!.kept).toBe("L");
  });

  it("emits a Notes row for a keeper-only note even when the duplicate has none", () => {
    const primary = contact({
      id: "p",
      email: "p@example.com",
      firstName: "P",
      lastName: "P",
      notes: "Keeper's note.",
    });
    const duplicate = contact({ id: "d", email: "p@example.com", firstName: "P", lastName: "P" });

    const fields = previewMerge(primary, [duplicate]);
    const notes = fields.find((f) => f.key === "notes");
    expect(notes).toBeDefined();
    expect(notes!.outcome).toBe("keep");
    expect(notes!.kept).toBe("Keeper's note.");
  });

  it("still suppresses the Notes row when neither side has notes", () => {
    const primary = contact({ id: "p", email: "p@example.com", firstName: "P", lastName: "P" });
    const duplicate = contact({ id: "d", email: "p@example.com", firstName: "P", lastName: "P" });

    const fields = previewMerge(primary, [duplicate]);
    expect(fields.some((f) => f.key === "notes")).toBe(false);
  });
});

describe("matchesSegment", () => {
  const c = contact({
    id: "1",
    email: "Jane@Example.com",
    firstName: "Jane",
    lastName: "Doe",
    company: "Acme Corp",
    customFields: { shirtSize: "Large" },
  });

  it("matches eq case-insensitively", () => {
    const rules: SegmentRule[] = [{ field: "firstName", op: "eq", value: "jane" }];
    expect(matchesSegment(rules, c)).toBe(true);
  });

  it("matches ne", () => {
    const rules: SegmentRule[] = [{ field: "lastName", op: "ne", value: "smith" }];
    expect(matchesSegment(rules, c)).toBe(true);
  });

  it("matches contains", () => {
    const rules: SegmentRule[] = [{ field: "company", op: "contains", value: "acme" }];
    expect(matchesSegment(rules, c)).toBe(true);
  });

  it("applies AND semantics across multiple rules", () => {
    const rules: SegmentRule[] = [
      { field: "firstName", op: "eq", value: "jane" },
      { field: "lastName", op: "eq", value: "smith" },
    ];
    expect(matchesSegment(rules, c)).toBe(false);
  });

  it("addresses custom fields via custom.<key>", () => {
    const rules: SegmentRule[] = [{ field: "custom.shirtSize", op: "eq", value: "large" }];
    expect(matchesSegment(rules, c)).toBe(true);
  });

  it("treats missing custom field value as empty string", () => {
    const rules: SegmentRule[] = [{ field: "custom.missing", op: "eq", value: "" }];
    expect(matchesSegment(rules, c)).toBe(true);
  });

  it("throws on unknown field name", () => {
    const rules: SegmentRule[] = [{ field: "nickname", op: "eq", value: "j" }];
    expect(() => matchesSegment(rules, c)).toThrow();
  });

  describe("field: 'any' (DEC-149)", () => {
    it("contains matches if ANY of email/firstName/lastName/company/title matches", () => {
      expect(matchesSegment([{ field: "any", op: "contains", value: "acme" }], c)).toBe(true);
      expect(matchesSegment([{ field: "any", op: "contains", value: "jane" }], c)).toBe(true);
      expect(matchesSegment([{ field: "any", op: "contains", value: "nope" }], c)).toBe(false);
    });

    it("eq matches if ANY field equals the value exactly (case-insensitive)", () => {
      expect(matchesSegment([{ field: "any", op: "eq", value: "doe" }], c)).toBe(true);
      expect(matchesSegment([{ field: "any", op: "eq", value: "jane" }], c)).toBe(true);
      expect(matchesSegment([{ field: "any", op: "eq", value: "jane doe" }], c)).toBe(false);
    });

    it("ne matches only if ALL fields differ from the value", () => {
      expect(matchesSegment([{ field: "any", op: "ne", value: "nope" }], c)).toBe(true);
      expect(matchesSegment([{ field: "any", op: "ne", value: "jane" }], c)).toBe(false);
    });

    it("does not fan out into custom fields", () => {
      expect(matchesSegment([{ field: "any", op: "eq", value: "large" }], c)).toBe(false);
    });

    it("AND-composes with other rules", () => {
      const rules: SegmentRule[] = [
        { field: "any", op: "contains", value: "jane" },
        { field: "company", op: "eq", value: "acme corp" },
      ];
      expect(matchesSegment(rules, c)).toBe(true);
      const rulesFail: SegmentRule[] = [
        { field: "any", op: "contains", value: "jane" },
        { field: "company", op: "eq", value: "other" },
      ];
      expect(matchesSegment(rulesFail, c)).toBe(false);
    });
  });
});

describe("mapImportRow", () => {
  const header = ["Email Address", "First", "Last", "Shirt Size", "Ignored Col"];

  it("maps standard and custom fields", () => {
    const mapping = {
      "Email Address": "email",
      First: "firstName",
      Last: "lastName",
      "Shirt Size": "custom.shirtSize",
    };
    const row = ["a@example.com", "Jane", "Doe", "Large", "whatever"];
    const result = mapImportRow(mapping, header, row);
    expect(result).toEqual({
      email: "a@example.com",
      firstName: "Jane",
      lastName: "Doe",
      customFields: { shirtSize: "Large" },
    });
  });

  it("ignores unmapped columns", () => {
    const mapping = { "Email Address": "email" };
    const row = ["a@example.com", "Jane", "Doe", "Large", "whatever"];
    const result = mapImportRow(mapping, header, row);
    expect(result).toEqual({ email: "a@example.com" });
  });

  it("returns {} when email is missing", () => {
    const mapping = { First: "firstName", Last: "lastName" };
    const row = ["", "Jane", "Doe", "", ""];
    const result = mapImportRow(mapping, header, row);
    expect(result).toEqual({});
  });

  it("returns {} when email column is blank", () => {
    const mapping = { "Email Address": "email", First: "firstName" };
    const row = ["   ", "Jane", "Doe", "", ""];
    const result = mapImportRow(mapping, header, row);
    expect(result).toEqual({});
  });
});
