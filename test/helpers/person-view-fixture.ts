// Builders for the multi-portal person view (src/server/repo/portals/view.ts)
// so a route test that stands in getPortalHome can describe a home without a
// database. Defaults describe one CFP speaker on one accepted talk.
import type { PersonView, ViewItem, ViewSection } from "../../src/server/repo/portals/view";
import type { Participation } from "../../src/domain/portals/participations";
import { PROFILE_FIELDS, SESSION_FIELDS, resolveField } from "../../src/domain/portals/permissions";
import type { PortalHome } from "../../src/server/repo/portal/home";
import { effectiveAssignmentDueDayLabel, isAssignmentOverdue } from "../../src/domain/task-due";

export function itemFixture(over: Partial<ViewItem> = {}): ViewItem {
  return {
    key: over.key ?? `task-${over.taskId ?? "t1"}|`,
    kind: "general",
    title: "Task",
    taskId: "t1",
    formId: null,
    assignmentId: "a1",
    scopeKey: "",
    state: "todo",
    required: true,
    dueDay: null,
    graceDays: 0,
    canAct: true,
    completedAt: null,
    portals: [],
    direct: true,
    merge: null,
    detached: false,
    statusLine: null,
    statusWord: null,
    openUntil: null,
    instructions: null,
    ...over,
  };
}

export function sessionParticipation(over: Partial<Participation> & { submissionId?: string; title?: string } = {}): Participation {
  const submissionId = over.submissionId ?? "sub-1";
  return {
    key: `p:part-${submissionId}`,
    kind: "session",
    eventId: "evt-1",
    contactId: "ct-1",
    contactName: "Dana Whitmore",
    role: "speaker",
    participationStatus: "none",
    session: {
      submissionId,
      participantId: `part-${submissionId}`,
      title: over.title ?? "Docs That Answer Back",
      ref: "DFC-001",
      status: "accepted",
      origin: "cfp",
      format: "Talk (30 min)",
      trackIds: [],
    },
    company: null,
    eventRole: null,
    customFields: {},
    ...over,
  };
}

export function sectionFixture(participation: Participation, over: Partial<ViewSection> = {}): ViewSection {
  return {
    participation,
    heading: "Your talk",
    phrase: "your talk",
    notes: [],
    items: [],
    deferredItemNames: [],
    deferredItems: [],
    invitation: null,
    sponsor: null,
    capabilities: { editSubmission: true, addCoPresenters: true, addTeammates: false, createSponsorSessions: false },
    sessionFields: Object.fromEntries(SESSION_FIELDS.map((f) => [f, resolveField(f, [])])) as ViewSection["sessionFields"],
    ...over,
  };
}

export function viewFixture(over: Partial<PersonView> = {}): PersonView {
  const sections = over.sections ?? [];
  const profileItems = over.profileItems ?? [];
  const countable = (i: ViewItem) => i.state === "todo" || i.state === "overdue_open";
  return {
    eventId: "evt-1",
    eventName: "Arbitrary Con",
    timezone: "UTC",
    contactId: "ct-1",
    participations: sections.map((s) => ({
      participation: s.participation,
      label: s.heading,
      portals: [],
      active: true,
      declined: false,
      unmatchedReason: null,
    })),
    profileItems,
    profileNotes: [],
    sections,
    profileFields: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, resolveField(f, [])])) as PersonView["profileFields"],
    todoCount: profileItems.filter(countable).length + sections.reduce((n, s) => n + s.items.filter(countable).length, 0),
    resourceIds: [],
    needsReconcile: false,
    ...over,
  };
}

export function homeFixture(views: PersonView[]): PortalHome {
  return { views, placements: new Map() };
}

/** A home built from the legacy portal readers' shapes (getMySessions,
 * getMyTaskAssignments, getMyInvitations), for route tests written before
 * the participation home: sessions become accepted-session sections, task
 * assignments become the person's direct items, invitations become invited
 * sections. The rules match buildPersonView's for direct items. */
export function homeFromLegacy(input: {
  sessions?: import("../../src/server/repo/portal").PortalSession[];
  tasks?: import("../../src/server/repo/portal").PortalTaskAssignment[];
  invitations?: import("../../src/server/repo/portal").PortalInvitation[];
  now?: number;
}): PortalHome {
  const now = input.now ?? Date.now();
  const sections: ViewSection[] = [];
  for (const s of input.sessions ?? []) {
    const p = sessionParticipation({ submissionId: s.submissionId, title: s.title, eventId: s.eventId });
    p.session!.format = s.format;
    const noun = s.format ? s.format.replace(/\s*\(.*\)\s*$/, "").toLowerCase() : "session";
    sections.push(sectionFixture(p, { heading: `Your ${noun}`, phrase: `your ${noun}` }));
  }
  for (const inv of input.invitations ?? []) {
    const p = sessionParticipation({ submissionId: inv.submissionId, title: inv.title, role: "co-presenter", participationStatus: "invited" });
    p.session!.participantId = inv.participantId;
    p.key = `p:${inv.participantId}`;
    sections.push(sectionFixture(p, { heading: "Invitation", phrase: "your invitation" }));
  }
  const profileItems: ViewItem[] = (input.tasks ?? []).map((t) => {
    const done = t.status === "complete";
    const dueDay = effectiveAssignmentDueDayLabel(t.dueDate, t.assignedAt, t.timezone);
    const overdue = !done && isAssignmentOverdue(t.dueDate, t.assignedAt, now, t.timezone);
    return itemFixture({
      key: `${t.taskId}|`,
      kind: t.kind,
      title: t.title,
      taskId: t.taskId,
      formId: t.formId,
      assignmentId: t.id,
      state: done ? "done" : overdue ? "overdue_open" : "todo",
      required: t.required,
      dueDay,
      completedAt: t.completedAt,
      instructions: t.instructions,
      description: t.description,
    });
  });
  const view = viewFixture({ profileItems, sections, eventName: input.sessions?.[0]?.eventName ?? "Arbitrary Con" });
  return homeFixture(sections.length + profileItems.length > 0 ? [view] : []);
}
