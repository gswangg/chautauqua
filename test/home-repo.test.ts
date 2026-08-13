// Repo-layer test for src/server/repo/public/home.ts, modelled on the
// fake-db chain harness established in test/agenda-repo.test.ts /
// test/onboarding-grid-pagination.test.ts — no local sqlite/D1 test driver
// is wired up in this repo, so every select() call is faked by response
// position.
import { describe, expect, it } from "vitest";
import { getHubOrg, listHubEvents, HUB_CANDIDATE_LIMIT } from "../src/server/repo/public/home";
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
  it("returns candidate items with per-event published counts, unfiltered, and capped=false under the limit", async () => {
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
    const responses = [
      eventRows,
      [{ eventId: "e1", count: 2 }],
      [{ eventId: "e1", count: 3 }],
      [{ eventId: "e1", count: 5 }],
    ];
    let call = 0;
    const db = {
      select: () => {
        const rows = responses[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
    } as unknown as Db;

    const page = await listHubEvents(db, "org-1", Date.UTC(2026, 5, 1));

    // under HUB_CANDIDATE_LIMIT rows -> never capped, and never a
    // disclosing org-wide count (DEC-670).
    expect(page.capped).toBe(false);
    expect(page.items).toHaveLength(2);

    const e1 = page.items.find((e) => e.id === "e1")!;
    expect(e1.publishedSessionCount).toBe(2);
    expect(e1.trackCount).toBe(3);
    expect(e1.formatCount).toBe(5);
    expect(e1.startDate).toBe(Date.UTC(2026, 9, 1));
    expect(e1.endDate).toBe(Date.UTC(2026, 9, 3));
    // null open/close date means the form never closes and opens immediately
    // (formWindowState), so it reads as open here — home.ts does not decide
    // whether that makes the event visible on the hub, groupHubEvents does.
    expect(e1.cfpOpen).toBe(true);

    const e2 = page.items.find((e) => e.id === "e2")!;
    expect(e2.publishedSessionCount).toBe(0); // no aggregate row for e2 -> 0, not dropped
    expect(e2.trackCount).toBe(0);
    expect(e2.formatCount).toBe(0);
  });

  // DEC-943/DEC-078: exactly two grouped queries (track, format) beyond the
  // event-rows + published-count queries -- never a query per event. A
  // fake-db call counter directly measures this without relying on the
  // driver-specific shape of the queries.
  it("issues exactly one grouped track-count query and one grouped format-count query, regardless of event count (DEC-078)", async () => {
    const N = 12;
    const eventRows = Array.from({ length: N }, (_, i) => ({
      id: `e${i}`,
      name: `Event ${i}`,
      slug: `event-${i}`,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      location: null,
      timezone: "UTC",
      openDate: null,
      closeDate: null,
    }));
    let selectCalls = 0;
    const responses = [eventRows, [], [], []];
    const db = {
      select: () => {
        const rows = responses[selectCalls] ?? [];
        selectCalls += 1;
        return makeChain(rows);
      },
    } as unknown as Db;

    await listHubEvents(db, "org-1", Date.UTC(2026, 5, 1));
    // event-rows query + published-count + track-count + format-count = 4,
    // independent of N.
    expect(selectCalls).toBe(4);
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
    const responses = [eventRows, []];
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

  it("sets capped=true when the candidate window returns exactly HUB_CANDIDATE_LIMIT rows", async () => {
    const eventRows = Array.from({ length: HUB_CANDIDATE_LIMIT }, (_, i) => ({
      id: `e${i}`,
      name: `Event ${i}`,
      slug: `event-${i}`,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      location: null,
      timezone: "UTC",
      openDate: null,
      closeDate: null,
    }));
    const responses = [eventRows, []];
    let call = 0;
    const db = {
      select: () => {
        const rows = responses[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
    } as unknown as Db;

    const page = await listHubEvents(db, "org-1", Date.UTC(2026, 5, 1));
    expect(page.items).toHaveLength(HUB_CANDIDATE_LIMIT);
    expect(page.capped).toBe(true);
  });
});
