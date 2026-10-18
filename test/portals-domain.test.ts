// Multi-portal domain rules (docs/design/multi-portal/BUILD-PLAN.md): rule
// matching, merging an item that arrives from two portals, strictest lock
// for profile fields, additive capabilities, deadlines and grace.

import { describe, expect, it } from "vitest";
import {
  matchesRule,
  parsePortalRule,
  describeRule,
  type PortalRule,
} from "../src/domain/portals/rules";
import type { Participation } from "../src/domain/portals/participations";
import { isActiveParticipation, isMatchableParticipation, unmatchedReason } from "../src/domain/portals/participations";
import { itemState, mergeItemSettings, portalItemDueDay, type PortalItemSettings } from "../src/domain/portals/items";
import { resolveCapability, resolveField, type PermissionSource } from "../src/domain/portals/permissions";

const DAY = 24 * 60 * 60 * 1000;
const TZ = "UTC";

function session(over: Partial<NonNullable<Participation["session"]>> = {}, p: Partial<Participation> = {}): Participation {
  return {
    key: "p:1",
    kind: "session",
    eventId: "e1",
    contactId: "c1",
    contactName: "Priya Raman",
    role: "speaker",
    participationStatus: "none",
    session: {
      submissionId: "s1",
      participantId: "1",
      title: "Taming 40-Minute CI",
      ref: "DFC-014",
      status: "accepted",
      origin: "cfp",
      format: "Talk (30 min)",
      trackIds: ["t-platform"],
      ...over,
    },
    company: null,
    eventRole: null,
    customFields: {},
    ...p,
  };
}

function company(over: Partial<NonNullable<Participation["company"]>> = {}): Participation {
  return {
    key: "c:1",
    kind: "company",
    eventId: "e1",
    contactId: "c1",
    contactName: "Priya Raman",
    role: "contact",
    participationStatus: "none",
    session: null,
    company: {
      sponsorContactId: "1",
      sponsorshipId: "sp1",
      companyId: "co1",
      companyName: "Latticework Systems",
      tierId: "gold",
      tierName: "Gold",
      sponsorshipStatus: "active",
      isPrimary: true,
      ...over,
    },
    eventRole: null,
    customFields: {},
  };
}

const INVITED_SPEAKERS: PortalRule = parsePortalRule({
  groups: [
    {
      conditions: [
        { field: "role", op: "is_any_of", values: ["speaker", "moderator", "panelist"] },
        { field: "arrival", op: "is", values: ["organizer"] },
      ],
    },
    { conditions: [{ field: "format", op: "is", values: ["Keynote (45 min)"] }] },
  ],
});

describe("rule matching", () => {
  it("matches when every condition of any one group holds", () => {
    expect(matchesRule(INVITED_SPEAKERS, session({ origin: "organizer" }, { role: "panelist" }))).toBe(true);
    expect(matchesRule(INVITED_SPEAKERS, session({ origin: "cfp", format: "Keynote (45 min)" }))).toBe(true);
    expect(matchesRule(INVITED_SPEAKERS, session({ origin: "cfp" }))).toBe(false);
    expect(matchesRule(INVITED_SPEAKERS, session({ origin: "organizer" }, { role: "co-presenter" }))).toBe(false);
  });

  it("negative conditions exclude, and fields a participation lacks count as empty", () => {
    const everyoneButPress = parsePortalRule({
      groups: [{ conditions: [{ field: "role", op: "is_none_of", values: ["press"] }] }],
    });
    expect(matchesRule(everyoneButPress, session())).toBe(true);
    expect(matchesRule(everyoneButPress, { ...session(), role: "press" })).toBe(false);

    const noTier = parsePortalRule({ groups: [{ conditions: [{ field: "sponsor_tier", op: "is_empty", values: [] }] }] });
    expect(matchesRule(noTier, session())).toBe(true);
    expect(matchesRule(noTier, company())).toBe(false);
  });

  it("matches a session on any of its tracks, case-insensitively, and custom fields", () => {
    const rule = parsePortalRule({
      groups: [
        {
          conditions: [
            { field: "track", op: "is", values: ["T-PLATFORM"] },
            { field: "custom:travel", op: "is", values: ["funded"] },
          ],
        },
      ],
    });
    expect(matchesRule(rule, session({}, { customFields: { travel: "Funded" } }))).toBe(true);
    expect(matchesRule(rule, session({ trackIds: ["t-data"] }, { customFields: { travel: "Funded" } }))).toBe(false);
  });

  it("an empty rule matches nobody", () => {
    expect(matchesRule({ groups: [] }, session())).toBe(false);
    expect(matchesRule({ groups: [{ conditions: [] }] }, session())).toBe(false);
  });

  it("refuses malformed rules with a sentence", () => {
    expect(() => parsePortalRule({ groups: [{ conditions: [{ field: "nope", op: "is", values: ["x"] }] }] })).toThrow(/Unknown rule field/);
    expect(() => parsePortalRule({ groups: [{ conditions: [{ field: "role", op: "is", values: [] }] }] })).toThrow(/needs at least one value/);
    expect(() => parsePortalRule({})).toThrow(/list of groups/);
  });

  it("describes a rule in plain language", () => {
    const text = describeRule(INVITED_SPEAKERS, {
      field: (f) => ({ role: "Role", arrival: "How the session arrived", format: "Session format" })[f] ?? f,
      value: (_f, v) => ({ speaker: "Speaker", moderator: "Moderator", panelist: "Panelist", organizer: "Invited by organizers" })[v] ?? v,
    });
    expect(text).toBe(
      "Role is Speaker, Moderator or Panelist and How the session arrived is Invited by organizers, or Session format is Keynote (45 min)",
    );
  });
});

