// Tests for DEC-413: the speaker portal renders every date in the owning
// event's timezone, not UTC. Regression coverage for the exact off-by-one
// -day defect: a task due 2027-03-02T06:00:00Z (23:59 Pacific on 2027-03-01)
// must tell a Los-Angeles-event speaker it's due March 1, not March 2.
import { describe, expect, it } from "vitest";
import { formatEventDate } from "../src/lib/event-time";
import type { PortalSubmissionSummary, PortalTask, PortalSubmissionDetail, PortalTaskAssignment } from "../src/server/repo/portal";

describe("formatEventDate (DEC-413)", () => {
  const DUE_MS = Date.UTC(2027, 2, 2, 6, 0, 0); // 2027-03-02T06:00:00Z

  it("renders the Pacific-local day (March 1) for an America/Los_Angeles event", () => {
    const formatted = formatEventDate(DUE_MS, "America/Los_Angeles");
    expect(formatted).toContain("1 Mar 2027");
    expect(formatted).not.toContain("2 Mar 2027");
  });

  it("renders the UTC day (March 2) for a UTC event", () => {
    const formatted = formatEventDate(DUE_MS, "UTC");
    expect(formatted).toContain("2 Mar 2027");
  });

  it("throws on an empty timeZone (no UTC fallback)", () => {
    expect(() => formatEventDate(DUE_MS, "")).toThrow();
  });

  it("throws on an invalid timeZone (no UTC fallback)", () => {
    expect(() => formatEventDate(DUE_MS, "Not/AZone")).toThrow();
  });
});

describe("portal repo row types carry timezone (DEC-413)", () => {
  it("PortalSubmissionSummary requires timezone", () => {
    const row: PortalSubmissionSummary = {
      id: "s1",
      ref: "T-0001",
      title: "Talk",
      status: "pending",
      statusLabel: "Under review",
      submittedAt: Date.now(),
      timezone: "America/Los_Angeles",
    };
    expect(row.timezone).toBe("America/Los_Angeles");
  });

  it("PortalTask requires timezone", () => {
    const row: PortalTask = {
      id: "t1",
      title: "Do a thing",
      dueDate: null,
      required: true,
      status: "pending",
      timezone: "UTC",
    };
    expect(row.timezone).toBe("UTC");
  });

  it("PortalSubmissionDetail requires timezone", () => {
    const row: PortalSubmissionDetail = {
      id: "s1",
      eventId: "evt-1",
      ref: "T-0001",
      title: "Talk",
      description: null,
      status: "pending",
      statusLabel: "Under review",
      submittedAt: Date.now(),
      timezone: "Europe/Berlin",
      answers: [],
      trackName: null,
      format: null,
      day: null,
      startMin: null,
      endMin: null,
      roomName: null,
    };
    expect(row.timezone).toBe("Europe/Berlin");
  });

  it("PortalTaskAssignment requires timezone", () => {
    const row: PortalTaskAssignment = {
      id: "a1",
      taskId: "t1",
      eventId: "evt-1",
      kind: "general",
      title: "Do a thing",
      description: null,
      instructions: null,
      dueDate: null,
      assignedAt: 0,
      required: true,
      status: "pending",
      formId: null,
      deliverableKind: null,
      fileId: null,
      responseJson: null,
      timezone: "Asia/Tokyo",
      completedAt: null,
    };
    expect(row.timezone).toBe("Asia/Tokyo");
  });
});
