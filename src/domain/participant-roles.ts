// DEC-604: one exported participant-role vocabulary, imported by both the
// speaker portal's add-co-presenter form and every place a participant's
// role is rendered (portal edit page, portal submission detail) — never a
// second hand-copied list (field guide: "hand-copied vocabularies drift").
// Pure core (DEC-002): no node:/cloudflare/drizzle imports.

export interface ParticipantRoleOption {
  value: string;
  label: string;
}

// The default role stamped on the original CFP submitter
// (src/server/repo/submit.ts:createParticipant) and on organizer-invited
// participants that don't specify a role
// (src/server/repo/participants.ts:inviteParticipant) now has a name:
// DEFAULT_PARTICIPANT_ROLE, below — included here so its label resolves
// through the same table as every other role. The remaining three are the
// roles a speaker may choose when self-adding a co-presenter.
export const PARTICIPANT_ROLE_OPTIONS: readonly ParticipantRoleOption[] = [
  { value: "speaker", label: "Speaker" },
  { value: "co-presenter", label: "Co-presenter" },
  { value: "moderator", label: "Moderator" },
  { value: "panelist", label: "Panelist" },
];

export const CO_PRESENTER_ROLE_VALUES: readonly string[] = PARTICIPANT_ROLE_OPTIONS.filter(
  (o) => o.value !== "speaker",
).map((o) => o.value);

export function isCoPresenterRoleValue(value: string): boolean {
  return CO_PRESENTER_ROLE_VALUES.includes(value);
}

// DEC-604 (wave-76 amendment): the default participant role, derived from
// the vocabulary above (never a second hand-copied literal) — same
// discipline as CO_PRESENTER_ROLE_VALUES above.
export const DEFAULT_PARTICIPANT_ROLE: string = PARTICIPANT_ROLE_OPTIONS[0]!.value;

export function isDefaultParticipantRole(role: string): boolean {
  return role === DEFAULT_PARTICIPANT_ROLE;
}

/** Resolves a stored participant.role value to its display label. A role
 * value outside this vocabulary (e.g. a free-text role set by an organizer
 * via POST /api/v1/submissions/:id/participants, which accepts arbitrary
 * text) is rendered as-is rather than dropped. */
export function participantRoleLabel(role: string): string {
  const found = PARTICIPANT_ROLE_OPTIONS.find((o) => o.value === role);
  return found ? found.label : role;
}

// DEC-422 (wave-67 amendment) / DEC-604: 1 original submitter + up to 5
// more -- a submission may never carry more than this many participant
// rows in total, PERIOD. This is a property of the SUBMISSION, enforced at
// BOTH doors that can add a participant row: the organizer's invite
// endpoint (POST /api/v1/submissions/:id/participants ->
// src/server/repo/participants.ts:inviteParticipant) and the speaker
// portal's add-co-presenter form (src/server/repo/portal-edit.ts:
// addCoPresenter) -- not a portal-path-only rule. Moved out of
// src/server/repo/portal-edit.ts (a drizzle-importing repo module the SPA
// cannot import) so the add-co-presenter form can disclose the real
// remaining headroom.
export const MAX_PARTICIPANTS_PER_SUBMISSION = 6;
