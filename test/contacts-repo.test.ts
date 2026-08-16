import { describe, expect, it } from "vitest";
import {
  buildMergeRepointOps,
  compareContacts,
  mergeContacts,
  parseContactListQuery,
  resolveImportUpsert,
  type ContactRow,
} from "../src/server/repo/contacts";
import { readContactSortToken } from "../src/server/repo/contacts/query";
import * as schema from "../src/db/schema";
import { preflightRender, type RenderTarget } from "../src/domain/compose";
import type { AppEnv } from "../src/server/env";

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
      rules: [],
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
  });

  it("throws loudly on an unknown sort token (DEC-843 wave-63 amendment)", () => {
    expect(() => parseContactListQuery({ sort: "bogus" })).toThrow("Unknown sort 'bogus'");
  });

  it("defaults rules to [] and threads a passed-in rules array through unchanged (DEC-149)", () => {
    expect(parseContactListQuery({})).toMatchObject({ rules: [] });
    const rules = [{ field: "any", op: "contains" as const, value: "ada" }];
    expect(parseContactListQuery({}, rules)).toMatchObject({ rules });
  });
});

describe("readContactSortToken (DEC-843 wave-63 amendment)", () => {
  it("returns 'name' for undefined and for blank-after-trim", () => {
    expect(readContactSortToken(undefined)).toBe("name");
    expect(readContactSortToken("   ")).toBe("name");
  });

  it("returns 'name' and 'recent' for their own tokens", () => {
    expect(readContactSortToken("name")).toBe("name");
    expect(readContactSortToken("recent")).toBe("recent");
  });

  it("throws a plain Error naming an unknown token", () => {
    expect(() => readContactSortToken("recnet")).toThrow("Unknown sort 'recnet'");
  });
});

// Multi-word directory search tokenization is DEC-266 and lives in the pure
// core (tokenizeContactQuery / matchesContactQuery, src/domain/contacts.ts);
// its tests live in test/contacts-search.test.ts. The w3-b repo-local
// tokenizeContactSearchQuery was superseded by that pure pair on merge.

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

  // DEC-575: a blank-after-trim cell on update means "no value supplied",
  // never "clear this field" -- the mapped-but-empty column is omitted from
  // the patch, and customFields merge key-by-key into the stored blob
  // rather than replacing it.
  it("omits a mapped-but-blank standard field from the update patch instead of clearing it", () => {
    const result = resolveImportUpsert("ct_1", { email: "a@example.com", bio: "", company: "Acme" });
    expect(result).toEqual({
      action: "update",
      id: "ct_1",
      patch: { company: "Acme" },
    });
  });

  it("treats a whitespace-only cell as blank on update", () => {
    const result = resolveImportUpsert("ct_1", { email: "a@example.com", bio: "   ", title: "  \t " });
    expect(result).toEqual({ action: "update", id: "ct_1", patch: {} });
  });

  it("merges customFields key-by-key into the existing stored object, skipping blank values", () => {
    const result = resolveImportUpsert(
      "ct_1",
      { email: "a@example.com", customFields: { badge: "", talkTitle: "New Talk" } },
      { badge: "VIP", dietary: "Vegan" },
    );
    expect(result).toEqual({
      action: "update",
      id: "ct_1",
      patch: { customFields: { badge: "VIP", dietary: "Vegan", talkTitle: "New Talk" } },
    });
  });

  it("blank cell on create leaves the field unset (create is unaffected by DEC-575)", () => {
    const result = resolveImportUpsert(undefined, { email: "c@example.com", bio: "" });
    expect(result).toEqual({
      action: "create",
      values: { email: "c@example.com", firstName: "", lastName: "", bio: "" },
    });
  });
});

describe("buildMergeRepointOps (DEC-282 merge repoint plan)", () => {
  it("plans repoints for all seven FK tables from mergeId to keepId, in order", () => {
    const ops = buildMergeRepointOps("keep_1", "merge_1");
    expect(ops).toEqual([
      { table: "user", from: "merge_1", to: "keep_1" },
      { table: "participant", from: "merge_1", to: "keep_1" },
      { table: "task_assignment", from: "merge_1", to: "keep_1" },
      { table: "email_log", from: "merge_1", to: "keep_1" },
      { table: "file", from: "merge_1", to: "keep_1" },
      { table: "file_comment", from: "merge_1", to: "keep_1" },
      { table: "pipeline_entry", from: "merge_1", to: "keep_1" },
    ]);
  });

  it("fails loudly when asked to merge a contact into itself", () => {
    expect(() => buildMergeRepointOps("x", "x")).toThrow();
  });
});

