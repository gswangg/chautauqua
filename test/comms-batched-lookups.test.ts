// DEC-530: buildRenderTargets (compose preview/send) and CRM bulk email used
// to loop the expanded recipient list and await repo.listFeedbackComments +
// repo.findAccountUserId once PER RECIPIENT — up to 200 sequential D1 round
// trips at the DEC-019 100-recipient cap, and it ran on POST
// /compose/preview too. This file covers:
//   1. findAccountUserIds agrees with the singular findAccountUserId on the
//      four discriminating cases (DEC-456: contact_id OR email, never email
//      alone) — a batch that quietly narrowed to email-only would mint
//      claim links for contacts who already have logins.
//   2. buildRenderTargets issues exactly one feedback query and one account
//      query for a 3-submission / 5-recipient compose preview, not one per
//      recipient.
//   3. A co-speaker pair on one submission still each receive the identical
//      feedback block (the batched query must not silently drop the
//      re-associate-by-submission step).

import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { findAccountUserId, findAccountUserIds } from "../src/server/repo/comms";
import { buildRenderTargets } from "../src/routes/comms";
import type { ComposeSubmission } from "../src/domain/compose";

// ---------------------------------------------------------------------------
// Shared fake db: distinguishes queries by their selected-column shape
// (this repo has no local sqlite/D1 test driver — see
// test/comms-invite-scope.test.ts's header comment) and counts calls.
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  contactId: string | null;
  email: string;
}

function makeSelectChain(rows: unknown[], onWhere?: (cond: unknown) => unknown[] | void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      const filtered = onWhere?.(cond);
      return filtered ? makeSelectChain(filtered) : chain;
    },
    orderBy: () => chain,
    limit: (n: number) => makeSelectChain(rows.slice(0, n)),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Mirrors test/comms-invite-scope.test.ts's walkCondition helper: this repo
// has no local sqlite/D1 test driver, so the fake db's WHERE step interprets
// the real drizzle condition tree well enough to filter user rows by the
// bound contact_id/email literals — a faithful-enough double for both the
// singular equality query and the batched inArray query to be exercised
// against the SAME row fixtures and produce comparable results.
function collectLiteralValues(node: unknown, seen = new Set<unknown>(), out: Set<string> = new Set()): Set<string> {
  // drizzle's sql`` template interpolates raw string params as bare string
  // leaves inside queryChunks (not always wrapped in a Param object), so a
  // leaf string must be captured before the object-only guard below.
  if (typeof node === "string") {
    out.add(node);
    return out;
  }
  if (node === null || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const c of node) collectLiteralValues(c, seen, out);
    return out;
  }
  const n = node as Record<string, unknown>;
  if (typeof n.value === "string") out.add(n.value);
  if (Array.isArray(n.value)) {
    for (const v of n.value) {
      if (typeof v === "string") out.add(v);
      else collectLiteralValues(v, seen, out);
    }
  }
  if (Array.isArray(n.queryChunks)) collectLiteralValues(n.queryChunks, seen, out);
  return out;
}

function makeUserLookupDb(userRows: UserRow[]) {
  let selectCalls = 0;
  const db = {
    select: (_proj: Record<string, unknown>) => {
      selectCalls += 1;
      return makeSelectChain(userRows, (cond) => {
        const literals = new Set([...collectLiteralValues(cond)].map((v) => v.toLowerCase()));
        return userRows.filter((r) => (r.contactId && literals.has(r.contactId.toLowerCase())) || literals.has(r.email.toLowerCase()));
      });
    },
  } as unknown as AppEnv["Variables"]["db"];
  return { db, getSelectCalls: () => selectCalls };
}

// ---------------------------------------------------------------------------
// 1. Contract test: findAccountUserIds agrees with findAccountUserId on the
//    four discriminating cases.
// ---------------------------------------------------------------------------

