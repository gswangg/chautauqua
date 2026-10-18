// Multi-portal participations (docs/design/multi-portal/BUILD-PLAN.md): the
// unit a portal rule matches. A person has one participation per role on a
// session, per sponsor company they belong to at an event, and per
// event-level role (Press, Volunteer). Pure core: no node:/drizzle imports.

import { PARTICIPANT_ROLE_OPTIONS, participantRoleLabel } from "../participant-roles";

export const PARTICIPATION_KINDS = ["session", "company", "event_role"] as const;
export type ParticipationKind = (typeof PARTICIPATION_KINDS)[number];

export const PARTICIPATION_KIND_LABELS: Record<ParticipationKind, string> = {
  session: "A role on a session",
  company: "Contact at a sponsor",
  event_role: "An event role, no session",
};

// How a session arrived. 'organizer' is a session the organizers created
// themselves, which the brief calls "invited by organizers".
export const SESSION_ORIGINS = ["cfp", "organizer", "sponsor", "import"] as const;
export type SessionOrigin = (typeof SESSION_ORIGINS)[number];

export const SESSION_ORIGIN_LABELS: Record<SessionOrigin, string> = {
  cfp: "Through the CFP",
  organizer: "Invited by organizers",
  sponsor: "Designed by a sponsor",
  import: "Imported",
};

export function isSessionOrigin(value: string): value is SessionOrigin {
  return (SESSION_ORIGINS as readonly string[]).includes(value);
}

export const SPONSORSHIP_STATUSES = ["pending", "active"] as const;
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];

// The role value every sponsor-company participation carries.
export const COMPANY_CONTACT_ROLE = "contact";

// Event-level roles with no session or company (Portals frame: "Press · no
// session", the Volunteers portal). Stored lower-case in event_role.role.
export const EVENT_ROLE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "volunteer", label: "Volunteer" },
  { value: "press", label: "Press" },
  { value: "host", label: "Host" },
  { value: "staff", label: "Staff" },
];

export function isEventRole(value: string): boolean {
  return EVENT_ROLE_OPTIONS.some((o) => o.value === value);
}

export function eventRoleLabel(value: string): string {
  return EVENT_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Any participation role's label: session roles, event roles, "Contact". */
export function participationRoleLabel(role: string): string {
  if (role === COMPANY_CONTACT_ROLE) return "Contact";
  if (isEventRole(role)) return eventRoleLabel(role);
  return participantRoleLabel(role);
}

/** Every role value a rule can name, labelled, for the rule builder. */
export const RULE_ROLE_OPTIONS: readonly { value: string; label: string }[] = [
  ...PARTICIPANT_ROLE_OPTIONS,
  { value: COMPANY_CONTACT_ROLE, label: "Sponsor contact" },
  ...EVENT_ROLE_OPTIONS,
];

export interface Participation {
  key: string;
  kind: ParticipationKind;
  eventId: string;
  contactId: string;
  contactName: string;
  role: string;
  // participant.invite_status for session participations ('none' |
  // 'invited' | 'accepted' | 'declined'); 'none' for the other kinds, and
  // 'invited' for a sponsor teammate who hasn't joined yet.
  participationStatus: string;
  session: {
    submissionId: string;
    participantId: string;
    title: string;
    ref: string;
    status: string;
    origin: SessionOrigin;
    format: string | null;
    trackIds: string[];
  } | null;
  company: {
    sponsorContactId: string;
    sponsorshipId: string;
    companyId: string;
    companyName: string;
    tierId: string | null;
    tierName: string | null;
    sponsorshipStatus: SponsorshipStatus;
    isPrimary: boolean;
  } | null;
  eventRole: { eventRoleId: string } | null;
  customFields: Record<string, string>;
}

export function sessionParticipationKey(participantId: string): string {
  return `p:${participantId}`;
}

export function companyParticipationKey(sponsorContactId: string): string {
  return `c:${sponsorContactId}`;
}

export function eventRoleParticipationKey(eventRoleId: string): string {
  return `r:${eventRoleId}`;
}

/** Declining an invitation ends the participation: it leaves every portal
 * (Portals frame, flow 8). Every other participation is matched. */
export function isMatchableParticipation(p: Participation): boolean {
  return p.participationStatus !== "declined";
}

/** An unanswered invitation is matched (so the invitee can see what
 * accepting brings) but not yet active: nothing is due, nothing is
 * assigned, and relative deadlines start when it is accepted. */
export function isActiveParticipation(p: Participation): boolean {
  return p.participationStatus !== "invited" && p.participationStatus !== "declined";
}

/** "Speaker · DFC-014 Taming 40-Minute CI", "Contact · Latticework
 * Systems", "Press · no session". */
export function participationLabel(p: Participation, roleLabel: (role: string) => string): string {
  if (p.session) return `${roleLabel(p.role)} · ${p.session.ref} ${p.session.title}`;
  if (p.company) return `Contact · ${p.company.companyName}`;
  return `${roleLabel(p.role)} · no session`;
}

/** The organizer-facing reason a participation is in no portal (Speakers ·
 * not in any portal). */
export function unmatchedReason(p: Participation, roleLabel: (role: string) => string): string {
  if (p.session) {
    if (p.session.status === "declined") return "Session declined";
    if (p.session.status !== "accepted") return "Session still in review";
  }
  if (p.company && p.company.sponsorshipStatus !== "active") return "Sponsorship not yet active";
  if (p.participationStatus === "invited" && p.company) return "Hasn't joined yet";
  return `No portal covers ${roleLabel(p.role).toLowerCase()}`;
}
