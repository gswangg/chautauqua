// Starter portals (Portals frame, flow 1 "Start from a template"). Each
// names its rule, the library items it brings (found by title in the event's
// library, or created), its permissions and its note. Pure core.

import type { PortalRule } from "./rules";
import type { Capabilities, FieldPermissions } from "./permissions";
import type { DeadlineKind, ItemScope, SystemItemKind } from "./items";
import type { TaskKind } from "../task-kinds";

export interface TemplateItem {
  // a built-in item, or a library task found or created by title
  systemKind?: SystemItemKind;
  task?: { title: string; kind: TaskKind; scope: ItemScope; instructions?: string };
  deadlineKind: DeadlineKind;
  relativeDays?: number;
  required: boolean;
  graceDays?: number;
}

export interface PortalTemplate {
  key: string;
  name: string;
  blurb: string;
  note: string | null;
  rule: PortalRule;
  fieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  items: TemplateItem[];
}

const ACCEPTED_OR_ACTIVE_SPONSOR: PortalRule = {
  groups: [
    { conditions: [{ field: "session_status", op: "is", values: ["accepted"] }] },
    {
      conditions: [
        { field: "kind", op: "is", values: ["company"] },
        { field: "sponsorship_status", op: "is", values: ["active"] },
      ],
    },
  ],
};

// Every event's first portal (migration 0046, new events): its note is the
// event's welcome note.
export const PROFILE_BASICS_TEMPLATE = "profile_basics";

export const PORTAL_TEMPLATES: readonly PortalTemplate[] = [
  {
    key: PROFILE_BASICS_TEMPLATE,
    name: "Profile basics",
    blurb: "Profile and headshot for speakers and sponsor contacts",
    note: null,
    rule: ACCEPTED_OR_ACTIVE_SPONSOR,
    fieldPermissions: {},
    capabilities: { editSubmission: true, addCoPresenters: true },
    items: [
      { systemKind: "bio", deadlineKind: "none", required: true },
      { systemKind: "headshot", deadlineKind: "none", required: true },
    ],
  },
  {
    key: "cfp_speakers",
    name: "CFP speakers",
    blurb: "Slides, AV needs, speaker release",
    note: "As a CFP speaker, you'll share final slides and your AV needs.",
    rule: {
      groups: [
        {
          conditions: [
            { field: "arrival", op: "is", values: ["cfp"] },
            { field: "session_status", op: "is", values: ["accepted"] },
            { field: "role", op: "is_any_of", values: ["speaker", "co-presenter"] },
          ],
        },
      ],
    },
    fieldPermissions: {},
    capabilities: { editSubmission: true, addCoPresenters: true },
    items: [
      { task: { title: "Final slides", kind: "file_request", scope: "participation", instructions: "Upload the deck you'll present. PDF, Keynote or PowerPoint." }, deadlineKind: "none", required: true, graceDays: 7 },
      { task: { title: "AV needs", kind: "general", scope: "participation", instructions: "Tell us what you need on stage: mics, adapters, a clicker." }, deadlineKind: "none", required: true },
      { task: { title: "Speaker release", kind: "general", scope: "participation", instructions: "Agree to the recording and publishing of your session." }, deadlineKind: "none", required: true },
    ],
  },
  {
    key: "invited_speakers",
    name: "Invited speakers",
    blurb: "Accept the invitation, bio, travel",
    note: "As an invited speaker, you'll confirm your session and share a bio.",
    rule: {
      groups: [
        {
          conditions: [
            { field: "role", op: "is_any_of", values: ["speaker", "moderator", "panelist"] },
            { field: "arrival", op: "is", values: ["organizer"] },
          ],
        },
      ],
    },
    fieldPermissions: {},
    capabilities: { editSubmission: false, addCoPresenters: false },
    items: [
      { systemKind: "acceptance", deadlineKind: "none", required: true },
      { systemKind: "bio", deadlineKind: "none", required: true },
      { task: { title: "Travel form", kind: "general", scope: "person", instructions: "Your travel dates and where you're flying from." }, deadlineKind: "relative", relativeDays: 14, required: true },
    ],
  },
  {
    key: "sponsors",
    name: "Sponsors",
    blurb: "Logo, booth details, session design",
    note: "As a sponsor contact, you'll send booth details and design your sponsored sessions.",
    rule: {
      groups: [
        {
          conditions: [
            { field: "kind", op: "is", values: ["company"] },
            { field: "sponsorship_status", op: "is", values: ["active"] },
          ],
        },
      ],
    },
    fieldPermissions: {},
    capabilities: { addTeammates: true, createSponsorSessions: true },
    items: [
      { task: { title: "Logo and booth details", kind: "file_request", scope: "participation", instructions: "Your logo (SVG or PNG) and what you need at the booth." }, deadlineKind: "none", required: true, graceDays: 7 },
      { systemKind: "sponsor_sessions", deadlineKind: "none", required: true },
    ],
  },
];

export function findPortalTemplate(key: string): PortalTemplate | undefined {
  return PORTAL_TEMPLATES.find((t) => t.key === key);
}
