-- DEC-866: the portal co-presenter row must show the name the speaker
-- typed, never the CRM identity matched from the supplied email. `participant`
-- gains a nullable name_at_time column, joining DEC-258's existing
-- titleAtTime/orgAtTime snapshot family — written ONLY by the
-- speaker-portal addCoPresenter path, read ONLY by getPortalParticipants,
-- NULL for every other participant writer (which falls back to the live
-- contact name).

ALTER TABLE `participant` ADD `name_at_time` text;
