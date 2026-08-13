-- DEC-948: the rate limiter moves from a KV read-modify-write (racy under
-- concurrency -- N concurrent readers can all observe count=0) to an atomic
-- D1 counter. `key` is built by scopedRateLimitKey(scope, id, windowStart)
-- so live bucket identity is unchanged. See src/server/repo/rate-limit.ts.
CREATE TABLE `rate_limit` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_expires_at_idx` ON `rate_limit` (`expires_at`);
