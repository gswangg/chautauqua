// Regression for DEC-554 (part 1): findDuplicateGroupsForOrg must not scan
// the whole contact directory unbounded. It projects only the columns the
// duplicate-grouping domain logic reads, orders deterministically, and
// refuses (rather than silently truncating) once an org's contact count
// exceeds MAX_CONTACT_DIRECTORY_SCAN.

import { describe, expect, it } from "vitest";
import type { Db } from "../src/server/context";
import { findDuplicateGroupsForOrg } from "../src/server/repo/contacts/merge";
import { MAX_CONTACT_DIRECTORY_SCAN } from "../src/server/repo/contacts/rows";
import { ApiError } from "../src/server/http";

interface FakeRow {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string | null;
  [key: string]: unknown;
}

function makeFakeDb(rows: FakeRow[]) {
  let capturedProjection: Record<string, unknown> | undefined;
  let orderByCalled = false;
  let capturedLimit: number | undefined;

  const db = {
    select(projection: Record<string, unknown>) {
      capturedProjection = projection;
      return {
        from(_table: unknown) {
          return {
            where(_cond: unknown) {
              return {
                orderBy(_ord: unknown) {
                  orderByCalled = true;
                  return {
                    limit(n: number) {
                      capturedLimit = n;
                      // Project the fake rows down to exactly the requested
                      // keys, same as a real column-projected SELECT would,
                      // then apply the row cap.
                      const keys = Object.keys(projection);
                      const projected = rows.slice(0, n).map((r) => {
                        const out: Record<string, unknown> = {};
                        for (const k of keys) {
                          out[k] = r[k] ?? (k === "company" ? null : "");
                        }
                        return out;
                      });
                      return Promise.resolve(projected);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Db;

  return {
    db,
    getProjection: () => capturedProjection,
    getOrderByCalled: () => orderByCalled,
    getLimit: () => capturedLimit,
  };
}

describe("findDuplicateGroupsForOrg scan bounds (DEC-554)", () => {
  it("projects exactly the columns the duplicate-grouping domain logic reads", async () => {
    const { db, getProjection } = makeFakeDb([]);
    await findDuplicateGroupsForOrg(db, "org1");
    const projection = getProjection();
    expect(projection).toBeDefined();
    expect(Object.keys(projection!).sort()).toEqual(["company", "email", "firstName", "id", "lastName"]);
  });

  it("that column set is a superset of every field findDuplicateGroups reads: grouping still works with each other column missing", async () => {
    // Two contacts share email -> should group regardless of missing name/company.
    const { db } = makeFakeDb([
      { id: "a", email: "same@example.com", firstName: "", lastName: "", company: null },
      { id: "b", email: "same@example.com", firstName: "", lastName: "", company: null },
    ]);
    const groups = await findDuplicateGroupsForOrg(db, "org1");
    expect(groups.length).toBe(1);
    expect(groups[0]!.contactIds.sort()).toEqual(["a", "b"]);

    // Two contacts share name+company (missing email) -> should still group.
    const { db: db2 } = makeFakeDb([
      { id: "c", email: "", firstName: "Ann", lastName: "Lee", company: "Acme" },
      { id: "d", email: "", firstName: "Ann", lastName: "Lee", company: "Acme" },
    ]);
    const groups2 = await findDuplicateGroupsForOrg(db2, "org1");
    expect(groups2.length).toBe(1);
    expect(groups2[0]!.contactIds.sort()).toEqual(["c", "d"]);
  });

  it("applies an orderBy for deterministic paging", async () => {
    const { db, getOrderByCalled } = makeFakeDb([]);
    await findDuplicateGroupsForOrg(db, "org1");
    expect(getOrderByCalled()).toBe(true);
  });

  it("requests MAX_CONTACT_DIRECTORY_SCAN + 1 rows", async () => {
    const { db, getLimit } = makeFakeDb([]);
    await findDuplicateGroupsForOrg(db, "org1");
    expect(getLimit()).toBe(MAX_CONTACT_DIRECTORY_SCAN + 1);
  });

  it("returns normally at exactly MAX_CONTACT_DIRECTORY_SCAN rows, throws ApiError('invalid') at one more", async () => {
    const atCap = Array.from({ length: MAX_CONTACT_DIRECTORY_SCAN }, (_, i) => ({
      id: `id-${i}`,
      email: `person${i}@example.com`,
      firstName: "F",
      lastName: "L",
      company: null,
    }));
    const { db: dbAtCap } = makeFakeDb(atCap);
    await expect(findDuplicateGroupsForOrg(dbAtCap, "org1")).resolves.toBeDefined();

    const overCap = [
      ...atCap,
      { id: "id-over", email: "over@example.com", firstName: "F", lastName: "L", company: null },
    ];
    const { db: dbOverCap } = makeFakeDb(overCap);
    let caught: unknown;
    try {
      await findDuplicateGroupsForOrg(dbOverCap, "org1");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("invalid");
  });

  it("produces the same groups in the same order as before for an existing duplicate-grouping case", async () => {
    const { db } = makeFakeDb([
      { id: "z9", email: "dup@example.com", firstName: "Zed", lastName: "Zoo", company: null },
      { id: "a1", email: "dup@example.com", firstName: "Zed", lastName: "Zoo", company: null },
      { id: "m5", email: "unique@example.com", firstName: "Sam", lastName: "Ng", company: "Acme" },
      { id: "m6", email: "unique2@example.com", firstName: "Sam", lastName: "Ng", company: "Acme" },
    ]);
    const groups = await findDuplicateGroupsForOrg(db, "org1");
    // DEC-466 sorts groups by each group's own first contactId (pre-sort,
    // in scan order): "m5" < "z9", so the Sam Ng group sorts first.
    expect(groups.length).toBe(2);
    expect(groups[0]!.contactIds.sort()).toEqual(["m5", "m6"]);
    expect(groups[1]!.contactIds.sort()).toEqual(["a1", "z9"]);
    expect(groups[0]!.contacts.map((c) => c.id).sort()).toEqual(["m5", "m6"]);
  });
});