describe("participation lifecycle", () => {
  it("a declined participation leaves every portal; an invited one is matched but not active", () => {
    expect(isMatchableParticipation(session({}, { participationStatus: "declined" }))).toBe(false);
    const invited = session({}, { participationStatus: "invited" });
    expect(isMatchableParticipation(invited)).toBe(true);
    expect(isActiveParticipation(invited)).toBe(false);
    expect(isActiveParticipation(session())).toBe(true);
  });

  it("names why a participation is in no portal", () => {
    const label = (r: string) => r[0]!.toUpperCase() + r.slice(1);
    expect(unmatchedReason(session({ status: "declined" }), label)).toBe("Session declined");
    expect(unmatchedReason(session({ status: "pending" }), label)).toBe("Session still in review");
    expect(unmatchedReason(company({ sponsorshipStatus: "pending" }), label)).toBe("Sponsorship not yet active");
    expect(unmatchedReason({ ...session(), kind: "event_role", session: null, role: "press" }, label)).toBe("No portal covers press");
  });
});

function settings(over: Partial<PortalItemSettings>): PortalItemSettings {
  return {
    portalId: "p",
    portalName: "Portal",
    displayName: null,
    deadlineKind: "none",
    dueDate: null,
    relativeDays: null,
    required: false,
    graceDays: 0,
    allowEditAfterSubmit: false,
    viewOnlyWhenDone: false,
    ...over,
  };
}

describe("an item from two portals", () => {
  const apr3 = Date.UTC(2027, 3, 3);
  const apr10 = Date.UTC(2027, 3, 10);

  it("takes the earliest deadline, is required if either requires it, and keeps the longer grace", () => {
    const merged = mergeItemSettings([
      { settings: settings({ portalId: "pb", portalName: "Profile basics", deadlineKind: "fixed", dueDate: apr10, graceDays: 7 }), dueDay: apr10 },
      { settings: settings({ portalId: "inv", portalName: "Invited speakers", deadlineKind: "fixed", dueDate: apr3, required: true }), dueDay: apr3 },
    ]);
    expect(merged.dueDay).toBe(apr3);
    expect(merged.required).toBe(true);
    expect(merged.graceDays).toBe(7);
    expect(merged.deadlineFrom).toBe("Invited speakers");
    expect(merged.requiredFrom).toBe("Invited speakers");
    expect(merged.portals.map((p) => p.name)).toEqual(["Profile basics", "Invited speakers"]);
  });

  it("is view-only if either portal says so, and editable after submitting if either allows it", () => {
    const merged = mergeItemSettings([
      { settings: settings({ viewOnlyWhenDone: true }), dueDay: null },
      { settings: settings({ allowEditAfterSubmit: true }), dueDay: null },
    ]);
    expect(merged.viewOnlyWhenDone).toBe(true);
    expect(merged.allowEditAfterSubmit).toBe(true);
    expect(merged.dueDay).toBeNull();
  });
});

