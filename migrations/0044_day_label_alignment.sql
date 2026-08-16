-- Gate-9 BROKEN fix: DEC-522's write doors (db805e72, exit phase) refuse any
-- day-label value that is not a UTC-midnight epoch multiple, but only NEW
-- writes were guarded — rows seeded before the wave-52 dayLabel() floor
-- still hold sub-day instants, so every edit of a pre-existing evaluation
-- plan 400s on dates the editor never touched (measured live: all four
-- seeded plans, open_date % 86400000 = 1418411). Floor every day-label
-- column in place; flooring an aligned value is a no-op, so this is
-- idempotent and safe on healthy databases.
UPDATE evaluation_plan SET open_date  = open_date  - (open_date  % 86400000) WHERE open_date  IS NOT NULL AND (open_date  % 86400000) != 0;
UPDATE evaluation_plan SET close_date = close_date - (close_date % 86400000) WHERE close_date IS NOT NULL AND (close_date % 86400000) != 0;
UPDATE form SET open_date  = open_date  - (open_date  % 86400000) WHERE open_date  IS NOT NULL AND (open_date  % 86400000) != 0;
UPDATE form SET close_date = close_date - (close_date % 86400000) WHERE close_date IS NOT NULL AND (close_date % 86400000) != 0;
UPDATE task SET due_date = due_date - (due_date % 86400000) WHERE due_date IS NOT NULL AND (due_date % 86400000) != 0;
