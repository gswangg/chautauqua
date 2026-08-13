-- DEC-770: persisted duplicate dismissals ("Not a duplicate" / "Keep both").
-- contact_id_a/contact_id_b are always stored in ascending id order by the
-- repo layer -- the unique index below is the idempotency contract.

CREATE TABLE `contact_duplicate_dismissal` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`contact_id_a` text NOT NULL,
	`contact_id_b` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX `contact_duplicate_dismissal_org_id_idx` ON `contact_duplicate_dismissal` (`org_id`);
CREATE UNIQUE INDEX `contact_duplicate_dismissal_org_id_contact_id_a_contact_id_b_idx` ON `contact_duplicate_dismissal` (`org_id`, `contact_id_a`, `contact_id_b`);
