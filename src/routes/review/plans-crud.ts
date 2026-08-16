// Review API (J4) plan CRUD + round-advance endpoints. Extracted from the
// former monolithic src/routes/review/plans.ts (803 lines, a merge-conflict
// hotspot) — see shared.ts for the parsing/authz helpers this sub-app
// depends on. Route files export a named Hono sub-app; only plans.ts
// composes these sub-apps into `reviewPlansRoutes` (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError, readJsonBody, requireAtLeastOneField } from "../../server/http";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../domain/cap-copy";
import * as repo from "../../server/repo/review";
import { roundCriteriaJsonOf } from "../../server/repo/review";
import * as eventsRepo from "../../server/repo/events";
import { DEC_015, DEC_123, DEC_146, DEC_147, DEC_148, DEC_213, DEC_460, DEC_461, DEC_624, DEC_676, DEC_709 } from "../../decisions";
import { criteriaForRound, MAX_PLAN_ROUNDS } from "../../domain/evaluation";
import { countOf } from "../../domain/count-copy";
import { clampPage, listPerPage } from "../../lib/pagination";
import {
  currentAuth,
  parseScale,
  parseCriteria,
  parseRoundCriteria,
  parseRoundMeta,
  parseRounds,
  parseMaxEvaluations,
  parseEpochMs,
  checkEpochOrder,
  deepEqual,
  requireOwnedPlan,
} from "./shared";

export const reviewPlansCrudRoutes = new Hono<AppEnv>();

void DEC_123; // criteria/scale immutability guard on PATCH /api/v1/plans/:id below
void DEC_015; // append-only migrations: migrations/0010_round_criteria.sql
void DEC_146; // PlanEditor.tsx retains the null-safe SPA date guards this task must preserve
void DEC_147; // per-round scorecards: round_criteria_json + criteriaForRound resolution
void DEC_148; // free-text 'text' criterion kind
void DEC_213; // per-round criteria freeze on PATCH /api/v1/plans/:id below
void DEC_460; // enforced bound on every /api/v1 list envelope, no exemptions
void DEC_461; // optional repo page param + sibling count fn + deterministic ORDER BY below
void DEC_624; // PATCH /plans/:id: anonymity ratchet guard below
void DEC_676; // GET /plans/:id: evaluationCountsByRound surfaces DEC-213's freeze reason below
void DEC_709; // POST /plans/:id/waves: locked criteria carry forward into a new editable round below

reviewPlansCrudRoutes.get("/api/v1/events/:eventId/plans", requireOrganizer, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const [items, total] = await Promise.all([
    repo.listPlansForEvent(c.var.db, event.id, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countPlansForEvent(c.var.db, event.id),
  ]);
  return c.json({ items, total, page, perPage });
});

reviewPlansCrudRoutes.post("/api/v1/events/:eventId/plans", requireOrganizer, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const event = await eventsRepo.getEventForOrg(c.var.db, c.req.param("eventId"), auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const body = await readJsonBody(c);
  const errors: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim().length === 0) errors.name = "required";
  else if (body.name.length > MAX_NAME_LENGTH) errors.name = overCapFieldMessage(body.name.length, MAX_NAME_LENGTH); // DEC-417
  if (typeof body.instructions === "string" && body.instructions.length > MAX_LONG_TEXT_LENGTH) {
    errors.instructions = overCapFieldMessage(body.instructions.length, MAX_LONG_TEXT_LENGTH); // DEC-417
  }
  const scale = parseScale(body, errors);
  const criteria = parseCriteria(body, errors);
  const rounds = body.rounds !== undefined ? parseRounds(body, errors) : 1;
  const roundCriteria = parseRoundCriteria(body, errors, rounds);
  // DEC-147 amendment (wave 8, task w8-c): validated next to roundCriteria,
  // same rules (bounded key range, bounded name, ms-epoch-or-null dates).
  const roundMeta = parseRoundMeta(body, errors, rounds);
  // DEC-509: maxEvaluations/openDate/closeDate validated at the route --
  // a bad value must 400, never coerce to null and open the plan silently.
  const maxEvaluations = parseMaxEvaluations(body, errors);
  const openDate = parseEpochMs(body, "openDate", errors);
  const closeDate = parseEpochMs(body, "closeDate", errors);
  // DEC-517: on POST there is no stored record yet, so the effective values
  // ARE the body values.
  if (Object.keys(errors).length === 0) checkEpochOrder(openDate, closeDate, errors);
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Invalid plan", errors);

  const created = await repo.createPlan(c.var.db, event.id, {
    name: body.name as string,
    instructions: typeof body.instructions === "string" ? body.instructions : null,
    openDate: openDate ?? null,
    closeDate: closeDate ?? null,
    filters: (body.filters as { trackIds?: string[] } | undefined) ?? null,
    anonymized: body.anonymized === true,
    scale: scale!,
    criteria: criteria!,
    rounds: rounds!,
    roundCriteria: roundCriteria ?? null,
    roundMeta: roundMeta ?? null,
    maxEvaluations: maxEvaluations ?? null,
  });
  return c.json(created, 201);
});

