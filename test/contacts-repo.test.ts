import { describe, expect, it } from "vitest";
import {
  buildMergeRepointOps,
  compareContacts,
  parseContactListQuery,
  resolveImportUpsert,
  type ContactRow,
} from "../src/server/repo/contacts";
import { preflightRender, type RenderTarget } from "../src/domain/compose";

function row(overrides: Partial<ContactRow> & { id: string }): ContactRow {
  return {
    orgId: "org_1",
    firstName: "",
    lastName: "",
    email: "",
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("parseContactListQuery (DEC-013 pagination + DEC-026 filters)", () => {
  it("defaults page=1, perPage=50, sort=name, q/segmentId absent", () => {
    expect(parseContactListQuery({})).toEqual({
      page: 1,
      perPage: 50,
      q: null,
      segmentId: null,
      sort: "name",
    });
  });

  it("clamps perPage to 200 and falls back on bad page/perPage", () => {
    expect(parseContactListQuery({ page: "3", perPage: "500" })).toMatchObject({ page: 3, perPage: 200 });
    expect(parseContactListQuery({ page: "0", perPage: "-5" })).toMatchObject({ page: 1, perPage: 50 });
    expect(parseContactListQuery({ page: "abc" })).toMatchObject({ page: 1 });
  });

  it("trims q and treats blank q as absent", () => {
    expect(parseContactListQuery({ q: "  jane  " }).q).toBe("jane");
    expect(parseContactListQuery({ q: "   " }).q).toBeNull();
  });

  it("reads segmentId and the two sort orders", () => {
    expect(parseContactListQuery({ segmentId: "seg_1" }).segmentId).toBe("seg_1");
    expect(parseContactListQuery({ sort: "recent" }).sort).toBe("recent");
    expect(parseContactListQuery({ sort: "bogus" }).sort).toBe("name");
  });
});

describe("compareContacts (DEC-026 sort orders)", () => {
  it("sorts by lastName then firstName for 'name'", () => {
    const rows = [
      row({ id: "1", firstName: "Zoe", lastName: "Adams" }),
      row({ id: "2", firstName: "Amy", lastName: "Adams" }),
      row({ id: "3", firstName: "Bob", lastName: "Baker" }),
    ];
    const sorted = [...rows].sort(compareContacts("name"));
    expect(sorted.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by updatedAt desc for 'recent'", () => {
    const rows = [row({ id: "1", updatedAt: 100 }), row({ id: "2", updatedAt: 300 }), row({ id: "3", updatedAt: 200 })];
    const sorted = [...rows].sort(compareContacts("recent"));
    expect(sorted.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });
});

describe("resolveImportUpsert (DEC-026 CSV import upsert-by-email)", () => {
  it("creates a new contact when no existing id matches", () => {
    const result = resolveImportUpsert(undefined, { email: "a@example.com", firstName: "Ada", lastName: "Lovelace" });
    expect(result).toEqual({
      action: "create",
      values: { email: "a@example.com", firstName: "Ada", lastName: "Lovelace" },
    });
  });

  it("updates an existing contact, carrying only the mapped fields", () => {
    const result = resolveImportUpsert("ct_1", { email: "a@example.com", company: "Acme" });
    expect(result).toEqual({
      action: "update",
      id: "ct_1",
      patch: { company: "Acme" },
    });
  });

  it("throws (fail loudly) when the parsed row has no email", () => {
    expect(() => resolveImportUpsert(undefined, { firstName: "No Email" })).toThrow();
  });

  it("defaults firstName/lastName to empty strings on create when unmapped", () => {
    const result = resolveImportUpsert(undefined, { email: "b@example.com" });
    expect(result).toEqual({ action: "create", values: { email: "b@example.com", firstName: "", lastName: "" } });
  });
});

describe("buildMergeRepointOps (DEC-026 merge repoint plan)", () => {
  it("plans repoints for all four FK tables from mergeId to keepId", () => {
    const ops = buildMergeRepointOps("keep_1", "merge_1");
    expect(ops).toEqual([
      { table: "participant", from: "merge_1", to: "keep_1" },
      { table: "task_assignment", from: "merge_1", to: "keep_1" },
      { table: "email_log", from: "merge_1", to: "keep_1" },
      { table: "user", from: "merge_1", to: "keep_1" },
    ]);
  });

  it("fails loudly when asked to merge a contact into itself", () => {
    expect(() => buildMergeRepointOps("x", "x")).toThrow();
  });
});

describe("bulk-email atomicity (DEC-019 via preflightRender, DEC-026 whitelist)", () => {
  function target(overrides: Partial<RenderTarget> = {}): RenderTarget {
    return {
      contactId: "ct_1",
      submissionId: "",
      email: "ada@example.com",
      name: "Ada Lovelace",
      vars: { speaker_name: "Ada Lovelace", event_name: "DevCon", portal_link: "/portal" },
      ...overrides,
    };
  }

  it("sends to every recipient when all resolve against the speaker_name/event_name/portal_link whitelist", () => {
    const result = preflightRender(
      [target(), target({ contactId: "ct_2", vars: { speaker_name: "Bob", event_name: "DevCon", portal_link: "/claim/xyz" } })],
      "Hello {speaker_name}",
      "See you at {event_name}: {portal_link}",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.rendered).toHaveLength(2);
  });

  it("rejects the whole batch as 'invalid' (zero sends) when a submission-scoped field like {talk_title} is used", () => {
    const result = preflightRender([target(), target({ contactId: "ct_2" })], "Update on {talk_title}", "Hi {speaker_name}");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("invalid");
    // Every recipient is reported missing — none would be sent.
    expect(result.missing).toHaveLength(2);
  });

  it("rejects the whole batch when even one of several recipients is missing a resolvable field", () => {
    const goodTarget = target();
    const badTarget = target({ contactId: "ct_2", vars: { event_name: "DevCon", portal_link: "/portal" } }); // no speaker_name
    const result = preflightRender([goodTarget, badTarget], "Hi {speaker_name}", "See {event_name}");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.missing.some((m) => m.contactId === "ct_2" && m.field === "speaker_name")).toBe(true);
    // The one bad recipient rejects the entire batch (DEC-019): no partial
    // 'rendered' list is ever produced to hand to a sender.
    expect("rendered" in result).toBe(false);
  });
});
