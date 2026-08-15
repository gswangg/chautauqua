-- DEC-592/DEC-755: a form_field can carry a ROLE tag ('session_format' |
-- 'audience_level' | NULL) so the two well-known CFP fields can be resolved
-- by role (src/server/repo/form-roles.ts) instead of a global-PK literal
-- id -- the retired literals have since been deleted from src/forms/types.ts
-- and role is the ONE matcher everywhere. Nullable, no default, no index,
-- no backfill -- existing rows (including the seed's own field_session_format
-- / field_audience_level) get their role stamped explicitly by the seed
-- script or createDefaultForm, never by a migration-time UPDATE.

ALTER TABLE `form_field` ADD COLUMN `role` TEXT;
