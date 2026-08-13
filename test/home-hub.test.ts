import { describe, expect, it } from "vitest";
import { groupHubEvents, hubState, type HubEvent } from "../src/lib/home-hub";

const NOW = Date.UTC(2026, 5, 1); // 2026-06-01
// Default start/endDate is deliberately far in the future so a test that
// doesn't care about dates never accidentally lands the event in `past`.
const DEFAULT_START = Date.UTC(2026, 9, 1);

function makeEvent(overrides: Partial<HubEvent>): HubEvent {
  return {
    id: "e1",
    name: "Event",
    slug: "event",
    startDate: DEFAULT_START,
    endDate: DEFAULT_START,
    location: null,
    timezone: "America/Los_Angeles",
    cfpCloseDate: null,
    cfpOpen: false,
    publishedSessionCount: 0,
    trackCount: 0,
    formatCount: 0,
    ...overrides,
  };
}

describe("groupHubEvents — visibility predicate (DEC-581)", () => {
  it("drops an event with a not_yet_open CFP and zero published sessions", () => {
    const event = makeEvent({ id: "e1", cfpOpen: false, publishedSessionCount: 0 });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp).toEqual([]);
    expect(sections.published).toEqual([]);
    expect(sections.past).toEqual([]);
  });

  it("keeps a closed CFP event that has published sessions", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: false,
      publishedSessionCount: 3,
      startDate: Date.UTC(2026, 7, 1),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["e1"]);
  });

  it("keeps an open CFP event with zero published sessions", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 0,
      startDate: Date.UTC(2026, 9, 1),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("groupHubEvents — grouping", () => {
  it("buckets an ended event as past regardless of a still-open CFP window", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 2,
      startDate: Date.UTC(2026, 0, 1),
      endDate: Date.UTC(2026, 0, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["e1"]);
    expect(sections.openCfp).toEqual([]);
  });

  it("buckets a future open-CFP event as openCfp", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 0,
      startDate: Date.UTC(2026, 9, 1),
      endDate: Date.UTC(2026, 9, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["e1"]);
  });

  it("buckets a future non-open-CFP event with published sessions as published", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: false,
      publishedSessionCount: 5,
      startDate: Date.UTC(2026, 9, 1),
      endDate: Date.UTC(2026, 9, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["e1"]);
  });

  it("with default (future) dates, an open-CFP event lands in openCfp (never past)", () => {
    const event = makeEvent({ id: "e1", cfpOpen: true, publishedSessionCount: 0 });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("groupHubEvents — ordering", () => {
  it("sorts openCfp by cfpCloseDate asc, nulls last, then id", () => {
    const a = makeEvent({ id: "a", cfpOpen: true, cfpCloseDate: null });
    const b = makeEvent({ id: "b", cfpOpen: true, cfpCloseDate: Date.UTC(2026, 9, 1) });
    const c = makeEvent({ id: "c", cfpOpen: true, cfpCloseDate: Date.UTC(2026, 8, 1) });
    const d = makeEvent({ id: "d", cfpOpen: true, cfpCloseDate: null });
    const sections = groupHubEvents([a, b, c, d], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("breaks an openCfp cfpCloseDate tie by startDate asc, then id", () => {
    const closeDate = Date.UTC(2026, 9, 1);
    const a = makeEvent({ id: "z", cfpOpen: true, cfpCloseDate: closeDate, startDate: Date.UTC(2026, 9, 5) });
    const b = makeEvent({ id: "y", cfpOpen: true, cfpCloseDate: closeDate, startDate: Date.UTC(2026, 9, 1) });
    const c = makeEvent({ id: "x", cfpOpen: true, cfpCloseDate: closeDate, startDate: Date.UTC(2026, 9, 1) });
    const sections = groupHubEvents([a, b, c], NOW);
    // b and c tie on startDate too -> broken by id (x before y).
    expect(sections.openCfp.map((e) => e.id)).toEqual(["x", "y", "z"]);
  });

  it("sorts published by startDate asc, then id", () => {
    const a = makeEvent({ id: "a", publishedSessionCount: 1, startDate: Date.UTC(2026, 9, 9) });
    const b = makeEvent({ id: "b", publishedSessionCount: 1, startDate: Date.UTC(2026, 9, 5) });
    const c = makeEvent({ id: "c", publishedSessionCount: 1, startDate: Date.UTC(2026, 9, 1) });
    const sections = groupHubEvents([a, b, c], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("breaks a published startDate tie by id asc", () => {
    const startDate = Date.UTC(2026, 9, 1);
    const a = makeEvent({ id: "z", publishedSessionCount: 1, startDate });
    const b = makeEvent({ id: "a", publishedSessionCount: 1, startDate });
    const sections = groupHubEvents([a, b], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("sorts past by startDate desc, then id asc", () => {
    const a = makeEvent({ id: "a", publishedSessionCount: 1, startDate: Date.UTC(2025, 0, 1), endDate: Date.UTC(2025, 0, 1) });
    const b = makeEvent({ id: "b", publishedSessionCount: 1, startDate: Date.UTC(2025, 5, 1), endDate: Date.UTC(2025, 5, 1) });
    const c = makeEvent({ id: "c", publishedSessionCount: 1, startDate: Date.UTC(2025, 2, 1), endDate: Date.UTC(2025, 2, 1) });
    const sections = groupHubEvents([a, b, c], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks a past startDate tie by id asc", () => {
    const startDate = Date.UTC(2025, 0, 1);
    const a = makeEvent({ id: "z", publishedSessionCount: 1, startDate, endDate: startDate });
    const b = makeEvent({ id: "a", publishedSessionCount: 1, startDate, endDate: startDate });
    const sections = groupHubEvents([a, b], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["a", "z"]);
  });
});

describe("hubState (DEC-581)", () => {
  it("is 'fresh' when all three sections are empty", () => {
    expect(hubState({ openCfp: [], published: [], past: [] })).toBe("fresh");
  });

  it("is 'between_cycles' when only past has entries", () => {
    const past = [makeEvent({ id: "a" })];
    expect(hubState({ openCfp: [], published: [], past })).toBe("between_cycles");
  });

  it("is 'full' when openCfp has entries", () => {
    const openCfp = [makeEvent({ id: "a" })];
    expect(hubState({ openCfp, published: [], past: [] })).toBe("full");
  });

  it("is 'full' when published has entries", () => {
    const published = [makeEvent({ id: "a" })];
    expect(hubState({ openCfp: [], published, past: [] })).toBe("full");
  });

  it("is 'full' when everything is populated", () => {
    const openCfp = [makeEvent({ id: "a" })];
    const published = [makeEvent({ id: "b" })];
    const past = [makeEvent({ id: "c" })];
    expect(hubState({ openCfp, published, past })).toBe("full");
  });
});
