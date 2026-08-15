// DEC-530 (wave-33 amendment): buildRenderTargets (src/routes/comms/compose-core.ts)
// awaited its four independent batch reads -- feedback comments, account
// identities, outstanding tasks, ics schedule data -- one after another, even
// though each depends only on `expanded`/`event`/`submissionIds`, all
// resolved purely before the first await. This test proves the fix
// BEHAVIOURALLY -- an instrumented fake `Db` whose every select resolves
// only after an artificial delay, tracking the maximum number of
// simultaneously in-flight statements (pattern:
// test/reviewer-queue-round-trip-depth.test.ts) -- rather than a source grep
// for the string `Promise.all`. A second test pins the returned `targets`
// array for a two-recipient fixture (one with outstanding tasks, one
// without) so the scheduling change provably left the render byte-identical.

import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { buildRenderTargets } from "../src/routes/comms/compose-core";
import type { ComposeSubmission } from "../src/domain/compose";

interface Tracker {
  inFlight: number;
  max: number;
}

// Distinguishes queries by the shape of the projection object passed to
// `select()`, mirroring test/comms-batched-lookups.test.ts's makeComposeDb,
// but also tracks simultaneous in-flight statements via a real macrotask
// delay before resolving, mirroring
// test/reviewer-queue-round-trip-depth.test.ts's makeInstrumentedDb -- so
// genuinely concurrent callers overlap in wall-clock time and genuinely
// sequential callers never do.
function makeInstrumentedDb(tracker: Tracker) {
  const feedbackRows = [{ submissionId: "sub-1", comment: "Nice pacing", submittedAt: new Date(1000) }];
  const outstandingRows = [
    {
      assignmentId: "asn-1",
      contactId: "ct-1",
      status: "outstanding",
      dueDate: new Date(5000),
      assignmentCreatedAt: new Date(500),
      lastRemindedAt: null,
      taskId: "task-1",
      taskTitle: "Submit slides",
    },
  ];

  function delayedChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      groupBy: () => chain,
      limit: (n: number) => delayedChain(rows.slice(0, n)),
      then: (resolve: (v: unknown[]) => void, reject: (e: unknown) => void) => {
        tracker.inFlight += 1;
        tracker.max = Math.max(tracker.max, tracker.inFlight);
        return new Promise<void>((r) => setTimeout(r, 8))
          .then(() => {
            tracker.inFlight -= 1;
            resolve(rows);
          })
          .catch((e: unknown) => {
            tracker.inFlight -= 1;
            reject(e);
          });
      },
    };
    return chain;
  }

  const db = {
    select: (proj: Record<string, unknown>) => {
      if ("submittedAt" in proj) return delayedChain(feedbackRows);
      if ("taskId" in proj) return delayedChain(outstandingRows);
      if ("day" in proj) return delayedChain([]); // no scheduled submissions
      return delayedChain([]); // account lookup: no linked accounts
    },
  } as unknown as AppEnv["Variables"]["db"];
  return db;
}

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

const event = { id: "evt-1", name: "DevCon", recordPrefix: "DEV", startDate: "2026-09-01", endDate: "2026-09-03" };
const feedbackScope = { planId: "plan-1", round: 1 };

// Two recipients: ct-1 (sub-1) has an outstanding task and a feedback
// comment; ct-2 (sub-2) has neither -- exercising both the NO_TASKS_TEXT
// fallback and the feedback-present path in the same render.
const submissions: ComposeSubmission[] = [
  {
    id: "sub-1",
    title: "Talk One",
    seq: 1,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
  {
    id: "sub-2",
    title: "Talk Two",
    seq: 2,
    participants: [{ contactId: "ct-2", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" }],
  },
];

function fakeContext(db: AppEnv["Variables"]["db"], kv: KVStore) {
  return {
    var: { db, auth: { orgId: "org-1" } },
    env: { KV: kv as unknown as KVNamespace, PUBLIC_BASE_URL: "https://events.example.com" },
    req: { url: "https://events.example.com/api/v1/events/evt-1/compose/preview", header: () => undefined },
  };
}

describe("DEC-530 (wave-33 amendment): buildRenderTargets issues a concurrent Promise.all wave", () => {
  it("has at least 4 repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(tracker);
    const c = fakeContext(db, new InMemoryKV());

    const { targets } = await buildRenderTargets(c as never, event, submissions, feedbackScope);

    expect(targets).toHaveLength(2);
    // Wave 1: feedback, account, outstanding-task, and ics-schedule reads all
    // fire together -- a fully serial handler could never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(4);
  });

  it("pins the rendered targets: unchanged by the scheduling change", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const db = makeInstrumentedDb(tracker);
    const c = fakeContext(db, new InMemoryKV());

    const { targets } = await buildRenderTargets(c as never, event, submissions, feedbackScope);

    const byContact = new Map(targets.map((t) => [t.contactId, t]));
    const ada = byContact.get("ct-1")!;
    const grace = byContact.get("ct-2")!;

    expect(ada.ref).toBe("DEV-001");
    expect(ada.scheduled).toBe(false);
    expect(ada.vars.feedback).toContain("Nice pacing");
    expect(ada.vars.task_list).toContain("Submit slides");
    expect(ada.vars.task_due_date).toBeTruthy();
    expect(ada.vars.task_due_date).not.toBe("No due date");

    expect(grace.ref).toBe("DEV-002");
    expect(grace.scheduled).toBe(false);
    expect(grace.vars.feedback).toBe("No reviewer feedback was recorded.");
    expect(grace.vars.task_list).toBe("No outstanding tasks");
    expect(grace.vars.task_due_date).toBe("No due date");
  });
});
