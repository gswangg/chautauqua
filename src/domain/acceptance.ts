// J6 acceptance planning (DEC-009): a pure function that describes the
// onboarding tasks a newly-accepted submission should create. Callers persist
// the returned descriptors; this module performs no I/O and no email.

import { isIsoDate } from "./iso-date";
import type { InviteStatus } from "./invite-status"; // DEC-789 wave-73 amendment

// DEC-615 (wave 73): FormFieldKind is the ONE kind vocabulary, declared as
// an `as const` array in ../forms/types. acceptance.ts is pure core (no
// node:/cloudflare/drizzle) and ../forms/types is too, so a type-only import
// keeps this module dependency-free at runtime.
import type { FormFieldKind } from "../forms/types";

// Re-exported from the pure vocabulary module (DEC-613 wave-70 amendment) —
// the ONE set shared with src/routes/tasks.ts, src/server/repo/portal/tasks.ts,
// and the app's speakers pages.
import type { TaskKind } from "./task-kinds";
export type { TaskKind };

export interface OnboardingTaskTemplate {
  title: string;
  kind: TaskKind;
  required: boolean;
  /** DEC-520: how many days before the event's start date this task is due
   * — logistics (travel forms) need the most lead time, content next,
   * promotion closest to the show. */
  dueDaysBeforeEventStart: number;
}

/** DEC-009 amendment (wave 59): the canonical title of the profile-completion
 * onboarding task, shared with src/server/repo/profile.ts (which closes the
 * assignment once a contact has BOTH a bio and a headshot) and
 * src/routes/portal/tasks/views.tsx (which renders it as a link to
 * /portal/profile rather than an upload widget). */
export const PROFILE_TASK_TITLE = "Finalize bio + headshot";

/** DEC-009 canonical onboarding task set, in order. */
export const DEFAULT_ONBOARDING_TASKS: readonly OnboardingTaskTemplate[] = [
  { title: "Hotel stay requirement form", kind: "form", required: true, dueDaysBeforeEventStart: 30 },
  { title: "Flight reimbursement form", kind: "form", required: true, dueDaysBeforeEventStart: 30 },
  { title: "Finalize talk description", kind: "general", required: false, dueDaysBeforeEventStart: 21 },
  // DEC-009 amendment (wave 59): was kind 'file_request', which routed
  // completion through the FILE_KINDS deliverable pipeline (files.ts) — a
  // mis-typed session file, never the contact's real bio/headshot. 'general'
  // means the portal renders it as a link to /portal/profile instead of an
  // upload widget; src/server/repo/profile.ts closes the assignment
  // set-based once a saved profile carries both fields.
  { title: PROFILE_TASK_TITLE, kind: "general", required: false, dueDaysBeforeEventStart: 21 },
  { title: "Announce participation", kind: "general", required: false, dueDaysBeforeEventStart: 14 },
];

/**
 * DEC-520/DEC-522: computes an onboarding task's due date as a UTC-midnight
 * DAY LABEL (not an event-local instant) — `dueDaysBeforeEventStart` days
 * before the event's start date. `eventStartDate` must be a strict
 * 'YYYY-MM-DD' string that round-trips through Date.UTC; anything else
 * throws rather than silently producing a wrong or NaN due date. A result
 * that already lies in the past is returned as-is (no clamping — DEC-520c).
 *
 * DEC-510 (wave 46 amendment): the shape+round-trip check delegates to
 * src/domain/iso-date.ts's isIsoDate — the ONE grammar for YYYY-MM-DD,
 * rather than a second hand-rolled regex.
 */
export function onboardingTaskDueDate(eventStartDate: string, dueDaysBeforeEventStart: number): number {
  if (!isIsoDate(eventStartDate)) {
    throw new Error(`onboardingTaskDueDate: malformed event start date "${eventStartDate}"`);
  }
  const parts = eventStartDate.split("-").map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;
  const ms = Date.UTC(year, month - 1, day);
  return ms - dueDaysBeforeEventStart * 86_400_000;
}

/** DEC-008 form-field kinds usable in a field spec (DEC-040 amendment, wave
 * 70: the portal task-form POST now has a real multipart upload path — see
 * src/routes/portal/tasks.tsx's /tasks/:assignmentId/form handler). */
export type FormTaskFieldKind = FormFieldKind;

export interface FormTaskFieldSpec {
  section: "speaker";
  kind: FormTaskFieldKind;
  label: string;
  required: boolean;
  options?: string[];
}

/**
 * DEC-111: pure-data field specs for the two must-have acceptance form
 * tasks, keyed by the exact task/form title. Consumed by the repo layer to
 * find-or-create a backing schema.form + schema.formField rows, never
 * referenced for I/O here.
 */