describe("findAccountUserIds contract-matches findAccountUserId (DEC-456)", () => {
  const userRows: UserRow[] = [
    // contact-id hit only: email on the user row has drifted from the param.
    { id: "user-contact-hit", contactId: "ct-contact-only", email: "stale@example.com" },
    // email-hit only: contact_id on the user row doesn't match the param's contactId.
    { id: "user-email-hit", contactId: "ct-someone-else", email: "email-only@example.com" },
    // both: same user row satisfies both keys for this contact.
    { id: "user-both-hit", contactId: "ct-both", email: "both@example.com" },
  ];

  const cases: { name: string; params: { contactId: string; email: string }; expected: string | null }[] = [
    { name: "contact-id hit only", params: { contactId: "ct-contact-only", email: "fresh@example.com" }, expected: "user-contact-hit" },
    { name: "email-hit only (email drifted from linked user row)", params: { contactId: "ct-no-such-contact", email: "EMAIL-ONLY@example.com" }, expected: "user-email-hit" },
    { name: "both", params: { contactId: "ct-both", email: "both@example.com" }, expected: "user-both-hit" },
    { name: "neither", params: { contactId: "ct-nobody", email: "nobody@example.com" }, expected: null },
  ];

  for (const tc of cases) {
    it(`agrees on: ${tc.name}`, async () => {
      const { db: singularDb } = makeUserLookupDb(userRows);
      const singular = await findAccountUserId(singularDb, tc.params);

      const { db: batchDb } = makeUserLookupDb(userRows);
      const batched = await findAccountUserIds(batchDb, [tc.params]);

      expect(singular).toBe(tc.expected);
      expect(batched.get(tc.params.contactId)).toBe(tc.expected);
      expect(batched.get(tc.params.contactId)).toBe(singular);
    });
  }

  it("keys the returned map by contactId for every requested pair, including misses", async () => {
    const { db } = makeUserLookupDb(userRows);
    const params = cases.map((c) => c.params);
    const result = await findAccountUserIds(db, params);
    for (const tc of cases) {
      expect(result.has(tc.params.contactId)).toBe(true);
      expect(result.get(tc.params.contactId)).toBe(tc.expected);
    }
  });
});

// ---------------------------------------------------------------------------
// 2 + 3. buildRenderTargets: one batched query pass, and co-speakers on the
//    same submission still each get the identical feedback block.
// ---------------------------------------------------------------------------

const event = { id: "evt-1", name: "DevCon", recordPrefix: "DEV", startDate: "2026-09-01", endDate: "2026-09-03" };
const feedbackScope = { planId: "plan-1", round: 1 };

