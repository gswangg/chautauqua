import { describe, expect, it } from "vitest";
import { matchesContactQuery, tokenizeContactQuery, type ContactRecord } from "../src/domain/contacts";
import { listContactsForOrg } from "../src/server/repo/contacts";
import type { AppEnv } from "../src/server/env";

function contact(overrides: Partial<ContactRecord> & { id: string }): ContactRecord {
  return {
    email: "",
    firstName: "",
    lastName: "",
    ...overrides,
  };
}

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

describe("matchesContactQuery (DEC-266 AND-tokens x OR-columns)", () => {
  const priya = contact({ id: "1", firstName: "Priya", lastName: "Raman", email: "priya@acme.com", company: "Acme" });

  it("matches a two-word 'firstName lastName' query (the reported defect)", () => {
    expect(matchesContactQuery(tokenizeContactQuery("Priya Raman"), priya)).toBe(true);
  });

  it("matches when the tokens are reversed (order-independent)", () => {
    expect(matchesContactQuery(tokenizeContactQuery("raman priya"), priya)).toBe(true);
  });

  it("matches across two different columns (name + company)", () => {
    expect(matchesContactQuery(tokenizeContactQuery("priya acme"), priya)).toBe(true);
  });

  it("does not match when one token has no substring match anywhere", () => {
    expect(matchesContactQuery(tokenizeContactQuery("priya nomatch"), priya)).toBe(false);
  });

  it("blank query behaves as no filter (matches everything)", () => {
    expect(matchesContactQuery(tokenizeContactQuery("   "), priya)).toBe(true);
    expect(matchesContactQuery([], priya)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesContactQuery(tokenizeContactQuery("PRIYA RAMAN"), priya)).toBe(true);
    // Column values are compared case-insensitively even against an already-
    // lowercase token, against an all-caps-named contact.
    const upperCaseContact = contact({ id: "2", firstName: "PRIYA", lastName: "RAMAN", email: "" });
    expect(matchesContactQuery(["priya"], upperCaseContact)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Repo-level: listContactsForOrg narrows via the SQL OR-prefilter then the
// exact AND x OR in-memory pass, same fakeDb pattern as test/contacts-repo.test.ts.
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

describe("listContactsForOrg (DEC-266 repo-level narrowing)", () => {
  it("SQL prefilter returns a superset (both tokens present, but split across two rows); in-memory pass narrows to the true AND x OR match, and total reflects the filtered count", async () => {
    // Simulates: SQL WHERE org=org_1 AND (token 'priya' OR token 'raman' matches
    // any column) returning every row that contains AT LEAST ONE of the tokens
    // somewhere — a superset of the true "Priya Raman" match.
    const priyaRaman = rawRow("ct_1", "Priya", "Raman", "priya.raman@acme.com", "Acme");
    // Contains 'priya' only (superset row the SQL OR-prefilter would return,
    // but the true AND predicate must reject it).
    const priyaOnly = rawRow("ct_2", "Priya", "Nomatch", "priya.nomatch@example.com", null);
    // Contains 'raman' only.
    const ramanOnly = rawRow("ct_3", "Someone", "Raman", "someone.raman@example.com", null);

    const selectRows = [priyaRaman, priyaOnly, ramanOnly];
    const db = {
      select: () => ({
        from: () => ({
          where: async () => selectRows,
        }),
      }),
    } as unknown as AppEnv["Variables"]["db"];

    const result = await listContactsForOrg(db, "org_1", {
      page: 1,
      perPage: 50,
      q: "Priya Raman",
      segmentId: null,
      sort: "name",
      rules: [],
    });

    expect(result.items.map((r) => r.id)).toEqual(["ct_1"]);
    expect(result.total).toBe(1);
  });
});