describe("mergeContacts (DEC-101 participant dedupe + six-table FK repoint)", () => {
  const KEEP_ID = "ct_keep";
  const MERGE_ID = "ct_merge";

  function contactRaw(id: string, email: string) {
    return {
      id,
      orgId: "org_1",
      firstName: "First",
      lastName: "Last",
      email,
      phone: null,
      company: null,
      title: null,
      bio: null,
      headshotUrl: null,
      socialLinksJson: null,
      notes: null,
      customFieldsJson: null,
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
    };
  }

  function makeSelectChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  /** Records every update()/delete() call (with the drizzle table object it
   * targeted, by reference) and feeds queued select() row sets in order. */
  function fakeDb(selectQueue: unknown[][]) {
    let call = 0;
    const updates: { table: unknown; vals: unknown }[] = [];
    const deletes: { table: unknown }[] = [];
    const db = {
      select: () => {
        const rows = selectQueue[call] ?? [];
        call += 1;
        return makeSelectChain(rows);
      },
      update: (table: unknown) => ({
        set: (vals: unknown) => ({
          where: async () => {
            updates.push({ table, vals });
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: async () => {
          deletes.push({ table });
        },
      }),
    };
    return { db: db as unknown as AppEnv["Variables"]["db"], updates, deletes };
  }

  it("repoints file and file_comment (and the other five tables) from mergeId to keepId", async () => {
    const { db, updates, deletes } = fakeDb([
      // DEC-026 wave-43 amendment: mergeContacts runs a whole-operation
      // preflight before ANY pair's fold begins -- it reads every contact in
      // the id list (planMergeFold), then one chunked login select over
      // [keepId, ...mergeIds] and one chunked select of the user rows owning
      // the fold's intermediate merged emails. Four selects, ahead of the
      // per-pair sequence below.
      [contactRaw(KEEP_ID, "keep@example.com")], // preflight findContactById(keepId)
      [contactRaw(MERGE_ID, "merge@example.com")], // preflight findContactById(mergeId)
      [], // preflight: user rows whose contactId is in [keepId, mergeId]
      [], // preflight: user rows owning an intermediate merged email
      [contactRaw(KEEP_ID, "keep@example.com")], // findContactById(keepId)
      [contactRaw(MERGE_ID, "merge@example.com")], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) DEC-479 email conflict pre-check
      [], // mergeParticipants (none)
      [], // keepParticipants (none)
      [], // task_assignment rows for mergeId
      [], // task_assignment rows for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [contactRaw(KEEP_ID, "keep@example.com")], // findContactById(keepId) after merge
    ]);

    const result = await mergeContacts(db, KEEP_ID, [MERGE_ID]);
    expect(result.id).toBe(KEEP_ID);

    // 1 contact-fields update (planMerge) + 7 FK repoints (DEC-282) + 1
    // DEC-479 user.email cascade (unconditional, mirroring patchContact) = 9.
    expect(updates).toHaveLength(9);
    expect(updates.some((u) => u.table === schema.file && (u.vals as any).uploadedByContactId === KEEP_ID)).toBe(true);
    expect(updates.some((u) => u.table === schema.fileComment && (u.vals as any).authorContactId === KEEP_ID)).toBe(true);
    expect(updates.some((u) => u.table === schema.participant && (u.vals as any).contactId === KEEP_ID)).toBe(true);
    expect(updates.some((u) => u.table === schema.taskAssignment && (u.vals as any).contactId === KEEP_ID)).toBe(true);
    expect(updates.some((u) => u.table === schema.emailLog && (u.vals as any).contactId === KEEP_ID)).toBe(true);
    expect(updates.some((u) => u.table === schema.user && (u.vals as any).contactId === KEEP_ID)).toBe(true);
    expect(updates.some((u) => u.table === schema.user && (u.vals as any).email === "keep@example.com")).toBe(true);

    // No participant dedupe-delete fires because the two contacts shared no
    // submissions -- just the DEC-770 amendment's dismissal-cascade delete
    // (unconditional, always runs immediately before the contact delete)
    // and the merged contact row itself.
    expect(deletes).toHaveLength(2);
    expect(deletes[0]?.table).toBe(schema.contactDuplicateDismissal);
    expect(deletes[1]?.table).toBe(schema.contact);
  });

  it("dedupes: deletes mergeId's participant row for a shared submission instead of repointing it, but still repoints its row on a distinct submission", async () => {
    const { db, updates, deletes } = fakeDb([
      // Four whole-operation preflight selects (see the test above).
      [contactRaw(KEEP_ID, "keep@example.com")], // preflight findContactById(keepId)
      [contactRaw(MERGE_ID, "merge@example.com")], // preflight findContactById(mergeId)
      [], // preflight: user rows whose contactId is in [keepId, mergeId]
      [], // preflight: user rows owning an intermediate merged email
      [contactRaw(KEEP_ID, "keep@example.com")], // findContactById(keepId)
      [contactRaw(MERGE_ID, "merge@example.com")], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) DEC-479 email conflict pre-check
      [
        { id: "part_shared_merge", submissionId: "sub_shared" },
        { id: "part_distinct_merge", submissionId: "sub_only_merge" },
      ], // mergeParticipants
      [{ submissionId: "sub_shared" }], // keepParticipants
      [], // task_assignment rows for mergeId
      [], // task_assignment rows for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [contactRaw(KEEP_ID, "keep@example.com")], // findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP_ID, [MERGE_ID]);

    // The dedupe-delete of the shared-submission participant row happens
    // before the DEC-770 amendment's dismissal-cascade delete, which in
    // turn happens immediately before the deletion of the merged contact
    // row itself.
    expect(deletes).toHaveLength(3);
    expect(deletes[0]?.table).toBe(schema.participant);
    expect(deletes[1]?.table).toBe(schema.contactDuplicateDismissal);
    expect(deletes[2]?.table).toBe(schema.contact);

    // The plain participant-repoint update still runs unconditionally
    // (DEC-101): it's a no-op for the shared row (already deleted) and
    // repoints the distinct-submission row.
    expect(updates.some((u) => u.table === schema.participant)).toBe(true);
  });

  it("preserves duplicate-only bio/headshotUrl/phone/notes/social links onto the kept row (DEC-167)", async () => {
    const keepRaw = { ...contactRaw(KEEP_ID, "keep@example.com") };
    const mergeRaw = {
      ...contactRaw(MERGE_ID, "merge@example.com"),
      phone: "555-9999",
      bio: "Duplicate-only bio.",
      headshotUrl: "https://example.com/dup-headshot.jpg",
      notes: "Duplicate-only notes.",
      socialLinksJson: JSON.stringify({ twitter: "@dup", linkedin: "dup-linkedin" }),
    };
    const { db, updates } = fakeDb([
      // Four whole-operation preflight selects (see the first merge test).
      [keepRaw], // preflight findContactById(keepId)
      [mergeRaw], // preflight findContactById(mergeId)
      [], // preflight: user rows whose contactId is in [keepId, mergeId]
      [], // preflight: user rows owning an intermediate merged email
      [keepRaw], // findContactById(keepId)
      [mergeRaw], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) DEC-479 email conflict pre-check
      [], // mergeParticipants (none)
      [], // keepParticipants (none)
      [], // task_assignment rows for mergeId
      [], // task_assignment rows for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [keepRaw], // findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP_ID, [MERGE_ID]);

    const contactFieldsUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactFieldsUpdate).toBeDefined();
    const vals = contactFieldsUpdate!.vals as any;
    expect(vals.phone).toBe("555-9999");
    expect(vals.bio).toBe("Duplicate-only bio.");
    expect(vals.headshotUrl).toBe("https://example.com/dup-headshot.jpg");
    expect(vals.notes).toBe("Duplicate-only notes.");
    expect(JSON.parse(vals.socialLinksJson)).toEqual({ twitter: "@dup", linkedin: "dup-linkedin" });
  });
});

describe("bulk-email atomicity (DEC-019 via preflightRender, DEC-026 whitelist)", () => {
  function target(overrides: Partial<RenderTarget> = {}): RenderTarget {
    return {
      contactId: "ct_1",
      submissionId: "",
      email: "ada@example.com",
      name: "Ada Lovelace",
      ref: "",
      scheduled: false,
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
    expect(result.missing.some((m) => m.contactId === "ct_2" && m.fields.includes("speaker_name"))).toBe(true);
    // The one bad recipient rejects the entire batch (DEC-019): no partial
    // 'rendered' list is ever produced to hand to a sender.
    expect("rendered" in result).toBe(false);
  });
});