describe("deadlines", () => {
  it("relative deadlines count from activation and have no date before it", () => {
    const accepted = Date.UTC(2027, 2, 13, 15, 0);
    expect(portalItemDueDay({ deadlineKind: "relative", dueDate: null, relativeDays: 14 }, accepted, TZ)).toBe(Date.UTC(2027, 2, 27));
    expect(portalItemDueDay({ deadlineKind: "relative", dueDate: null, relativeDays: 14 }, null, TZ)).toBeNull();
    expect(portalItemDueDay({ deadlineKind: "fixed", dueDate: Date.UTC(2027, 4, 1), relativeDays: null }, null, TZ)).toBe(Date.UTC(2027, 4, 1));
  });

  it("overdue inside grace stays open; past grace it closes", () => {
    const due = Date.UTC(2027, 7, 1);
    const base = { done: false, required: true, dueDay: due, timeZone: TZ };
    expect(itemState({ ...base, graceDays: 7, now: due + 3 * DAY })).toBe("overdue_open");
    expect(itemState({ ...base, graceDays: 7, now: due + 9 * DAY })).toBe("closed");
    expect(itemState({ ...base, graceDays: 0, now: due + 2 * DAY })).toBe("closed");
    expect(itemState({ ...base, graceDays: 0, now: due - DAY })).toBe("todo");
    expect(itemState({ ...base, required: false, graceDays: 0, now: due - DAY })).toBe("optional");
    expect(itemState({ ...base, done: true, graceDays: 0, now: due + 30 * DAY })).toBe("done");
  });
});

function source(over: Partial<PermissionSource>): PermissionSource {
  return { portalName: "Portal", participationKey: "p:1", participationPhrase: "your talk", fields: {}, capabilities: {}, ...over };
}

describe("profile field permissions", () => {
  it("the strictest portal wins and names the participation that caused it", () => {
    const bio = resolveField("headshot", [
      source({ portalName: "Profile basics", fields: { headshot: { level: "edit" } } }),
      source({ portalName: "Invited speakers", participationPhrase: "your invited panel", fields: { headshot: { level: "view" } } }),
    ]);
    expect(bio.level).toBe("view");
    expect(bio.lockedBy).toEqual({ portalName: "Invited speakers", participationPhrase: "your invited panel" });
  });

  it("a field no portal mentions keeps today's default", () => {
    expect(resolveField("bio", []).level).toBe("edit");
    // today's profile page shows neither email nor phone
    expect(resolveField("email", []).level).toBe("hidden");
    expect(resolveField("phone", []).level).toBe("hidden");
    expect(resolveField("bio", []).lockedBy).toBeNull();
  });

  it("a portal that names a field decides it outright, even above the default", () => {
    const ask = (level: "hidden" | "view" | "edit", name: string) => ({
      portalName: name,
      participationKey: `p:${name}`,
      participationPhrase: `your ${name.toLowerCase()}`,
      fields: { phone: { level } },
      capabilities: {},
    });
    expect(resolveField("phone", [ask("edit", "Talk")]).level).toBe("edit");
    expect(resolveField("phone", [ask("edit", "Talk")]).lockedBy).toBeNull();
    const both = resolveField("phone", [ask("edit", "Talk"), ask("view", "Panel")]);
    expect(both.level).toBe("view");
    expect(both.lockedBy?.participationPhrase).toBe("your panel");
  });
});

describe("capabilities", () => {
  it("are granted if any covering portal grants them", () => {
    const sources = [source({ capabilities: { editSubmission: false } }), source({ capabilities: { editSubmission: true } })];
    expect(resolveCapability("editSubmission", sources)).toBe(true);
    expect(resolveCapability("addTeammates", sources)).toBe(false);
  });

  it("a participation no portal covers keeps today's abilities", () => {
    expect(resolveCapability("editSubmission", [])).toBe(true);
    expect(resolveCapability("addCoPresenters", [])).toBe(true);
    expect(resolveCapability("createSponsorSessions", [])).toBe(false);
  });

  it("a covering portal that leaves an action off takes it away", () => {
    expect(resolveCapability("editSubmission", [source({ capabilities: {} })])).toBe(false);
  });
});
