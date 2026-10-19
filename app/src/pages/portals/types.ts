// Multi-portal organizer screens: the JSON shapes the organizer API returns
// (src/routes/api/portals.ts, src/routes/api/sponsors.ts), mirrored for the
// SPA. The vocabularies themselves (rule fields and ops, field levels,
// capabilities, item kinds, file types, sponsor statuses) are imported from
// the pure domain modules, never re-typed here.
import type { PortalRule } from '../../../../src/domain/portals/rules';
import type { Capabilities, FieldLevel, FieldPermissions } from '../../../../src/domain/portals/permissions';
import type { DeadlineKind, ItemScope, ItemState, LibraryType, SystemItemKind } from '../../../../src/domain/portals/items';
import type { FileTypeGroup } from '../../../../src/domain/portals/file-types';
import type { Slot, SlotSession, SponsorSessionStatus } from '../../../../src/domain/sponsors';
import type { SponsorshipStatus } from '../../../../src/domain/portals/participations';

export type { PortalRule, Capabilities, FieldLevel, FieldPermissions, DeadlineKind, ItemScope, ItemState, SystemItemKind, FileTypeGroup };

// ---------------------------------------------------------------------------
// Portals overview (GET /events/:id/portals)
// ---------------------------------------------------------------------------

export interface PortalSummary {
  id: string;
  name: string;
  template: string | null;
  who: string;
  participations: number;
  items: number;
  matchesNobody: boolean;
  createdAt: number;
}

export interface PortalOverview {
  portals: PortalSummary[];
  covered: number;
  total: number;
  notInAny: number;
  overlap: number;
  templates: { key: string; name: string; blurb: string }[];
}

// GET /events/:id/portals/unmatched
export interface UnmatchedRow {
  key: string;
  contactId: string;
  name: string;
  participation: string;
  reason: string;
}

// GET /events/:id/portals/copy-sources
export interface CopySource {
  id: string;
  name: string;
  portals: number;
  tiers: number;
}

