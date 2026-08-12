-- DEC-603: Comms send history becomes batched with a per-recipient drill-in.
-- One id minted per fan-out call (compose / bulk-email / reminders /
-- reviewer-remind), shared by every recipient row of that send; NULL on
-- single sends, which render as their own one-row batch via
-- COALESCE(batch_id, id) -- see src/server/repo/email.ts.
ALTER TABLE `email_log` ADD `batch_id` text;

CREATE INDEX `email_log_event_id_batch_id_idx` ON `email_log` (`event_id`, `batch_id`);

-- DEC-267: batch_id must also lead some index on its own.
CREATE INDEX `email_log_batch_id_idx` ON `email_log` (`batch_id`);
