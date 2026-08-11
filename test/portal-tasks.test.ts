import { describe, expect, it } from "vitest";
import {
  assertOwnAssignment,
  canTransitionInvite,
  isParticipantInEvent,
  nextInviteStatus,
  type PortalAssignmentScope,
} from "../src/server/repo/portal";

describe("assertOwnAssignment", () => {
  const scope: PortalAssignmentScope = {
    id: "a1",
    taskId: "t1",
    eventId: "e1",
    kind: "general",
    formId: null,
    deliverableKind: null,
    contactId: "c1",
    orgId: "org1",
    status: "pending",
    fileId: null,
  };

  it("does not throw when the assignment belongs to the contact", () => {
    expect(() => assertOwnAssignment(scope, "c1")).not.toThrow();
  });

  it("throws when the assignment belongs to a different contact — no IDOR", () => {
    expect(() => assertOwnAssignment(scope, "c2")).toThrow();
  });
});

describe("canTransitionInvite", () => {
  it("allows a transition only from 'invited'", () => {
    expect(canTransitionInvite("invited")).toBe(true);
  });

  it("rejects transitions from 'none', 'accepted', or 'declined'", () => {
    expect(canTransitionInvite("none")).toBe(false);
    expect(canTransitionInvite("accepted")).toBe(false);
    expect(canTransitionInvite("declined")).toBe(false);
  });
});

describe("nextInviteStatus", () => {
  it("maps 'accept' -> 'accepted' and 'decline' -> 'declined'", () => {
    expect(nextInviteStatus("accept")).toBe("accepted");
    expect(nextInviteStatus("decline")).toBe("declined");
  });
});

describe("isParticipantInEvent", () => {
  it("is true when the resource's event is among the speaker's events", () => {
    expect(isParticipantInEvent(["e1", "e2"], "e2")).toBe(true);
  });

  it("is false for an event the speaker doesn't participate in — no IDOR across events", () => {
    expect(isParticipantInEvent(["e1", "e2"], "e3")).toBe(false);
  });

  it("is false for an empty event list", () => {
    expect(isParticipantInEvent([], "e1")).toBe(false);
  });
});
