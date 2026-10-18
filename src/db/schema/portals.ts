// Multi-portal tables (migrations/0046_multi_portal.sql): portals and their
// items, materialised memberships, queued "you have new items" emails,
// event-level roles, sponsor companies and sessions, and the audit log.

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const portal = sqliteTable(
  "portal",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    note: text("note"),
    // src/domain/portals/rules.ts PortalRule
    ruleJson: text("rule_json").notNull(),
    // src/domain/portals/permissions.ts FieldPermissions
    fieldPermissionsJson: text("field_permissions_json").notNull().default("{}"),
    // src/domain/portals/permissions.ts Capabilities
    capabilitiesJson: text("capabilities_json").notNull().default("{}"),
    notifyOnJoin: integer("notify_on_join", { mode: "boolean" }).notNull().default(true),
    // the starter template it came from, or null
    template: text("template"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    portal_event_id_idx: index("portal_event_id_idx").on(t.eventId),
  }),
);

export const portalItem = sqliteTable(
  "portal_item",
  {
    id: id(),
    portalId: text("portal_id").notNull(),
    // exactly one of taskId / resourceId / systemKind is set
    taskId: text("task_id"),
    resourceId: text("resource_id"),
    // a built-in item with no library row: src/domain/portals/items.ts
    // SYSTEM_ITEM_KINDS
    systemKind: text("system_kind"),
    displayName: text("display_name"),
    // 'none' | 'fixed' | 'relative'
    deadlineKind: text("deadline_kind").notNull().default("none"),
    // fixed deadline, a UTC-midnight day label (src/domain/task-due.ts)
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    // relative deadline, days after the participation became active
    relativeDays: integer("relative_days"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    graceDays: integer("grace_days").notNull().default(0),
    allowEditAfterSubmit: integer("allow_edit_after_submit", { mode: "boolean" }).notNull().default(false),
    viewOnlyWhenDone: integer("view_only_when_done", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    portal_item_portal_id_idx: index("portal_item_portal_id_idx").on(t.portalId),
    portal_item_task_id_idx: index("portal_item_task_id_idx").on(t.taskId),
    portal_item_resource_id_idx: index("portal_item_resource_id_idx").on(t.resourceId),
  }),
);

export const portalMembership = sqliteTable(
  "portal_membership",
  {
    id: id(),
    portalId: text("portal_id").notNull(),
    eventId: text("event_id").notNull(),
    // src/domain/portals/participations.ts participationKey
    participationKey: text("participation_key").notNull(),
    contactId: text("contact_id").notNull(),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
    // null while the participation is an unanswered invitation
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    portal_membership_portal_id_participation_key_idx: uniqueIndex(
      "portal_membership_portal_id_participation_key_idx",
    ).on(t.portalId, t.participationKey),
    portal_membership_event_id_idx: index("portal_membership_event_id_idx").on(t.eventId),
    portal_membership_contact_id_idx: index("portal_membership_contact_id_idx").on(t.contactId),
  }),
);

export const portalNotification = sqliteTable(
  "portal_notification",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    contactId: text("contact_id").notNull(),
    // string[] of task ids the person gained
    taskIdsJson: text("task_ids_json").notNull(),
    createdAt: createdAt(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    portal_notification_contact_id_idx: index("portal_notification_contact_id_idx").on(t.contactId),
    portal_notification_event_id_sent_at_idx: index("portal_notification_event_id_sent_at_idx").on(
      t.eventId,
      t.sentAt,
    ),
  }),
);

export const eventRole = sqliteTable(
  "event_role",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    contactId: text("contact_id").notNull(),
    role: text("role").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    event_role_event_id_contact_id_role_idx: uniqueIndex("event_role_event_id_contact_id_role_idx").on(
      t.eventId,
      t.contactId,
      t.role,
    ),
    event_role_contact_id_idx: index("event_role_contact_id_idx").on(t.contactId),
  }),
);

export const sponsorCompany = sqliteTable(
  "sponsor_company",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsor_company_org_id_idx: index("sponsor_company_org_id_idx").on(t.orgId),
  }),
);

export const sponsorTier = sqliteTable(
  "sponsor_tier",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsor_tier_event_id_idx: index("sponsor_tier_event_id_idx").on(t.eventId),
  }),
);

export const sponsorship = sqliteTable(
  "sponsorship",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    companyId: text("company_id").notNull(),
    tierId: text("tier_id"),
    // 'pending' | 'active'
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsorship_event_id_company_id_idx: uniqueIndex("sponsorship_event_id_company_id_idx").on(
      t.eventId,
      t.companyId,
    ),
    sponsorship_tier_id_idx: index("sponsorship_tier_id_idx").on(t.tierId),
    sponsorship_company_id_idx: index("sponsorship_company_id_idx").on(t.companyId),
  }),
);