reviewPlansCrudRoutes.get("/api/v1/plans/:id", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  // DEC-676: the plan editor names DEC-213's freeze reason/count per round
  // instead of re-deriving listRoundsWithEvaluations' rule client-side.
  const evaluationCountsByRound = await repo.countEvaluationsByRound(c.var.db, plan.id);
  return c.json({ ...plan, evaluationCountsByRound });
});

reviewPlansCrudRoutes.patch("/api/v1/plans/:id", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const body = await readJsonBody(c);
  // DEC-627 (amendment, wave 6): every field on this PATCH is optional; an
  // empty body must be refused rather than reaching updatePlan as a no-op.
  requireAtLeastOneField(body, [
    "name",
    "instructions",
    "scale",
    "criteria",
    "rounds",
    "roundCriteria",
    "roundMeta",
    "maxEvaluations",
    "openDate",
    "closeDate",
    "anonymized",
    "filters",
  ]);
  const errors: Record<string, string> = {};

  if (body.name !== undefined && typeof body.name === "string" && body.name.length > MAX_NAME_LENGTH) {
    errors.name = overCapFieldMessage(body.name.length, MAX_NAME_LENGTH); // DEC-417
  }
  if (body.instructions !== undefined && typeof body.instructions === "string" && body.instructions.length > MAX_LONG_TEXT_LENGTH) {
    errors.instructions = overCapFieldMessage(body.instructions.length, MAX_LONG_TEXT_LENGTH); // DEC-417
  }
  const scale = body.scale !== undefined ? parseScale(body, errors) : undefined;
  const criteria = body.criteria !== undefined ? parseCriteria(body, errors) : undefined;
  const rounds = body.rounds !== undefined ? parseRounds(body, errors, plan.currentRound) : undefined;
  const roundCriteria =
    body.roundCriteria !== undefined ? parseRoundCriteria(body, errors, rounds ?? plan.rounds) : undefined;
  // DEC-147 amendment (wave 8, task w8-c): round meta is NOT frozen by the
  // per-round criteria lock (DEC-213) -- a name/window is not a scoring
  // input, so it stays editable on a round with recorded evaluations. No
  // DEC-213-style freeze guard below for roundMeta.
  const roundMeta = body.roundMeta !== undefined ? parseRoundMeta(body, errors, rounds ?? plan.rounds) : undefined;
  // DEC-509: same validation as POST -- PATCH previously did `as number`
  // casts with no check at all, letting `maxEvaluations: 0` (or a date
  // string) through verbatim.
  const maxEvaluations = parseMaxEvaluations(body, errors);
  const openDate = parseEpochMs(body, "openDate", errors);
  const closeDate = parseEpochMs(body, "closeDate", errors);
  // DEC-517: order check against the MERGED post-patch state -- whichever
  // side the body omits falls back to the plan's already-stored value, so a
  // PATCH touching only closeDate is still checked against the stored
  // openDate.
  if (Object.keys(errors).length === 0) {
    const effectiveOpen = openDate !== undefined ? openDate : plan.openDate;
    const effectiveClose = closeDate !== undefined ? closeDate : plan.closeDate;
    checkEpochOrder(effectiveOpen, effectiveClose, errors);
  }
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Invalid plan", errors);

  // DEC-123: once any evaluation exists on this plan, criteria/scale are
  // immutable -- a shape change would orphan recorded evaluations into a
  // 500ing results surface. Identical (no-op) values still pass through so
  // full-object PATCHes from the admin SPA keep working.
  if ((body.criteria !== undefined || body.scale !== undefined) && (await repo.planHasEvaluations(c.var.db, plan.id))) {
    if (body.criteria !== undefined && !deepEqual(criteria, plan.criteria)) {
      throw new ApiError(
        "conflict",
        "Criteria and scale cannot change once evaluations exist — create a new plan or delete the evaluations first",
      );
    }
    if (body.scale !== undefined && !deepEqual(scale, plan.scale)) {
      throw new ApiError(
        "conflict",
        "Criteria and scale cannot change once evaluations exist — create a new plan or delete the evaluations first",
      );
    }
  }

  // DEC-213: independent of the whole-plan criteria/scale guard above, a
  // roundCriteria change must not alter the RESOLVED criteria of any round
  // that already has recorded evaluations -- only rounds without evaluations
  // stay freely editable. Compares criteriaForRound's resolution before vs.
  // after this patch, per affected round.
  if (body.roundCriteria !== undefined && (await repo.planHasEvaluations(c.var.db, plan.id))) {
    const evaluatedRounds = await repo.listRoundsWithEvaluations(c.var.db, plan.id);
    const beforeOverridesJson = roundCriteriaJsonOf(plan);
    const afterCriteria = criteria ?? plan.criteria;
    for (const r of evaluatedRounds) {
      const before = criteriaForRound(plan.criteria, beforeOverridesJson, r);
      const after = roundCriteria === null ? afterCriteria : (roundCriteria?.[String(r)] ?? afterCriteria);
      if (!deepEqual(before, after)) {
        throw new ApiError(
          "conflict",
          "Criteria and scale cannot change once evaluations exist — create a new plan or delete the evaluations first",
        );
      }
    }
  }

  // DEC-624/DEC-799: anonymity is a ratchet -- once at least one evaluation
  // has been SUBMITTED under an anonymized plan, it can never be switched
  // off. Turning anonymity ON is always allowed. Only evaluations submitted
  // at/after plan.anonymizedAt (when anonymity actually took effect) count --
  // evaluations submitted before anonymity was enabled never lock the plan.
  if (body.anonymized === false && plan.anonymized) {
    const submittedCount = await repo.countSubmittedEvaluationsForPlan(c.var.db, plan.id, plan.anonymizedAt ?? undefined);
    if (submittedCount > 0) {
      throw new ApiError(
        "conflict",
        `${countOf(submittedCount, "evaluation")} were submitted under anonymity; anonymity cannot be switched off for this plan.`,
      );
    }
  }

  const updated = await repo.updatePlan(c.var.db, plan.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    instructions: body.instructions !== undefined ? (body.instructions === null ? null : String(body.instructions)) : undefined,
    openDate,
    closeDate,
    filters: body.filters !== undefined ? (body.filters as { trackIds?: string[] } | null) : undefined,
    anonymized: typeof body.anonymized === "boolean" ? body.anonymized : undefined,
    scale,
    criteria,
    rounds,
    roundCriteria,
    roundMeta,
    maxEvaluations,
  });
  return c.json(updated);
});

