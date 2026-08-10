import { describe, expect, it } from "vitest";
import {
  isDateOrderValid,
  isValidHexColor,
  isValidSlug,
  isValidTimezone,
} from "../src/routes/api/validators";

describe("isValidSlug", () => {
  it("accepts lowercase letters, digits, hyphens", () => {
    expect(isValidSlug("devcon-2026")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("2026")).toBe(true);
  });

  it("rejects uppercase, spaces, underscores, empty", () => {
    expect(isValidSlug("DevCon")).toBe(false);
    expect(isValidSlug("dev con")).toBe(false);
    expect(isValidSlug("dev_con")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("dev.con")).toBe(false);
  });
});

describe("isValidHexColor", () => {
  it("accepts 6-digit and 3-digit hex with #", () => {
    expect(isValidHexColor("#336699")).toBe(true);
    expect(isValidHexColor("#FFF")).toBe(true);
    expect(isValidHexColor("#000000")).toBe(true);
  });

  it("rejects missing #, wrong length, non-hex chars", () => {
    expect(isValidHexColor("336699")).toBe(false);
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("#zzzzzz")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("isValidTimezone", () => {
  it("accepts well-known IANA zones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("rejects empty and bogus zones", () => {
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("   ")).toBe(false);
    expect(isValidTimezone("Not/A_Zone")).toBe(false);
  });
});

describe("isDateOrderValid", () => {
  it("accepts start before or equal to end", () => {
    expect(isDateOrderValid("2026-06-01", "2026-06-03")).toBe(true);
    expect(isDateOrderValid("2026-06-01", "2026-06-01")).toBe(true);
  });

  it("rejects end before start", () => {
    expect(isDateOrderValid("2026-06-03", "2026-06-01")).toBe(false);
  });

  it("rejects unparseable dates", () => {
    expect(isDateOrderValid("not-a-date", "2026-06-01")).toBe(false);
    expect(isDateOrderValid("2026-06-01", "not-a-date")).toBe(false);
  });
});
