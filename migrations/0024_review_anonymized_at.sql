-- DEC-799: the anonymity ratchet (DEC-624) must only count evaluations
-- submitted AFTER anonymity was actually enabled -- a plan that was briefly
-- non-anonymous, collected evaluations, and only later turned anonymity on
-- must not have those earlier evaluations lock anonymity permanently on.
-- anonymized_at records when the plan's `anonymized` flag last transitioned
-- false -> true (or was set true at creation); it is cleared to NULL when
-- anonymity is legitimately switched off (no submitted evaluations since).

ALTER TABLE `evaluation_plan` ADD `anonymized_at` integer;
