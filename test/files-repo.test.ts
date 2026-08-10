import { describe, expect, it } from "vitest";
import { canAccessFile, isValidContentStatus } from "../src/server/repo/files";

describe("canAccessFile", () => {
  const scope = { orgId: "org1", uploadedByContactId: "c1", participantContactIds: ["c1", "c2"] };

  it("allows an organizer in the same org", () => {
    expect(canAccessFile({ role: "organizer", orgId: "org1" }, scope)).toBe(true);
  });

  it("denies an organizer from a different org", () => {
    expect(canAccessFile({ role: "organizer", orgId: "org2" }, scope)).toBe(false);
  });

  it("allows a speaker who is a participant", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1", contactId: "c2" }, scope)).toBe(true);
  });

  it("allows a speaker who is the uploader even if not currently a participant", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1", contactId: "c1" }, { ...scope, participantContactIds: [] })).toBe(
      true,
    );
  });

  it("denies a speaker with no relation to the submission — no IDOR", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1", contactId: "c3" }, scope)).toBe(false);
  });

  it("denies a speaker session missing a contactId", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1" }, scope)).toBe(false);
  });

  it("denies a reviewer — DEC-020 doesn't name reviewers for this surface", () => {
    expect(canAccessFile({ role: "reviewer", orgId: "org1" }, scope)).toBe(false);
  });
});

describe("isValidContentStatus", () => {
  it("accepts the three DEC-003 content_status literals", () => {
    expect(isValidContentStatus("pending")).toBe(true);
    expect(isValidContentStatus("approved")).toBe(true);
    expect(isValidContentStatus("changes_requested")).toBe(true);
  });

  it("rejects anything else, including internal submission-status literals", () => {
    expect(isValidContentStatus("accepted")).toBe(false);
    expect(isValidContentStatus(undefined)).toBe(false);
  });
});
