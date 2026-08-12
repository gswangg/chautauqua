// Repo-layer test for src/server/repo/public/home.ts, modelled on the
// fake-db chain harness established in test/agenda-repo.test.ts /
// test/onboarding-grid-pagination.test.ts — no local sqlite/D1 test driver
// is wired up in this repo, so every select() call is faked by response
// position.
import { describe, expect, it } from "vitest";
import { getHubOrg, listHubEvents } from "../src/server/repo/public/home";
import type { Db } from "../src/server/context";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("getHubOrg", () => {
  it("returns the first (id-ordered) org row", async () => {
    const db = {
      select: () => makeChain([{ id: "org-1", name: "Acme" }]),
    } as unknown as Db;
    expect(await getHubOrg(db)).toEqual({ id: "org-1", name: "Acme" });
  });

  it("returns null when there is no org row", async () => {
    const db = { select: () => makeChain([]) } as unknown as Db;
    expect(await getHubOrg(db)).toBeNull();
  });
});

describe("listHubEvents", () => {
  it("returns candidate items with a truthful total and per-event published counts, unfiltered", async () => {
    const eventRows = [
      {
        id: "e1",
        name: "Event One",
        slug: "event-one",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        location: "Somewhere",
        timezone: "America/Los_Angeles",
        openDate: null,
        closeDate: null,
      },
      {
        id: "e2",
        name: "Event Two",
        slug: "event-two",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        location: null,
        timezone: "America/New_York",
        openDate: null,
        closeDate: null,
      },
    ];
    const responses = [eventRows, [{ count: 5 }], [{ eventId: "e1", count: 2 }]];
    let call = 0;
    const db = {
      select: () => {
        const rows = responses[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
    } as unknown as Db;

    const page = await listHubEvents(db, "org-1", Date.UTC(2026, 5, 1));

    // total reflects the org's full event count (5), not the length of the
    // returned (2-row) candidate window — a capped list never hides its cap.
    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(2);

    const e1 = page.items.find((e) => e.id === "e1")!;
    expect(e1.publishedSessionCount).toBe(2);
    expect(e1.startDate).toBe(Date.UTC(2026, 9, 1));
    expect(e1.endDate).toBe(Date.UTC(2026, 9, 3));
    // null open/close date means the form never closes and opens immediately
    // (formWindowState), so it reads as open here — home.ts does not decide
    // whether that makes the event visible on the hub, groupHubEvents does.
    expect(e1.cfpOpen).toBe(true);

    const e2 = page.items.find((e) => e.id === "e2")!;
    expect(e2.publishedSessionCount).toBe(0); // no aggregate row for e2 -> 0, not dropped
  });

  it("does not filter or group candidates in SQL — a not-yet-open, unpublished event is still returned as an item", async () => {
    const futureOpen = Date.UTC(2099, 0, 1);
    const eventRows = [
      {
        id: "e1",
        name: "Future CFP",
        slug: "future-cfp",
        startDate: "2099-06-01",
        endDate: "2099-06-02",
        location: null,
        timezone: "UTC",
        openDate: { getTime: () => futureOpen },
        closeDate: null,
      },
    ];
    const responses = [eventRows, [{ count: 1 }], []];
    let call = 0;
    const db = {
      select: () => {
        const rows = responses[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
    } as unknown as Db;

    const page = await listHubEvents(db, "org-1", Date.UTC(2026, 5, 1));
    // home.ts is a raw-candidate fetch: it hands back the not-yet-open,
    // zero-published event as an item. Dropping it is groupHubEvents' job,
    // not this module's.
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.cfpOpen).toBe(false);
    expect(page.items[0]!.publishedSessionCount).toBe(0);
  });
});
