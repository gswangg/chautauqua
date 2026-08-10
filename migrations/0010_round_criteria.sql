-- DEC-147: per-round scorecards. Adds evaluation_plan.round_criteria_json, a
-- nullable JSON map of round -> criteria array override (e.g.
-- {"2":[{id,label,kind,...}]}). Rounds absent from this map (including round
-- 1 by convention) fall back to criteria_json; resolved ONLY via
-- src/domain/evaluation.ts's criteriaForRound(). Append-only per DEC-015,
-- following the 0009_review_rounds convention: no fresh meta/NNNN_snapshot.json.
ALTER TABLE `evaluation_plan` ADD `round_criteria_json` text;
