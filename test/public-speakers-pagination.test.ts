// DEC-418 part 2: getPublicSpeakers must bound the DISTINCT-contact id query
// (LIMIT page*perPage) but NEVER the fanned-out (speaker x session)
// hydration rows -- a speaker with many sessions must never be truncated
// mid-session-list. Fake-db recording style established in
// test/headshot-gate.test.ts / test/public.test.ts: no local sqlite/D1 test
// driver is wired up (see package.json), so this records the shape of the
// drizzle calls (which query got .limit(), what value, which ids the
// hydration where() carried) rather than executing real SQL.

import { describe, expect, it } from "vitest";
import { getPublicSpeakers } from "../src/server/repo/public/speakers";
import type { Db } from "../src/server/context";

/** Recursively collects every bound-parameter value (drizzle `Param` leaf)
 * out of a drizzle SQL condition tree, so a test can assert which ids/values
 * a `.where(...)` call actually carries without needing a real dialect. */
function collectParams(node: unknown, out: unknown[], seen: Set<unknown>): void {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  const ctor = (node as { constructor?: { name?: string } }).constructor;
  if (ctor && ctor.name === "Param") {
    out.push((node as { value: unknown }).value);
    return;
  }
  if (Array.isArray(node)) {
    for (const c of node) collectParams(c, out, seen);
    return;
  }
  const chunks = (node as { queryChunks?: unknown }).queryChunks;
  if (Array.isArray(chunks)) {
    for (const c of chunks) collectParams(c, out, seen);
  }
}

function paramsOf(cond: unknown): unknown[] {
  const out: unknown[] = [];
  collectParams(cond, out, new Set());
  return out;
}

interface Call {
  kind: "selectDistinct" | "select";
  fields: Record<string, unknown>;
  whereArg?: unknown;
  limitArg?: number;
  orderByCalled: boolean;
}

/** Speaker rows keyed by contactId -- each entry can carry any number of
 * (submissionId, submissionTitle) pairs, so a fanned-out speaker is
 * represented faithfully. */
interface FakeSpeakerRow {
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  headshotUrl: string | null;
  bio: string | null;
  submissionId: string;
  submissionTitle: string;
}

function fakeDb(opts: { idOrder: string[]; total: number; rowsByContact: Map<string, FakeSpeakerRow[]> }) {
  const calls: Call[] = [];
  let selectCallIndex = 0;

  function makeChain(kind: Call["kind"], fields: Record<string, unknown>, resolveRows: () => unknown[]) {
    const call: Call = { kind, fields, orderByCalled: false };
    calls.push(call);
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: (arg: unknown) => {
        call.whereArg = arg;
        return chain;
      },
      orderBy: (..._args: unknown[]) => {
        call.orderByCalled = true;
        return chain;
      },
      limit: (n: number) => {
        call.limitArg = n;
        return Promise.resolve(resolveRows());
      },
      then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resolveRows()).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    selectDistinct: (fields: Record<string, unknown>) => {
      selectCallIndex += 1;
      return makeChain("selectDistinct", fields, () => opts.idOrder.map((contactId) => ({ contactId })));
    },
    select: (fields: Record<string, unknown>) => {
      selectCallIndex += 1;
      // First select() call after the id query is the count; every
      // subsequent select() is a hydration batch.
      const isCount = "total" in fields;
      if (isCount) {
        return makeChain("select", fields, () => [{ total: opts.total }]);
      }
      // Hydration: resolve rows for every requested contact id, regardless
      // of any bound applied elsewhere -- the fake doesn't filter by the
      // where() arg itself (that's asserted separately via paramsOf), it
      // just returns everything so the "keeps ALL sessions" behavior can be
      // observed end-to-end.
      const rows: FakeSpeakerRow[] = [];
      for (const id of opts.idOrder) {
        rows.push(...(opts.rowsByContact.get(id) ?? []));
      }
      return makeChain("select", fields, () => rows);
    },
  } as unknown as Db;

  return { db, calls: () => calls };
}

const BASE_ROW = {
  firstName: "A",
  lastName: "Speaker",
  title: "Title",
  company: "Co",
  headshotUrl: null,
  bio: null,
};

