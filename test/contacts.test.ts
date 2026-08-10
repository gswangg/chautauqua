import { describe, expect, it } from "vitest";
import {
  findDuplicateGroups,
  planMerge,
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
    expect(groups).toEqual([["1", "2"]]);
  });

  it("groups remainder by normalized name when emails differ/blank", () => {
    const contacts = [
      contact({ id: "1", email: "", firstName: "  Jane ", lastName: "Doe" }),
      contact({ id: "2", email: "", firstName: "jane", lastName: "  doe" }),
      contact({ id: "3", email: "", firstName: "Bob", lastName: "Smith" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([["1", "2"]]);
  });

  it("flags same-name same-company contacts even across different emails (DEC-143)", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe", company: "acme corp" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([["1", "2"]]);
  });

  it("does not flag same-name contacts with different companies", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe", company: "Beta Inc" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([]);
  });

  it("joins a blank-company contact into a named-company group (DEC-143)", () => {
    const contacts = [
      contact({ id: "1", email: "a@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Corp" }),
      contact({ id: "2", email: "b@example.com", firstName: "Jane", lastName: "Doe" }),
    ];
    const groups = findDuplicateGroups(contacts);
    expect(groups).toEqual([["1", "2"]]);
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