export const sponsorEntitlement = sqliteTable(
  "sponsor_entitlement",
  {
    id: id(),
    // a tier row is in every sponsor of that tier; a sponsorship row is a
    // per-sponsor extra. Exactly one is set.
    tierId: text("tier_id"),
    sponsorshipId: text("sponsorship_id"),
    count: integer("count").notNull().default(1),
    // a session_format option label from the event's CFP form
    format: text("format").notNull(),
    minutes: integer("minutes"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsor_entitlement_tier_id_idx: index("sponsor_entitlement_tier_id_idx").on(t.tierId),
    sponsor_entitlement_sponsorship_id_idx: index("sponsor_entitlement_sponsorship_id_idx").on(t.sponsorshipId),
  }),
);

export const sponsorContact = sqliteTable(
  "sponsor_contact",
  {
    id: id(),
    sponsorshipId: text("sponsorship_id").notNull(),
    eventId: text("event_id").notNull(),
    contactId: text("contact_id").notNull(),
    // 'invited' | 'joined'
    status: text("status").notNull().default("joined"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    invitedByContactId: text("invited_by_contact_id"),
    invitedAt: integer("invited_at", { mode: "timestamp_ms" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsor_contact_sponsorship_id_contact_id_idx: uniqueIndex("sponsor_contact_sponsorship_id_contact_id_idx").on(
      t.sponsorshipId,
      t.contactId,
    ),
    sponsor_contact_contact_id_idx: index("sponsor_contact_contact_id_idx").on(t.contactId),
    sponsor_contact_event_id_idx: index("sponsor_contact_event_id_idx").on(t.eventId),
    sponsor_contact_invited_by_contact_id_idx: index("sponsor_contact_invited_by_contact_id_idx").on(t.invitedByContactId),
  }),
);

export const sponsorSession = sqliteTable(
  "sponsor_session",
  {
    id: id(),
    sponsorshipId: text("sponsorship_id").notNull(),
    eventId: text("event_id").notNull(),
    entitlementId: text("entitlement_id").notNull(),
    title: text("title").notNull().default(""),
    abstract: text("abstract"),
    // src/domain/sponsors.ts SPONSOR_SESSION_STATUSES
    status: text("status").notNull().default("draft"),
    lastNote: text("last_note"),
    lastNoteAt: integer("last_note_at", { mode: "timestamp_ms" }),
    lastNoteBy: text("last_note_by"),
    declineReason: text("decline_reason"),
    // the accepted submission an approval created
    submissionId: text("submission_id"),
    createdByContactId: text("created_by_contact_id"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    submitCount: integer("submit_count").notNull().default(0),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsor_session_sponsorship_id_idx: index("sponsor_session_sponsorship_id_idx").on(t.sponsorshipId),
    sponsor_session_event_id_status_idx: index("sponsor_session_event_id_status_idx").on(t.eventId, t.status),
    sponsor_session_entitlement_id_idx: index("sponsor_session_entitlement_id_idx").on(t.entitlementId),
    sponsor_session_submission_id_idx: index("sponsor_session_submission_id_idx").on(t.submissionId),
    sponsor_session_created_by_contact_id_idx: index("sponsor_session_created_by_contact_id_idx").on(t.createdByContactId),
  }),
);

export const sponsorSessionSpeaker = sqliteTable(
  "sponsor_session_speaker",
  {
    id: id(),
    sponsorSessionId: text("sponsor_session_id").notNull(),
    contactId: text("contact_id").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    sponsor_session_speaker_session_id_contact_id_idx: uniqueIndex(
      "sponsor_session_speaker_session_id_contact_id_idx",
    ).on(t.sponsorSessionId, t.contactId),
    sponsor_session_speaker_contact_id_idx: index("sponsor_session_speaker_contact_id_idx").on(t.contactId),
  }),
);

// Append-only: nothing updates or deletes a row.
export const auditEvent = sqliteTable(
  "audit_event",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    eventId: text("event_id"),
    actorUserId: text("actor_user_id"),
    actorContactId: text("actor_contact_id"),
    actorLabel: text("actor_label").notNull(),
    // src/domain/audit.ts AUDIT_ACTIONS
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    // the person whose data the action touched or exposed
    subjectContactId: text("subject_contact_id"),
    detailsJson: text("details_json"),
    createdAt: createdAt(),
  },
  (t) => ({
    audit_event_event_id_created_at_idx: index("audit_event_event_id_created_at_idx").on(t.eventId, t.createdAt),
    audit_event_target_id_target_type_idx: index("audit_event_target_id_target_type_idx").on(
      t.targetId,
      t.targetType,
    ),
    audit_event_org_id_created_at_idx: index("audit_event_org_id_created_at_idx").on(t.orgId, t.createdAt),
    audit_event_actor_user_id_idx: index("audit_event_actor_user_id_idx").on(t.actorUserId),
    audit_event_actor_contact_id_idx: index("audit_event_actor_contact_id_idx").on(t.actorContactId),
    audit_event_subject_contact_id_idx: index("audit_event_subject_contact_id_idx").on(t.subjectContactId),
  }),
);