describe("getPublicSpeakers (DEC-418 part 2)", () => {
  it("bounds the distinct-id query with LIMIT page*perPage, and applies no LIMIT to the hydration query", async () => {
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([
      ["c1", [{ ...BASE_ROW, contactId: "c1", submissionId: "s1", submissionTitle: "Talk 1" }]],
      ["c2", [{ ...BASE_ROW, contactId: "c2", submissionId: "s2", submissionTitle: "Talk 2" }]],
    ]);
    const { db, calls } = fakeDb({ idOrder: ["c1", "c2"], total: 2, rowsByContact });

    await getPublicSpeakers(db, "ev1", { page: 1, perPage: 20 });

    const allCalls = calls();
    const idCall = allCalls.find((c) => c.kind === "selectDistinct");
    expect(idCall).toBeDefined();
    expect(idCall!.limitArg).toBe(20);

    const hydrateCalls = allCalls.filter((c) => c.kind === "select" && !("total" in c.fields));
    expect(hydrateCalls.length).toBeGreaterThan(0);
    for (const hc of hydrateCalls) {
      expect(hc.limitArg).toBeUndefined();
    }
  });

  it("takes total from the count query, not the (bounded) id query's row count", async () => {
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([
      ["c1", [{ ...BASE_ROW, contactId: "c1", submissionId: "s1", submissionTitle: "Talk 1" }]],
    ]);
    const { db } = fakeDb({ idOrder: ["c1"], total: 57, rowsByContact });

    const { total, items } = await getPublicSpeakers(db, "ev1", { page: 1, perPage: 1 });
    expect(total).toBe(57);
    expect(items).toHaveLength(1);
  });

  it("keeps ALL sessions for a speaker even when the page bound is smaller than the fanned row count", async () => {
    const manySessions: FakeSpeakerRow[] = Array.from({ length: 12 }, (_, i) => ({
      ...BASE_ROW,
      contactId: "c1",
      submissionId: `s${i}`,
      submissionTitle: `Talk ${i}`,
    }));
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([["c1", manySessions]]);
    // page*perPage = 1, far smaller than the 12 fanned-out rows this one
    // speaker owns -- none of their sessions may be dropped.
    const { db } = fakeDb({ idOrder: ["c1"], total: 1, rowsByContact });

    const { items } = await getPublicSpeakers(db, "ev1", { page: 1, perPage: 1 });
    expect(items).toHaveLength(1);
    expect(items[0]!.sessions).toHaveLength(12);
  });

  it("applies the q filter to both the id query and the count query", async () => {
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([
      ["c1", [{ ...BASE_ROW, contactId: "c1", submissionId: "s1", submissionTitle: "Talk 1" }]],
    ]);
    const { db, calls } = fakeDb({ idOrder: ["c1"], total: 1, rowsByContact });

    await getPublicSpeakers(db, "ev1", { q: "ada", page: 1, perPage: 20 });

    const allCalls = calls();
    const idCall = allCalls.find((c) => c.kind === "selectDistinct");
    const countCall = allCalls.find((c) => c.kind === "select" && "total" in c.fields);
    expect(idCall!.whereArg).toBeDefined();
    expect(countCall!.whereArg).toBeDefined();

    const idParams = paramsOf(idCall!.whereArg).map(String);
    const countParams = paramsOf(countCall!.whereArg).map(String);
    expect(idParams.some((p) => p.includes("ada"))).toBe(true);
    expect(countParams.some((p) => p.includes("ada"))).toBe(true);
  });

  it("preserves step-1 id order (lastName, firstName) when grouping the hydrated rows", async () => {
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([
      ["c2", [{ ...BASE_ROW, contactId: "c2", lastName: "Zed", submissionId: "s2", submissionTitle: "Talk 2" }]],
      ["c1", [{ ...BASE_ROW, contactId: "c1", lastName: "Adams", submissionId: "s1", submissionTitle: "Talk 1" }]],
    ]);
    // idOrder reflects the (already-sorted) step-1 query result, not
    // insertion order.
    const { db } = fakeDb({ idOrder: ["c1", "c2"], total: 2, rowsByContact });

    const { items } = await getPublicSpeakers(db, "ev1", { page: 1, perPage: 20 });
    expect(items.map((i) => i.contactId)).toEqual(["c1", "c2"]);
  });
});
