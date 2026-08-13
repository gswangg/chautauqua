// Review pipeline tables: evaluation plans, reviewer assignments,
// evaluations, and recusals. Split out of the former monolithic
// src/db/schema.ts (contention-hotspot decomposition; behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const evaluationPlan = sqliteTable(
  "evaluation_plan",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    instructions: text("instructions"),
    openDate: integer("open_date", { mode: "timestamp_ms" }),
    closeDate: integer("close_date", { mode: "timestamp_ms" }),
    // session filters, e.g. track ids
    filtersJson: text("filters_json"),
    anonymized: integer("anonymized", { mode: "boolean" }).notNull().default(false),
    // rating scale definition, e.g. { min, max, labels }
    scaleJson: text("scale_json").notNull(),
    // weighted criteria, e.g. [{ id, label, weight }]
    criteriaJson: text("criteria_json").notNull(),
    rounds: integer("rounds").notNull().default(1),
    // DEC-082: the round an organizer has advanced this plan to (1-based,
    // capped at `rounds` by advancePlanRound). migrations/0009_review_rounds.sql.
    currentRound: integer("current_round").notNull().default(1),
    // DEC-147: nullable map of round -> criteria array override, e.g.
    // {"2":[{id,label,kind,...}]}. Rounds absent from this map (including
    // round 1 by convention) fall back to criteriaJson -- resolved ONLY via
    // src/domain/evaluation.ts's criteriaForRound(). migrations/0010_round_criteria.sql.
    roundCriteriaJson: text("round_criteria_json"),
    maxEvaluations: integer("max_evaluations"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    evaluation_plan_event_id_idx: index("evaluation_plan_event_id_idx").on(t.eventId),
  }),
);

export const planReviewer = sqliteTable(
  "plan_reviewer",
  {
    id: id(),
    planId: text("plan_id").notNull(),
    userId: text("user_id").notNull(),
    // assignment scope: a track (reviewers review one or more tracks), null = all
    trackId: text("track_id"),
    // migrations/0004 (DEC-017): a single-submission assignment scope. Scope
    // semantics: trackId set = all plan submissions in that track;
    // submissionId set = that single submission; both null = all submissions
    // matching plan filters; a reviewer's assignment is the union of their rows.
    submissionId: text("submission_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    plan_reviewer_plan_id_idx: index("plan_reviewer_plan_id_idx").on(t.planId),
    plan_reviewer_user_id_idx: index("plan_reviewer_user_id_idx").on(t.userId),
    plan_reviewer_submission_id_idx: index("plan_reviewer_submission_id_idx").on(t.submissionId),
    plan_reviewer_track_id_idx: index("plan_reviewer_track_id_idx").on(t.trackId),
  }),
);

export const evaluation = sqliteTable(
  "evaluation",
  {
    id: id(),
    planId: text("plan_id").notNull(),
    submissionId: text("submission_id").notNull(),
    reviewerId: text("reviewer_id").notNull(),
    round: integer("round").notNull().default(1),
    // per-criterion numeric/dropdown scores, e.g. { criterionId: value }
    scoresJson: text("scores_json").notNull(),
    comment: text("comment"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    evaluation_plan_id_idx: index("evaluation_plan_id_idx").on(t.planId),
    evaluation_submission_id_idx: index("evaluation_submission_id_idx").on(t.submissionId),
    evaluation_reviewer_id_idx: index("evaluation_reviewer_id_idx").on(t.reviewerId),
    evaluation_plan_submission_reviewer_round_idx: uniqueIndex("evaluation_plan_submission_reviewer_round_idx").on(
      t.planId,
      t.submissionId,
      t.reviewerId,
      t.round,
    ),
  }),
);

// DEC-271 (task w5-c): reviewer conflict-of-interest / recusal. A reviewer
// may recuse themselves from a submission within a plan; recused submissions
// are excluded from that reviewer's queue and scoring is blocked (409).
export const reviewRecusal = sqliteTable(
  "review_recusal",
  {
    id: id(),
    planId: text("plan_id").notNull(),
    submissionId: text("submission_id").notNull(),
    userId: text("user_id").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => ({
    review_recusal_plan_id_idx: index("review_recusal_plan_id_idx").on(t.planId),
    review_recusal_submission_id_idx: index("review_recusal_submission_id_idx").on(t.submissionId),
    review_recusal_user_id_idx: index("review_recusal_user_id_idx").on(t.userId),
    review_recusal_plan_submission_user_idx: uniqueIndex("review_recusal_plan_submission_user_idx").on(
      t.planId,
      t.submissionId,
      t.userId,
    ),
  }),
);
