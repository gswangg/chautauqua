-- DEC-746 (wave-77 amendment): task.audience — 'everyone' | 'targeted' —
-- so a task created for an explicit contactIds subset stays targeted
-- instead of being silently back-filled onto every newly-active contact
-- (DEC-932) at the next acceptance.
ALTER TABLE task ADD COLUMN audience TEXT NOT NULL DEFAULT 'everyone';