export interface CopyResult {
  portals: number;
  tiers: number;
  tasks: number;
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Portal editor (GET /events/:id/portals/:portalId)
// ---------------------------------------------------------------------------

export interface PortalItemRecord {
  id: string;
  portalId: string;
  taskId: string | null;
  resourceId: string | null;
  systemKind: SystemItemKind | null;
  displayName: string | null;
  deadlineKind: DeadlineKind;
  dueDate: number | null;
  relativeDays: number | null;
  required: boolean;
  graceDays: number;
  allowEditAfterSubmit: boolean;
  viewOnlyWhenDone: boolean;
  position: number;
}

export interface PortalRecord {
  id: string;
  eventId: string;
  name: string;
  note: string | null;
  rule: PortalRule;
  fieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  notifyOnJoin: boolean;
  template: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
  items: PortalItemRecord[];
}

export interface EditorItem extends PortalItemRecord {
  title: string;
  kind: string;
  scope: string;
  libraryHint: string;
}

export interface RuleFieldOption {
  field: string;
  label: string;
  values: { value: string; label: string }[];
}

export interface MatchRow {
  key: string;
  contactId: string;
  name: string;
  participation: string;
}

export interface MatchResult {
  count: number;
  rows: MatchRow[];
  saved: number;
}

export interface PortalEditorData {
  portal: PortalRecord;
  items: EditorItem[];
  matches: MatchResult;
  ruleText: string;
  ruleOptions: RuleFieldOption[];
  fieldLevels: readonly string[];
  capabilities: readonly string[];
}

// The body PUT /portals/:portalId and POST .../preview take.
export interface PortalItemInput {
  taskId: string | null;
  resourceId: string | null;
  systemKind: SystemItemKind | null;
  displayName: string | null;
  deadlineKind: DeadlineKind;
  dueDate: number | null;
  relativeDays: number | null;
  required: boolean;
  graceDays: number;
  allowEditAfterSubmit: boolean;
  viewOnlyWhenDone: boolean;
}

export interface PortalInput {
  name: string;
  note: string | null;
  rule: PortalRule;
  fieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  notifyOnJoin: boolean;
  items: PortalItemInput[];
}

// POST .../preview
export interface ImpactItemLine {
  title: string;
  people: number;
  filed?: number;
  keptThrough?: { portal: string; people: number }[];
}

export interface PortalImpact {
  affected: number;
  gain: { count: number; who: string; items: ImpactItemLine[] };
  lose: { count: number; who: string; items: ImpactItemLine[] };
  newItems: { people: number; contactIds: string[] };
  permissionChanges: string[];
  people: { contactId: string; name: string; participation: string; change: 'gain' | 'lose' | 'new_items' }[];
  needsPreview: boolean;
}

// PUT /portals/:portalId
export interface PortalSaveResult {
  ok: true;
  joined: number;
  left: number;
  emailed: number;
}

// ---------------------------------------------------------------------------
// Library (GET /events/:id/library)
// ---------------------------------------------------------------------------

export type { LibraryType };

export interface LibraryEntry {
  ref: { taskId: string } | { resourceId: string } | { systemKind: string };
  type: LibraryType | 'built_in';
  title: string;
  scope: ItemScope;
  instructions: string | null;
  formId: string | null;
  acceptedTypes: FileTypeGroup[] | null;
  maxSizeMb: number | null;
  maxFiles: number | null;
  usedBy: { id: string; name: string }[];
  direct: boolean;
  hint: string;
  // resources only: shown to everyone with a portal, or only through
  // portals that list it
  visibility?: 'everyone' | 'portal';
  // resources only (decision 74): a page participants read or a file they
  // download
  resource?: { kind: 'wiki' | 'file'; content: string | null; fileName: string | null };
}

// GET /events/:id/library
export interface LibraryListing {
  entries: LibraryEntry[];
  counts: Record<'task' | 'form' | 'file_request' | 'share_kit' | 'resource', number>;
}

export interface LibraryItemCreate {
  type: LibraryType;
  title: string;
  scope: ItemScope;
  instructions: string | null;
  acceptedTypes: FileTypeGroup[] | null;
  maxSizeMb: number | null;
  maxFiles: number | null;
  content: string | null;
}

// ---------------------------------------------------------------------------
// Person record (GET /events/:id/people/:contactId/portal)
// ---------------------------------------------------------------------------

export interface ResolvedField {
  level: FieldLevel;
  help: string | null;
  lockedBy: { portalName: string; participationPhrase: string } | null;
}

export interface ParticipationJson {
  key: string;
  kind: 'session' | 'company' | 'event_role';
  role: string;
  participationStatus: string;
  session: {
    submissionId: string;
    participantId: string;
    title: string;
    ref: string;
    status: string;
    origin: string;
    format: string | null;
    trackIds: string[];
  } | null;
  company: {
    sponsorContactId: string;
    sponsorshipId: string;
    companyName: string;
    tierName: string | null;
    sponsorshipStatus: SponsorshipStatus;
    isPrimary: boolean;
  } | null;
}

export interface ViewItemJson {
  key: string;
  kind: string;
  title: string;
  taskId: string | null;
  assignmentId: string | null;
  state: ItemState;
  required: boolean;
  dueDay: number | null;
  graceDays: number;
  completedAt: number | null;
  portals: { id: string; name: string }[];
  direct: boolean;
  merge: { deadlineFrom: string | null; requiredFrom: string | null } | null;
  detached: boolean;
  statusLine: string | null;
  statusWord: string | null;
  openUntil: number | null;
}

export interface ViewSectionJson {
  participation: ParticipationJson;
  heading: string;
  phrase: string;
  items: ViewItemJson[];
}

export interface ViewParticipationJson {
  participation: ParticipationJson;
  label: string;
  portals: { id: string; name: string }[];
  active: boolean;
  declined: boolean;
  unmatchedReason: string | null;
}

export interface PersonViewJson {
  eventId: string;
  eventName: string;
  timezone: string;
  contactId: string;
  participations: ViewParticipationJson[];
  profileItems: ViewItemJson[];
  sections: ViewSectionJson[];
  profileFields: Record<string, ResolvedField>;
}

export interface EventRoleRow {
  id: string;
  contactId: string;
  role: string;
  roleLabel: string;
  name: string;
  email: string;
}

export interface PersonRecord {
  contact: { id: string; firstName: string; lastName: string; email: string; company: string | null; title: string | null };
  view: PersonViewJson;
  eventRoles: EventRoleRow[];
}

// ---------------------------------------------------------------------------
// Sponsorships (GET /events/:id/sponsorships)
// ---------------------------------------------------------------------------

export interface Entitlement {
  id: string;
  count: number;
  format: string;
  minutes: number | null;
  extra: boolean;
}

export interface TierRow {
  id: string;
  name: string;
  position: number;
  entitlements: (Entitlement & { position: number })[];
  summary: string;
  sponsors: number;
}

export interface SponsorshipRow {
  id: string;
  companyName: string;
  tierId: string | null;
  tierName: string | null;
  status: SponsorshipStatus;
  statusLine: string;
  contacts: number;
  waiting: number;
  extras: Entitlement[];
}

export interface SponsorshipsOverview {
  tiers: TierRow[];
  sponsors: SponsorshipRow[];
  waiting: number;
  // the CFP's session formats (Settings · Call for papers)
  formats: string[];
}

export interface EntitlementInput {
  id?: string;
  count: number;
  format: string;
  minutes: number | null;
}

export interface OverAllowance {
  sponsorshipId: string;
  companyName: string;
  sessions: { id: string; title: string; status: string }[];
}

export interface SponsorContactRow {
  id: string;
  contactId: string;
  name: string;
  email: string;
  status: 'invited' | 'joined';
  isPrimary: boolean;
  invitedAt: number | null;
  joinedAt: number | null;
}

// GET /events/:id/sponsorships/:sponsorshipId
export interface SponsorshipDetail {
  sponsorship: { id: string; companyName: string; tierId: string | null; status: SponsorshipStatus };
  contacts: SponsorContactRow[];
  entitlements: Entitlement[];
  slots: Slot[];
  // sessions holding no slot (the tier was lowered after they were made)
  over: SlotSession[];
}

// ---------------------------------------------------------------------------
// Sponsor sessions (GET /events/:id/sponsor-sessions[/:sessionId])
// ---------------------------------------------------------------------------

export interface SponsorSessionSpeaker {
  id: string;
  contactId: string;
  name: string;
  email: string;
  isNew: boolean;
}

export interface SponsorSessionDetail {
  id: string;
  sponsorshipId: string;
  eventId: string;
  companyName: string;
  tierName: string | null;
  entitlementId: string;
  slotLabel: string;
  format: string;
  minutes: number | null;
  title: string;
  abstract: string | null;
  status: SponsorSessionStatus;
  lastNote: string | null;
  lastNoteAt: number | null;
  lastNoteBy: string | null;
  declineReason: string | null;
  submissionId: string | null;
  submittedAt: number | null;
  submitCount: number;
  decidedAt: number | null;
  createdAt: number;
  speakers: SponsorSessionSpeaker[];
  slots: Slot[];
}

export interface SponsorSessionQueue {
  waiting: SponsorSessionDetail[];
  withSponsor: SponsorSessionDetail[];
  decided: SponsorSessionDetail[];
}

export interface AuditEventRow {
  id: string;
  action: string;
  actorLabel: string;
  createdAt: number;
  details: Record<string, string | number | boolean | null>;
}

export interface SponsorSessionReview {
  session: SponsorSessionDetail;
  history: AuditEventRow[];
}

export interface MailResult {
  sent: number;
  failed: number;
}

export interface SponsorDecisionResult {
  session: SponsorSessionDetail;
  told: string[];
  submissionId?: string;
  invited?: string[];
  // request-changes and decline: one send; approve: the sponsor notice and
  // the new speakers' welcome
  mail: MailResult | { told: MailResult; invited: MailResult };
}

export type { Slot, SlotSession, SponsorSessionStatus, SponsorshipStatus };