// DEC-929: names what deletion destroys before the organizer confirms --
// read-only preview of deletePlan's exact tally, guarded by the same
// requireOwnedPlan check as the DELETE below.
reviewPlansCrudRoutes.get("/api/v1/plans/:id/delete-preview", requireOrganizer, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const counts = await repo.countPlanDeleteImpact(c.var.db, plan.id);
  return c.json({ planId: plan.id, name: plan.name, counts });
});

reviewPlansCrudRoutes.delete("/api/v1/plans/:id", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  await repo.deletePlan(c.var.db, plan.id);
  return c.body(null, 204);
});

// DEC-082: advances the plan to current_round + 1. Rejects (409) once
// current_round === rounds -- there is no round beyond the plan's own count.
reviewPlansCrudRoutes.post("/api/v1/plans/:id/advance-round", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const updated = await repo.advancePlanRound(c.var.db, plan.id);
  return c.json(updated);
});

// DEC-709: locked criteria are not a dead end -- a wave carries the current
// round's frozen criteria forward into a new, editable round rather than
// leaving the organizer staring at a read-only row with no way forward.
// rounds and currentRound both advance to the new round number; the newly
// opened round's roundCriteria entry starts as an editable copy of exactly
// what the current round resolved to (never plan.criteria verbatim -- a
// round already customized via roundCriteria must carry ITS OWN criteria
// forward, not silently revert to the base list). 400s (naming the reason)
// when the current round has no submitted evaluations: nothing is frozen
// yet, so the organizer should edit the current round in place instead.
reviewPlansCrudRoutes.post("/api/v1/plans/:id/waves", requireOrganizer, csrfJson, async (c) => {
  const plan = await requireOwnedPlan(c, c.req.param("id"));
  const submittedCount = await repo.countSubmittedEvaluationsForRound(c.var.db, plan.id, plan.currentRound);
  if (submittedCount === 0) {
    throw new ApiError(
      "invalid",
      `Round ${plan.currentRound} has no submitted evaluations yet -- nothing is frozen, so edit this plan's criteria in place instead of starting a new wave`,
    );
  }
  if (plan.rounds >= MAX_PLAN_ROUNDS) {
    throw new ApiError(
      "invalid",
      `This plan has reached the maximum number of waves (${MAX_PLAN_ROUNDS} rounds) -- start a new plan instead of adding another wave`,
    );
  }
  const frozenCriteria = criteriaForRound(plan.criteria, roundCriteriaJsonOf(plan), plan.currentRound);
  const newRound = plan.rounds + 1;
  const updated = await repo.startNewWave(c.var.db, plan.id, {
    newRound,
    roundCriteria: { ...(plan.roundCriteria ?? {}), [String(newRound)]: frozenCriteria },
  });
  return c.json(updated);
});
