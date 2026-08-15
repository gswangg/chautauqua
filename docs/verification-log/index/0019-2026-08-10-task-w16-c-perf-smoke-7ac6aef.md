## 2026-08-10 task-w16-c — perf-smoke @ 7ac6aef

Full detail: docs/verification-log/task-w16-c-perf-smoke-2.md

Gate re-run (DEC-077 log-only lane): `npm ci`, `npm run build` (tsc x2 +
vite build), `npm run db:migrate` (9 migrations), `npm run seed` (required
first — `perf:seed` seeds only synthetic 2k-row data, not a login-capable
user; the smoke script logs in as the fixture organizer), `npm run
perf:seed` (2k-row scale), `wrangler dev --port 8803` (8803 reserved for
this lane, never 8787/8801), `PERF_URL=http://localhost:8803 npm run
perf:smoke`. Full detail: docs/verification-log/task-w16-c-perf-smoke.md

RESULT: PASS

