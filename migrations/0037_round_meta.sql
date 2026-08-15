-- DEC-147 amendment (wave 8, task w8-c): a round is a NAMED WINDOW, not a
-- bare integer -- ABS-01 (docs/eval-rubric/02-abstract-management.yaml)
-- asks each round for its own name, open/close dates, and its own
-- scorecard; round_criteria_json (migrations/0010_round_criteria.sql)
-- covers the scorecard, this covers the rest. Nullable map of
-- round -> {name?, opensAt?, closesAt?}, e.g. {"2":{"name":"Final round",
-- "opensAt":...,"closesAt":...}}. Rounds absent from this map (including
-- round 1 by convention) fall back to `Round ${round}` and the plan's own
-- open_date/close_date -- resolved ONLY via src/domain/evaluation.ts's
-- roundMetaFor(). Mirrors round_criteria_json's shape exactly.

ALTER TABLE `evaluation_plan` ADD COLUMN `round_meta_json` TEXT;
