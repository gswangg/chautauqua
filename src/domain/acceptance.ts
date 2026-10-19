// J6 acceptance planning (DEC-009): a pure function that describes the
// onboarding tasks a newly-accepted submission should create. Callers persist
// the returned descriptors; this module performs no I/O and no email.

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

/** DEC-009's onboarding set, in order. Multi-portal decision 76: the
 * product no longer creates it on acceptance (portals are the one engine);
 * it survives as seed data -- the demo event's pre-portal history
 * (scripts/seed.ts) and the scale walkthrough's fixture. */
export const DEFAULT_ONBOARDING_TASKS: readonly OnboardingTaskTemplate[] = [
  { title: "Hotel stay requirement form", kind: "form", required: true, dueDaysBeforeEventStart: 30 },
  { title: "Flight reimbursement form", kind: "form", required: true, dueDaysBeforeEventStart: 30 },
  { title: "Finalize talk description", kind: "general", required: false, dueDaysBeforeEventStart: 21 },
  // the pre-portal bio + headshot ask; the built-in Bio and Headshot items
  // replace it (decision 78 folds it out of the demo event)
  { title: "Finalize bio + headshot", kind: "general", required: false, dueDaysBeforeEventStart: 21 },
  { title: "Announce participation", kind: "general", required: false, dueDaysBeforeEventStart: 14 },
];


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
 * DEC-974 amendment / DEC-317: the NOT-DECLINED population — 'none' or
 * 'invited' or 'accepted', excluding only 'declined'. Serves two named
 * readers with distinct intents that DEC-180's wave-75 amendment identified
 * as the SAME member set: (1) the ORGANISER surface (conflict engine's
 * speaker set, admin agenda card, results page/export) — an organiser-added
 * co-presenter is minted at inviteStatus 'invited' (participants.ts) and
 * must still be visible for scheduling/results purposes, since an
 * invited-but-not-yet-accepted person still cannot be in two rooms at once
 * and still spoke on the session; (2) portal/file READ access — a
 * participant may still SEE their submission while an invite is outstanding
 * (write access is gated separately by ACTIVE_INVITE_STATUSES, a strict
 * subset that excludes 'invited'). One declaration; PORTAL_VISIBLE_INVITE_STATUSES
 * is a re-export of the same array under its portal-facing name so each call
 * site can use the name matching its own reader without a second
 * declaration to drift. Deliberately distinct from ACTIVE_INVITE_STATUSES,
 * which gates WRITE access (portal editing, file uploads, task planning,
 * compose recipients) and public-facing visibility — those surfaces must NOT
 * show or act on an invite that hasn't been accepted yet.
 */
export const SCHEDULING_PARTICIPANT_STATUSES = ["none", "invited", "accepted"] as const satisfies readonly InviteStatus[];

/**
 * DEC-317 / DEC-180 wave-75 amendment: re-export of SCHEDULING_PARTICIPANT_STATUSES
 * under the name portal/file read-access call sites use. Same declaration,
 * same array reference — see the doc comment above for why the two names
 * exist and what would make them diverge (they must not; a divergence would
 * need a new, differently-named constant, not a change to either of these).
 */
export const PORTAL_VISIBLE_INVITE_STATUSES = SCHEDULING_PARTICIPANT_STATUSES;