export const FORM_TASK_FIELD_SPECS: Readonly<Record<string, readonly FormTaskFieldSpec[]>> = {
  "Hotel stay requirement form": [
    {
      section: "speaker",
      kind: "dropdown",
      label: "Do you need a hotel room?",
      required: true,
      options: ["Yes", "No"],
    },
    { section: "speaker", kind: "text", label: "Check-in date", required: false },
    { section: "speaker", kind: "text", label: "Check-out date", required: false },
    { section: "speaker", kind: "long_text", label: "Special requests", required: false },
  ],
  "Flight reimbursement form": [
    {
      section: "speaker",
      kind: "dropdown",
      label: "Do you need flight reimbursement?",
      required: true,
      options: ["Yes", "No"],
    },
    { section: "speaker", kind: "text", label: "Departure airport", required: false },
    {
      section: "speaker",
      kind: "number",
      label: "Estimated reimbursement amount (USD)",
      required: false,
    },
    { section: "speaker", kind: "long_text", label: "Notes", required: false },
    { section: "speaker", kind: "file", label: "Receipt or booking confirmation", required: false },
  ],
};

/**
 * DEC-278: the TS-layer twin of DEC-274's SQL-layer visibility gate — the
 * `inArray(schema.participant.inviteStatus, ["none", "accepted"])` clause in
 * `visibleSubmissionConditions()` (src/server/repo/public.ts). Both must
 * carry the identical two literals; a participant is "active" (eligible for
 * onboarding-task planning / public visibility) iff their invite is either
 * unsent ('none') or accepted ('accepted') — never 'invited' or 'declined'.
 */
export const ACTIVE_INVITE_STATUSES = ["none", "accepted"] as const satisfies readonly InviteStatus[];

export function isActiveParticipant(inviteStatus: string): boolean {
  return (ACTIVE_INVITE_STATUSES as readonly string[]).includes(inviteStatus);
}

/**
 * DEC-974 amendment: the NOT-DECLINED population an ORGANISER surface (the
 * conflict engine's speaker set, the admin agenda card, the results
 * page/export) uses — 'none' or 'invited' or 'accepted', excluding only
 * 'declined'. An organiser-added co-presenter is minted at inviteStatus
 * 'invited' (participants.ts) and must still be visible for scheduling and
 * results purposes: an invited-but-not-yet-accepted person still cannot be
 * in two rooms at once, and still spoke on the session for results purposes.
 * Deliberately distinct from ACTIVE_INVITE_STATUSES, which gates WRITE
 * access (portal editing, file uploads, task planning, compose recipients)
 * and public-facing visibility — those surfaces must NOT show or act on an
 * invite that hasn't been accepted yet.
 */
export const SCHEDULING_PARTICIPANT_STATUSES = ["none", "invited", "accepted"] as const satisfies readonly InviteStatus[];

/**
 * DEC-317: participant invite state gates portal and file access on two
 * levels — read=not-declined (a participant may still SEE their submission
 * while an invite is outstanding), write=active (only ACTIVE_INVITE_STATUSES
 * may edit/upload). "invited" participants are portal-visible (read) but not
 * active (no write); "declined" participants are excluded from both.
 */
export const PORTAL_VISIBLE_INVITE_STATUSES = ["none", "accepted", "invited"] as const satisfies readonly InviteStatus[];

export interface PlanAcceptanceInput {
  submissionId: string;
  eventId: string;
  participantContactIds: string[];
  existingTaskTitlesByContact: Record<string, string[]>;
}

export interface PlannedTaskAssignment {
  contactId: string;
  taskTitle: string;
  taskKind: TaskKind;
  required: boolean;
  dueDaysBeforeEventStart: number;
}

export interface PlanAcceptanceResult {
  taskAssignments: PlannedTaskAssignment[];
}

/**
 * Plans the DEFAULT_ONBOARDING_TASKS assignments for each participant
 * contact, skipping any (contact, title) pair already present in
 * existingTaskTitlesByContact. Planning is idempotent: running it again with
 * the previously-planned titles folded into existingTaskTitlesByContact
 * yields an empty taskAssignments list.
 */
export function planAcceptance(input: PlanAcceptanceInput): PlanAcceptanceResult {
  const taskAssignments: PlannedTaskAssignment[] = [];
  for (const contactId of input.participantContactIds) {
    const existingTitles = new Set(input.existingTaskTitlesByContact[contactId] ?? []);
    for (const template of DEFAULT_ONBOARDING_TASKS) {
      if (existingTitles.has(template.title)) continue;
      taskAssignments.push({
        contactId,
        taskTitle: template.title,
        taskKind: template.kind,
        required: template.required,
        dueDaysBeforeEventStart: template.dueDaysBeforeEventStart,
      });
    }
  }
  return { taskAssignments };
}
