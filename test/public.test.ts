// Pure-helper tests for the public surfaces (J10/DEC-022). Route/query-gate
// verification happens against wrangler dev per DEC-012 — this covers only
// the extracted pure logic: itinerary id parsing/storage key and the
// timezone conversion used by schedule.ics.

import { describe, expect, it } from "vitest";
import { itineraryStorageKey, parseItineraryIds } from "../src/lib/itinerary";
import { zonedMinutesToUtc } from "../src/lib/timezone";

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
