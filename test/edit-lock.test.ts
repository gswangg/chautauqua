import { describe, expect, it } from "vitest";
import { canEditSubmission, canEditTracks } from "../src/domain/edit-lock";

const NOW = 1_000_000;
const PAST = NOW - 1000;
const FUTURE = NOW + 1000;

describe("canEditSubmission (DEC-041 server-side edit lock)", () => {
  it("pending + open form is editable", () => {
    expect(canEditSubmission("pending", FUTURE, NOW)).toBe(true);
  });

  it("pending + closed form is not editable", () => {
    expect(canEditSubmission("pending", PAST, NOW)).toBe(false);
  });

  it("accepted + closed form remains editable (accepted speakers keep editing)", () => {
    expect(canEditSubmission("accepted", PAST, NOW)).toBe(true);
  });

  it("decline_queue + closed form is not editable", () => {
    expect(canEditSubmission("decline_queue", PAST, NOW)).toBe(false);
  });

  it("decline_queue + open form is editable", () => {
    expect(canEditSubmission("decline_queue", FUTURE, NOW)).toBe(true);
  });

  it("null close date never closes the form", () => {
    expect(canEditSubmission("pending", null, NOW)).toBe(true);
  });
});

describe("canEditTracks (DEC-041)", () => {
  it("open form allows track edits", () => {
    expect(canEditTracks(FUTURE, NOW)).toBe(true);
  });

  it("closed form disallows track edits, even if accepted", () => {
    expect(canEditTracks(PAST, NOW)).toBe(false);
  });

  it("null close date never closes track edits", () => {
    expect(canEditTracks(null, NOW)).toBe(true);
  });
});
