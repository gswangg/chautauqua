// CRM tables: saved segments, the sourcing pipeline, and duplicate-contact
// dismissals. Split out of the former monolithic src/db/schema.ts
// (contention-hotspot decomposition; behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

// migrations/0005_w4_segment.sql (DEC-025, task w4-c): CRM saved-segment
// rules (DEC-026), rules_json holds SegmentRule[] from src/domain/contacts.ts.
export const segment = sqliteTable(
  "segment",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    rulesJson: text("rules_json").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    segment_org_id_idx: index("segment_org_id_idx").on(t.orgId),
  }),
);

// migrations/0012_pipeline.sql (DEC-157, task w3-a): CRM sourcing pipeline
// (CRM-07/08). pipeline_entry is one row per contact enrolled into an org's
// pipeline (fixed stage enum 'identified' | 'contacted' | 'interested' |
// 'confirmed' | 'declined', unique per org+contact); pipeline_activity is an
// append-only 'move'|'note' feed that doubles as both stage history and the
// notes composer's backing store.
export const pipelineEntry = sqliteTable(
  "pipeline_entry",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    contactId: text("contact_id").notNull(),
    stage: text("stage").notNull().default("identified"),
    // DEC-821: fit score (integer 1-5) and rationale -- both nullable, set at
    // enroll time or edited after, ranking cards WITHIN a stage column only.
    fitScore: integer("fit_score"),
    rationale: text("rationale"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    pipeline_entry_org_id_contact_id_idx: uniqueIndex("pipeline_entry_org_id_contact_id_idx").on(t.orgId, t.contactId),
    pipeline_entry_org_id_idx: index("pipeline_entry_org_id_idx").on(t.orgId),
    pipeline_entry_contact_id_idx: index("pipeline_entry_contact_id_idx").on(t.contactId),
  }),
);

export const pipelineActivity = sqliteTable(
  "pipeline_activity",
  {
    id: id(),
    entryId: text("entry_id").notNull(),
    // 'move' | 'note'
    kind: text("kind").notNull(),
    body: text("body"),
    fromStage: text("from_stage"),
    toStage: text("to_stage"),
    authorUserId: text("author_user_id").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    pipeline_activity_entry_id_idx: index("pipeline_activity_entry_id_idx").on(t.entryId),
    pipeline_activity_author_user_id_idx: index("pipeline_activity_author_user_id_idx").on(t.authorUserId),
  }),
);

// DEC-770: persisted "Not a duplicate" / "Keep both" dismissals for the CRM
// duplicates list (w1-g). contactIdA/contactIdB are always stored in
// ascending id order by the repo layer (dismissDuplicatePair), so the
// unique index below is the single idempotency contract -- a repeat dismiss
// of the same pair is a no-op, not a second row.
export const contactDuplicateDismissal = sqliteTable(
  "contact_duplicate_dismissal",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    contactIdA: text("contact_id_a").notNull(),
    contactIdB: text("contact_id_b").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    contact_duplicate_dismissal_org_id_idx: index("contact_duplicate_dismissal_org_id_idx").on(t.orgId),
    contact_duplicate_dismissal_org_id_contact_id_a_contact_id_b_idx: uniqueIndex(
      "contact_duplicate_dismissal_org_id_contact_id_a_contact_id_b_idx",
    ).on(t.orgId, t.contactIdA, t.contactIdB),
  }),
);
