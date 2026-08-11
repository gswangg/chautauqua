// DST-safety tests for zonedMinutesToUtc (DEC-230, task-w26-d). Expected UTC
// instants were derived from the real IANA transition instants for 2027
// (verified independently via Intl probing, not by running the code under
// test), then walked through the documented two-candidate algorithm by
// hand:
//   - fall-back overlap -> EARLIER instant (min of the two candidates).
//   - spring-forward gap -> FORWARD, post-transition instant (max of the
//     two candidates).
//
// 2027 transition instants used below (real IANA data):
//   America/New_York: spring 2027-03-14T07:00:00Z (EST -05:00 -> EDT -04:00)
//                      fall   2027-11-07T06:00:00Z (EDT -04:00 -> EST -05:00)
//   Europe/Berlin:     spring 2027-03-28T01:00:00Z (CET +01:00 -> CEST +02:00)
//                      fall   2027-10-31T01:00:00Z (CEST +02:00 -> CET +01:00)
//   Australia/Sydney:  fall   2027-04-03T16:00:00Z (AEDT +11:00 -> AEST +10:00)
//                      spring 2027-10-02T16:00:00Z (AEST +10:00 -> AEDT +11:00)
import { describe, expect, it } from "vitest";
import { zonedMinutesToUtc } from "../src/lib/timezone";

describe("zonedMinutesToUtc — DST safety (DEC-230)", () => {
  it("America/New_York spring-forward gap resolves FORWARD (02:30 doesn't exist)", () => {
    // 02:30 on the gap day: neither the EST nor EDT reading is
    // self-consistent, so we resolve forward to the EDT (post-transition)
    // instant, landing on wall-clock 03:30 EDT = 07:30Z.
    const d = zonedMinutesToUtc("2027-03-14", 150, "America/New_York");
    expect(d.toISOString()).toBe("2027-03-14T07:30:00.000Z");
  });

  it("America/New_York fall-back overlap resolves to the EARLIER (EDT) instant", () => {
    // 01:30 occurs twice: first at 05:30Z (EDT), again at 06:30Z (EST).
    const d = zonedMinutesToUtc("2027-11-07", 90, "America/New_York");
    expect(d.toISOString()).toBe("2027-11-07T05:30:00.000Z");
  });

  it("Europe/Berlin spring-forward gap resolves FORWARD (02:30 doesn't exist)", () => {
    // Resolves forward to wall-clock 03:30 CEST = 01:30Z.
    const d = zonedMinutesToUtc("2027-03-28", 150, "Europe/Berlin");
    expect(d.toISOString()).toBe("2027-03-28T01:30:00.000Z");
  });

  it("Europe/Berlin fall-back overlap resolves to the EARLIER (CEST) instant", () => {
    // 02:30 occurs twice: first at 00:30Z (CEST), again at 01:30Z (CET).
    const d = zonedMinutesToUtc("2027-10-31", 150, "Europe/Berlin");
    expect(d.toISOString()).toBe("2027-10-31T00:30:00.000Z");
  });

  it("Australia/Sydney fall-back overlap resolves to the EARLIER (AEDT) instant", () => {
    // Southern hemisphere: fall-back happens in April. 02:30 on 2027-04-04
    // occurs twice: first at 15:30Z on 04-03 (AEDT), again at 16:30Z (AEST).
    const d = zonedMinutesToUtc("2027-04-04", 150, "Australia/Sydney");
    expect(d.toISOString()).toBe("2027-04-03T15:30:00.000Z");
  });

  it("Australia/Sydney spring-forward gap resolves FORWARD", () => {
    // Southern hemisphere: spring-forward happens in October. 02:30 on
    // 2027-10-03 doesn't exist; resolves forward to wall-clock 03:30 AEDT
    // = 16:30Z on 10-02.
    const d = zonedMinutesToUtc("2027-10-03", 150, "Australia/Sydney");
    expect(d.toISOString()).toBe("2027-10-02T16:30:00.000Z");
  });

  it("sanity: America/New_York well away from any transition (EDT, summer)", () => {
    const d = zonedMinutesToUtc("2027-06-15", 600, "America/New_York");
    expect(d.toISOString()).toBe("2027-06-15T14:00:00.000Z");
  });

  it("sanity: Europe/Berlin well away from any transition (CEST, summer)", () => {
    const d = zonedMinutesToUtc("2027-06-15", 600, "Europe/Berlin");
    expect(d.toISOString()).toBe("2027-06-15T08:00:00.000Z");
  });

  it("sanity: Australia/Sydney well away from any transition (AEST, southern winter)", () => {
    const d = zonedMinutesToUtc("2027-06-15", 600, "Australia/Sydney");
    expect(d.toISOString()).toBe("2027-06-15T00:00:00.000Z");
  });

  it("sanity: UTC zone is always a straight passthrough", () => {
    const d = zonedMinutesToUtc("2027-06-15", 600, "UTC");
    expect(d.toISOString()).toBe("2027-06-15T10:00:00.000Z");
  });

  it("fails loudly on an invalid day", () => {
    expect(() => zonedMinutesToUtc("not-a-day", 0, "UTC")).toThrow();
  });

  it("fails loudly on an empty day", () => {
    expect(() => zonedMinutesToUtc("", 0, "America/New_York")).toThrow();
  });
});
