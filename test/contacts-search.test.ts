import { describe, expect, it } from "vitest";
import { tokenizeContactQuery } from "../src/domain/contacts";
import { listContactsForOrg } from "../src/server/repo/contacts";
import { likeContains } from "../src/server/repo/like";
import type { AppEnv } from "../src/server/env";

describe("tokenizeContactQuery (DEC-266)", () => {
  it("lowercases and splits on whitespace, dropping empties", () => {
    expect(tokenizeContactQuery("Priya Raman")).toEqual(["priya", "raman"]);
    expect(tokenizeContactQuery("  priya   raman  ")).toEqual(["priya", "raman"]);
  });

  it("returns [] for blank/whitespace-only input", () => {
    expect(tokenizeContactQuery("")).toEqual([]);
    expect(tokenizeContactQuery("   ")).toEqual([]);
  });
});

describe("likeContains (DEC-333/DEC-336/DEC-506)", () => {
  it("wraps in % ... % without case-folding", () => {
    expect(likeContains("Priya")).toBe("%Priya%");
  });

  it("escapes backslash, percent and underscore", () => {
    expect(likeContains("100%_done\\now")).toBe("%100\\%\\_done\\\\now%");
  });

  it("a literal % in the query cannot widen into a wildcard match", () => {
    // Once escaped and paired with ESCAPE '\\' at the call site, a search
    // term of exactly "%" only matches values that literally contain "%".
    expect(likeContains("%")).toBe("%\\%%");
  });
});

// ---------------------------------------------------------------------------
// Repo-level: listContactsForOrg's default (no segmentId/no rules) path is
// two SQL statements — a count(*) and a paginated select — with no JS
// filter/sort/slice. Same fakeDb pattern as test/contacts-repo.test.ts.
// ---------------------------------------------------------------------------

function rawRow(id: string, firstName: string, lastName: string, email: string, company: string | null) {
  return {
    id,
    orgId: "org_1",
    firstName,
    lastName,
    email,
    phone: null,
    company,
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

describe("listContactsForOrg (DEC-333/DEC-336 default path: exactly two SQL statements)", () => {
  it("issues one count(*) and one paginated select, returning the fake db's rows unfiltered/unsorted in JS", async () => {
    // Deliberately NOT in name-sort order, so a passing test proves the
    // default path applies no JS filter/sort/slice of its own — whatever
    // order/rows the (fake) SQL query yields is what comes back verbatim.
    const rows = [
      rawRow("ct_3", "Zed", "Zephyr", "zed@example.com", null),
      rawRow("ct_1", "Ann", "Alpha", "ann@example.com", null),
    ];
    let selectCalls = 0;
    let sawCountQuery = false;
    let sawPaginatedQuery = false;
    const db = {
      select: (arg?: unknown) => {
        selectCalls += 1;
        if (arg !== undefined) {
          // select({ count: ... }) — the count(*) statement.
          return {
            from: () => ({
              where: async () => {
                sawCountQuery = true;
                return [{ count: rows.length }];
              },
            }),
          };
        }
        // select() — the paginated statement.
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: async () => {
                    sawPaginatedQuery = true;
                    return rows;
                  },
                }),
              }),
            }),
          }),
        };
      },
    } as unknown as AppEnv["Variables"]["db"];

    const result = await listContactsForOrg(db, "org_1", {
      page: 1,
      perPage: 50,
      q: null,
      segmentId: null,
      sort: "name",
      rules: [],
    });

    expect(selectCalls).toBe(2);
    expect(sawCountQuery).toBe(true);
    expect(sawPaginatedQuery).toBe(true);
    expect(result.items.map((r) => r.id)).toEqual(["ct_3", "ct_1"]);
    expect(result.total).toBe(2);
  });
});
