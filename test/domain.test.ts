import { describe, expect, it } from "vitest";
import { formatRef, newId } from "../src/domain/ids";
import {
  changeStatus,
  isDecided,
  SUBMISSION_STATUSES,
  type StatusChangeInput,
} from "../src/domain/status";
import { DEFAULT_ONBOARDING_TASKS, planAcceptance } from "../src/domain/acceptance";

describe("ids", () => {
  it("generates 20-char lowercase base32 ids", () => {
    const id = newId();
    expect(id).toHaveLength(20);
    expect(id).toMatch(/^[a-z2-7]{20}$/);
  });

  it("generates unique ids across many calls", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
  });

  it("formats refs zero-padded to 3 digits", () => {
    expect(formatRef("SES", 14)).toBe("SES-014");
    expect(formatRef("SES", 1)).toBe("SES-001");
    expect(formatRef("SES", 0)).toBe("SES-000");
  });

  it("widens the ref field once seq exceeds 999", () => {
    expect(formatRef("SES", 1000)).toBe("SES-1000");
    expect(formatRef("SES", 12345)).toBe("SES-12345");
  });

  it("rejects non-integer or negative seq", () => {
    expect(() => formatRef("SES", -1)).toThrow();
    expect(() => formatRef("SES", 1.5)).toThrow();
  });
});

describe("status pipeline", () => {
  it("exposes the exact DEC-003 literal set", () => {
    expect(SUBMISSION_STATUSES).toEqual([
      "pending",
      "accept_queue",
      "decline_queue",
      "accepted",
      "declined",
    ]);
  });

  it("isDecided is true only for accepted/declined", () => {
    expect(isDecided("accepted")).toBe(true);
    expect(isDecided("declined")).toBe(true);
    expect(isDecided("pending")).toBe(false);
    expect(isDecided("accept_queue")).toBe(false);
    expect(isDecided("decline_queue")).toBe(false);
  });

  it("fires acceptance exactly once on first entry into accepted", () => {
    let state: StatusChangeInput = { status: "pending", acceptedAt: null };

    const first = changeStatus(state, "accepted", 100);
    expect(first.fireAcceptance).toBe(true);
    expect(first.acceptedAt).toBe(100);
    state = { status: first.status, acceptedAt: first.acceptedAt };

    // Move away and re-accept: acceptedAt must not reset, fireAcceptance must stay false.
    const declined = changeStatus(state, "declined", 200);
    expect(declined.fireAcceptance).toBe(false);
    expect(declined.acceptedAt).toBe(100);
    state = { status: declined.status, acceptedAt: declined.acceptedAt };

    const reaccepted = changeStatus(state, "accepted", 300);
    expect(reaccepted.fireAcceptance).toBe(false);
    expect(reaccepted.acceptedAt).toBe(100);
  });

  it("does not clear acceptedAt when un-accepting (records already created persist)", () => {
    const accepted = changeStatus({ status: "pending", acceptedAt: null }, "accepted", 50);
    const unaccepted = changeStatus(
      { status: accepted.status, acceptedAt: accepted.acceptedAt },
      "pending",
      75,
    );
    expect(unaccepted.acceptedAt).toBe(50);
    expect(unaccepted.fireAcceptance).toBe(false);
  });

  it("StatusChangeResult never carries a mailer-shaped field", () => {
    // Structural invariant (DEC-009): the type/shape returned by changeStatus
    // has no mail/email field — callers must decide notification separately.
    const result = changeStatus({ status: "pending", acceptedAt: null }, "accepted", 1);
    expect(Object.keys(result).sort()).toEqual(["acceptedAt", "fireAcceptance", "status"]);
  });
});

describe("acceptance planning", () => {
  it("DEFAULT_ONBOARDING_TASKS matches DEC-009 exactly", () => {
    expect(DEFAULT_ONBOARDING_TASKS).toEqual([
      { title: "Hotel stay requirement form", kind: "form", required: true, dueDaysBeforeEventStart: 30 },
      { title: "Flight reimbursement form", kind: "form", required: true, dueDaysBeforeEventStart: 30 },
      { title: "Finalize talk description", kind: "general", required: false, dueDaysBeforeEventStart: 21 },
      { title: "Finalize bio + headshot", kind: "file_request", required: false, dueDaysBeforeEventStart: 21 },
      { title: "Announce participation", kind: "general", required: false, dueDaysBeforeEventStart: 14 },
    ]);
  });

  it("plans all 5 tasks per participant contact when none exist", () => {
    const result = planAcceptance({
      submissionId: "sub1",
      eventId: "evt1",
      participantContactIds: ["c1", "c2"],
      existingTaskTitlesByContact: {},
    });
    expect(result.taskAssignments).toHaveLength(10);
    expect(result.taskAssignments.filter((a) => a.contactId === "c1")).toHaveLength(5);
    expect(result.taskAssignments.filter((a) => a.contactId === "c2")).toHaveLength(5);
  });

  it("is idempotent: replanning after applying results yields nothing", () => {
    const input = {
      submissionId: "sub1",
      eventId: "evt1",
      participantContactIds: ["c1", "c2"],
      existingTaskTitlesByContact: {} as Record<string, string[]>,
    };
    const first = planAcceptance(input);
    expect(first.taskAssignments.length).toBeGreaterThan(0);

    const existingTaskTitlesByContact: Record<string, string[]> = {};
    for (const assignment of first.taskAssignments) {
      const titles = (existingTaskTitlesByContact[assignment.contactId] ??= []);
      titles.push(assignment.taskTitle);
    }

    const second = planAcceptance({ ...input, existingTaskTitlesByContact });
    expect(second.taskAssignments).toEqual([]);
  });

  it("only plans missing titles, not already-existing ones", () => {
    const result = planAcceptance({
      submissionId: "sub1",
      eventId: "evt1",
      participantContactIds: ["c1"],
      existingTaskTitlesByContact: {
        c1: ["Hotel stay requirement form", "Flight reimbursement form"],
      },
    });
    expect(result.taskAssignments).toHaveLength(3);
    expect(result.taskAssignments.map((a) => a.taskTitle)).toEqual([
      "Finalize talk description",
      "Finalize bio + headshot",
      "Announce participation",
    ]);
  });
});