const submissions: ComposeSubmission[] = [
  {
    id: "sub-1",
    title: "Talk One",
    seq: 1,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
  {
    id: "sub-2",
    title: "Talk Two (co-speakers)",
    seq: 2,
    participants: [
      { contactId: "ct-2", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
      { contactId: "ct-3", firstName: "Radia", lastName: "Perlman", email: "radia@example.com" },
    ],
  },
  {
    id: "sub-3",
    title: "Talk Three",
    seq: 3,
    participants: [
      { contactId: "ct-4", firstName: "Margaret", lastName: "Hamilton", email: "margaret@example.com" },
      { contactId: "ct-5", firstName: "Katherine", lastName: "Johnson", email: "katherine@example.com" },
    ],
  },
];

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function makeComposeDb() {
  let feedbackCalls = 0;
  let accountCalls = 0;
  let outstandingCalls = 0;
  let icsScheduleCalls = 0;
  let selectCalls = 0;

  const feedbackRows = [
    { submissionId: "sub-2", comment: "Great energy", submittedAt: new Date(1000) },
    { submissionId: "sub-2", comment: "Clear structure", submittedAt: new Date(2000) },
    // sub-1 and sub-3 have no qualifying comments.
  ];

  const db = {
    select: (proj: Record<string, unknown>) => {
      selectCalls += 1;
      if ("submittedAt" in proj) {
        feedbackCalls += 1;
        return makeSelectChain(feedbackRows);
      }
      // DEC-792: buildRenderTargets's batched outstanding-task lookup
      // (src/server/repo/tasks/reminders.ts listOutstandingForEvent) selects
      // a "taskId"-shaped projection — distinguish it from the account
      // lookup so this fixture's per-query counters stay meaningful.
      if ("taskId" in proj) {
        outstandingCalls += 1;
        return makeSelectChain([]); // no outstanding tasks for any recipient
      }
      // DEC-912: buildRenderTargets's now-unconditional schedule-data lookup
      // (src/server/repo/comms.ts loadIcsScheduleData) selects a
      // "day"-shaped projection — distinguish it too, so this fixture's
      // per-query counters stay meaningful. No schedule_slot rows means
      // every recipient's `scheduled` resolves false here.
      if ("day" in proj) {
        icsScheduleCalls += 1;
        return makeSelectChain([]); // no submissions are scheduled in this fixture
      }
      accountCalls += 1;
      return makeSelectChain([]); // no accounts exist — every recipient gets a claim link path
    },
  } as unknown as AppEnv["Variables"]["db"];

  return {
    db,
    getFeedbackCalls: () => feedbackCalls,
    getAccountCalls: () => accountCalls,
    getOutstandingCalls: () => outstandingCalls,
    getIcsScheduleCalls: () => icsScheduleCalls,
    getSelectCalls: () => selectCalls,
  };
}

function fakeContext(db: AppEnv["Variables"]["db"], kv: KVStore) {
  return {
    var: { db, auth: { orgId: "org-1" } },
    env: { KV: kv as unknown as KVNamespace, PUBLIC_BASE_URL: "https://events.example.com" },
    req: { url: "https://events.example.com/api/v1/events/evt-1/compose/preview", header: () => undefined },
  };
}

describe("buildRenderTargets batches per-request, not per-recipient (DEC-530)", () => {
  it("issues exactly one feedback query, one account query, one outstanding-task query, and one schedule query for 3 submissions / 5 recipients", async () => {
    const { db, getFeedbackCalls, getAccountCalls, getOutstandingCalls, getIcsScheduleCalls, getSelectCalls } = makeComposeDb();
    const c = fakeContext(db, new InMemoryKV());

    const { targets } = await buildRenderTargets(c as never, event, submissions, /* feedback */ feedbackScope);

    expect(targets).toHaveLength(5);
    expect(getFeedbackCalls()).toBe(1);
    expect(getAccountCalls()).toBe(1);
    expect(getOutstandingCalls()).toBe(1);
    expect(getIcsScheduleCalls()).toBe(1);
    expect(getSelectCalls()).toBe(4);
  });

  it("populates ref and scheduled unconditionally (DEC-912), never per-recipient", async () => {
    const { db } = makeComposeDb();
    const c = fakeContext(db, new InMemoryKV());

    const { targets } = await buildRenderTargets(c as never, event, submissions, null);

    const ada = targets.find((t) => t.contactId === "ct-1");
    expect(ada?.ref).toBe("DEV-001");
    expect(ada?.scheduled).toBe(false); // no schedule_slot rows in this fixture
  });

  it("gives co-speakers on the same submission the identical feedback block", async () => {
    const { db } = makeComposeDb();
    const c = fakeContext(db, new InMemoryKV());

    const { targets } = await buildRenderTargets(c as never, event, submissions, feedbackScope);

    const grace = targets.find((t) => t.contactId === "ct-2");
    const radia = targets.find((t) => t.contactId === "ct-3");
    expect(grace?.vars.feedback).toBeDefined();
    expect(grace?.vars.feedback).toBe(radia?.vars.feedback);
    expect(grace?.vars.feedback).toContain("Great energy");
    expect(grace?.vars.feedback).toContain("Clear structure");

    // sub-1/sub-3 recipients had zero qualifying comments.
    const ada = targets.find((t) => t.contactId === "ct-1");
    expect(ada?.vars.feedback).toBe("No reviewer feedback was recorded.");
  });

  it("does not issue a query per recipient when includeFeedback is false", async () => {
    const { db, getFeedbackCalls, getAccountCalls } = makeComposeDb();
    const c = fakeContext(db, new InMemoryKV());

    await buildRenderTargets(c as never, event, submissions, null);

    expect(getFeedbackCalls()).toBe(0);
    expect(getAccountCalls()).toBe(1);
  });
});
