// Pure-helper tests for the public surfaces (J10/DEC-022). Route/query-gate
// verification happens against wrangler dev per DEC-012 — this covers only
// the extracted pure logic: itinerary id parsing/storage key and the
// timezone conversion used by schedule.ics.

import { describe, expect, it } from "vitest";
import { itineraryStorageKey, parseItineraryIds } from "../src/lib/itinerary";
import { zonedMinutesToUtc } from "../src/lib/timezone";
import { sessionDetailPath, speakerDetailPath, isValidFrom, parseNameQuery, sessionTimeLabel } from "../src/routes/public";
import type { PublicEvent } from "../src/server/repo/public";

describe("itineraryStorageKey", () => {
  it("namespaces by event slug", () => {
    expect(itineraryStorageKey("my-event")).toBe("chq_itinerary_my-event");
  });
});

describe("parseItineraryIds", () => {
  it("returns [] for missing/empty input", () => {
    expect(parseItineraryIds(undefined)).toEqual([]);
    expect(parseItineraryIds(null)).toEqual([]);
    expect(parseItineraryIds("")).toEqual([]);
  });

  it("splits, trims, and dedupes while preserving order", () => {
    expect(parseItineraryIds("a, b,a , c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty segments", () => {
    expect(parseItineraryIds("a,,b,")).toEqual(["a", "b"]);
  });
});

describe("zonedMinutesToUtc", () => {
  it("converts a wall-clock time in a fixed-offset-like zone (UTC) directly", () => {
    // 09:00 (540 min) on 2026-08-10 in UTC is exactly that instant in UTC.
    const d = zonedMinutesToUtc("2026-08-10", 540, "UTC");
    expect(d.toISOString()).toBe("2026-08-10T09:00:00.000Z");
  });

  it("applies a fixed negative offset (America/New_York, EDT = UTC-4 in August)", () => {
    // 09:00 wall-clock in New York in August (EDT, UTC-4) is 13:00 UTC.
    const d = zonedMinutesToUtc("2026-08-10", 540, "America/New_York");
    expect(d.toISOString()).toBe("2026-08-10T13:00:00.000Z");
  });

  it("applies a fixed negative offset in winter (America/New_York, EST = UTC-5)", () => {
    // 09:00 wall-clock in New York in January (EST, UTC-5) is 14:00 UTC.
    const d = zonedMinutesToUtc("2026-01-10", 540, "America/New_York");
    expect(d.toISOString()).toBe("2026-01-10T14:00:00.000Z");
  });

  it("handles a positive offset zone (Asia/Tokyo, UTC+9)", () => {
    // 09:00 wall-clock in Tokyo is 00:00 UTC the same day.
    const d = zonedMinutesToUtc("2026-08-10", 540, "Asia/Tokyo");
    expect(d.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("throws loudly on a malformed day string", () => {
    expect(() => zonedMinutesToUtc("not-a-day", 0, "UTC")).toThrow();
  });
});

// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13): pure query-param
// parsing / path-building helpers. Query-gate verification (200/404 by
// visibility) lives against wrangler dev per DEC-012 — this repo's vitest
// harness runs in plain node with no D1/miniflare binding (see
// test/resource-file.test.ts), so getPublicSpeakerDetail/getPublicSessionDetail
// themselves aren't exercised here; test/public-invite-visibility.test.ts
// source-scans both for the visibleSubmissionConditions() gate instead.
const event: PublicEvent = {
  id: "evt1",
  orgId: "org1",
  name: "DevFlow Conf",
  slug: "devflow",
  startDate: "2027-05-12",
  endDate: "2027-05-14",
  location: null,
  timezone: "UTC",
  recordPrefix: "DF",
  brandingJson: null,
};

describe("sessionDetailPath / speakerDetailPath (DEC-151 ?from= back-link)", () => {
  it("builds a session detail path with no ?from when omitted", () => {
    expect(sessionDetailPath(event, "sub1")).toBe("/e/devflow/sessions/sub1");
  });

  it("builds a session detail path carrying ?from=<surface>", () => {
    expect(sessionDetailPath(event, "sub1", "agenda")).toBe("/e/devflow/sessions/sub1?from=agenda");
  });

  it("builds a speaker detail path carrying ?from=<surface>", () => {
    expect(speakerDetailPath(event, "contact1", "gallery")).toBe("/e/devflow/speakers/contact1?from=gallery");
  });
});

describe("isValidFrom", () => {
  it("passes through a known surface", () => {
    expect(isValidFrom("gallery", "speakers")).toBe("gallery");
  });

  it("falls back on an unknown/missing surface", () => {
    expect(isValidFrom("not-a-surface", "speakers")).toBe("speakers");
    expect(isValidFrom(undefined, "sessions")).toBe("sessions");
  });
});

describe("parseNameQuery (DEC-151 ?q= name search)", () => {
  it("returns null for missing/empty/whitespace-only input", () => {
    expect(parseNameQuery(undefined)).toBeNull();
    expect(parseNameQuery("")).toBeNull();
    expect(parseNameQuery("   ")).toBeNull();
  });

  it("trims a real query", () => {
    expect(parseNameQuery("  Raman  ")).toBe("Raman");
  });
});

describe("sessionTimeLabel", () => {
  it("returns null when the session is unscheduled", () => {
    expect(sessionTimeLabel(null, null, null)).toBeNull();
  });

  it("formats a scheduled session's day + time range", () => {
    expect(sessionTimeLabel("2027-05-12", 540, 600)).toBe("2027-05-12, 9:00 AM–10:00 AM");
  });
});
