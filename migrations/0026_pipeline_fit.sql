-- DEC-821: pipeline fit is two nullable columns on pipeline_entry, set when
-- someone is enrolled and editable after. fit_score is an integer 1-5 (or
-- NULL, meaning unrated -- rendered as a visible 'Unrated' state, never an
-- implied zero); rationale is a short free-text note. Fit ranks cards WITHIN
-- a stage column only -- it never moves a card between stages.

ALTER TABLE `pipeline_entry` ADD `fit_score` integer;
ALTER TABLE `pipeline_entry` ADD `rationale` text;
