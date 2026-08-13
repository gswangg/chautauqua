-- DEC-904: a saved view is private until its author shares it. saved_view
-- gains created_by_user_id (nullable -- older/system-created rows have no
-- known author) and shared (NOT NULL, default 1). The default makes every
-- EXISTING row shared, which is exactly today's behaviour -- the migration
-- changes no user's world. New rows write the real author (from
-- requireAuth, never the request body) and the checkbox's value, which is
-- UNCHECKED (shared = 0) by default in the UI.

ALTER TABLE `saved_view` ADD `created_by_user_id` text;
ALTER TABLE `saved_view` ADD `shared` integer NOT NULL DEFAULT 1;
