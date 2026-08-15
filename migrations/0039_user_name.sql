-- DEC-757: a teammate carries a display NAME so PeopleRolesPanel can render
-- something other than an email address. Nullable, no default, no backfill.

ALTER TABLE `user` ADD COLUMN `name` TEXT;
