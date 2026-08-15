-- DEC-592 amendment (wave 10, task w10-a): a form_field can carry a ROLE
-- tag ('session_format' | 'audience_level' | NULL) so the two well-known
-- CFP fields can be resolved by role instead of a global-PK literal id
-- (SESSION_FORMAT_FIELD_ID / AUDIENCE_LEVEL_FIELD_ID in src/forms/types.ts
-- -- both still stand this wave; w10-b owns converting read sites and
-- retiring the literals). Nullable, no default, no index, no backfill --
-- existing rows (including the seed's own field_session_format /
-- field_audience_level) get their role stamped explicitly by w10-b or the
-- seed script, never by a migration-time UPDATE.

ALTER TABLE `form_field` ADD COLUMN `role` TEXT;
