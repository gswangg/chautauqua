// DEC-789 wave-73 amendment: one invite-status vocabulary and one label map
// in pure core (src/domain/invite-status.ts). Locks each server site's
// accepted set to be the SAME REFERENCE-EQUIVALENT set as INVITE_STATUSES
// (not a hand-copied literal that can silently drift), locks the three
// src/domain/acceptance.ts subsets as subsets of the base vocabulary, pins
// that SCHEDULING_PARTICIPANT_STATUSES and PORTAL_VISIBLE_INVITE_STATUSES
// are the same set under two names, and locks INVITE_STATUS_LABELS to carry
// exactly one entry per member with no entry equal to its own wire literal.

import { describe, expect, it } from "vitest";
import { INVITE_STATUSES, INVITE_STATUS_LABELS, isInviteStatus } from "../src/domain/invite-status";
import {
  ACTIVE_INVITE_STATUSES,
  PORTAL_VISIBLE_INVITE_STATUSES,
  SCHEDULING_PARTICIPANT_STATUSES,
} from "../src/domain/acceptance";
import { parseOnboardingGridQuery } from "../src/routes/tasks";

function asSet<T>(arr: readonly T[]): Set<T> {
  return new Set(arr);
}

describe("invite-status closed vocabulary (DEC-789 wave-73)", () => {
  it("INVITE_STATUSES is exactly the four-member closed set", () => {
    expect([...INVITE_STATUSES]).toEqual(["none", "invited", "accepted", "declined"]);
  });

  it("isInviteStatus accepts every member and rejects unknown strings", () => {
    for (const status of INVITE_STATUSES) {
      expect(isInviteStatus(status)).toBe(true);
    }
    expect(isInviteStatus("archived")).toBe(false);
    expect(isInviteStatus("")).toBe(false);
  });

  it("src/routes/tasks.ts's onboarding grid filter accepts every member and its 400 message is composed from INVITE_STATUSES", () => {
    for (const status of INVITE_STATUSES) {
      const parsed = parseOnboardingGridQuery({ inviteStatus: status }, Date.now());
      expect(parsed.inviteStatus).toBe(status);
    }
    let message = "";
    try {
      parseOnboardingGridQuery({ inviteStatus: "bogus" }, Date.now());
    } catch (err) {
      message = (err as { fields?: { inviteStatus?: string } }).fields?.inviteStatus ?? "";
    }
    for (const status of INVITE_STATUSES) {
      expect(message).toContain(status);
    }
  });

  it("each acceptance.ts subset is a subset of INVITE_STATUSES", () => {
    const base = asSet(INVITE_STATUSES);
    for (const subset of [ACTIVE_INVITE_STATUSES, SCHEDULING_PARTICIPANT_STATUSES, PORTAL_VISIBLE_INVITE_STATUSES]) {
      for (const status of subset) {
        expect(base.has(status)).toBe(true);
      }
    }
  });

  it("SCHEDULING_PARTICIPANT_STATUSES and PORTAL_VISIBLE_INVITE_STATUSES are the same set under two names", () => {
    expect(asSet(SCHEDULING_PARTICIPANT_STATUSES)).toEqual(asSet(PORTAL_VISIBLE_INVITE_STATUSES));
  });

  it("ACTIVE_INVITE_STATUSES is deliberately the smaller, distinct set (write/public-visibility gate)", () => {
    expect(asSet(ACTIVE_INVITE_STATUSES)).not.toEqual(asSet(SCHEDULING_PARTICIPANT_STATUSES));
    expect([...ACTIVE_INVITE_STATUSES].sort()).toEqual(["accepted", "none"]);
  });

  it("INVITE_STATUS_LABELS has exactly one entry per member, no entry equal to its own wire literal", () => {
    expect(Object.keys(INVITE_STATUS_LABELS).sort()).toEqual([...INVITE_STATUSES].sort());
    for (const status of INVITE_STATUSES) {
      const label = INVITE_STATUS_LABELS[status];
      expect(label).toBeTruthy();
      expect(label).not.toBe(status);
    }
  });

  it("the roster's label wording wins (DEC-789 wave-73 ruling)", () => {
    expect(INVITE_STATUS_LABELS).toEqual({
      none: "Not invited",
      invited: "Invited",
      accepted: "Confirmed",
      declined: "Declined",
    });
  });
});
