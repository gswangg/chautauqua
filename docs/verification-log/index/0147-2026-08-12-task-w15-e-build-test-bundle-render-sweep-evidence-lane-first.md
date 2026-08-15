## 2026-08-12 task-w15-e — build/test/bundle/render-sweep evidence lane, first BLOCKING mobile + type-floor wave (DEC-443)

Evidence lane, log-only except the single named `CONTRAST_BLOCKING` flip governed by DEC-436/443.
Tree: `main` @ `01815c51fa7abb5c93289b5efe69cfb8bc2866a8` ("scribe wave 15"), worktree
`task-w15-e`. Full transcript, per-gate verdicts, and the CONTRAST_BLOCKING flip check are in
`docs/verification-log/task-w15-e-build-test-stage1.md`.

`npm run build` PASS (0 tsc errors, vite build 670ms). `npm test --silent` PASS — 274 files, 2285
tests, 0 failures. `npm run bundle:check` PASS — entry bundle 62.06 kB gzip / 300 kB budget.

`npm run db:migrate && npm run seed` then `npm run gate:render-sweep` (against the migrated+seeded
local state; `gate:render-sweep` also self-seeds internally, so this lane learned the hard way that
running `seed` twice against the same local D1 file throws a `UNIQUE constraint failed:
pipeline_entry.org_id, pipeline_entry.contact_id` — reset `.wrangler/state/v3/{d1,r2}` and let the
gate's own internal migrate+seed run once cleanly; see the linked log for the full note). Gate
exited 0. Per-gate verdicts, this being the first wave in which ADMIN_MOBILE_PASS and FONT_FLOOR
are BLOCKING:

- Desktop route sweep (BLOCKING): 42/42 PASS.
- Mobile 390px overflow + tap-target sweep (BLOCKING): 21/21 PASS, zero overflow, every control
  ≥44px.
- ADMIN_MOBILE_PASS (now BLOCKING): 20/20 PASS.
- FONT_FLOOR, 10px minimum (now BLOCKING): 83/83 PASS.
- WCAG AA contrast (advisory): 41/42 PASS — one offender, `/admin/submissions/forms` organizer,
  `td` text ratio 3.06 vs required 4.5 (`--chq-disabled` fg `rgb(142,138,122)` on row bg
  `rgb(244,241,232)`), same offender already logged in
  `task-w13-a-render-sweep-stage1.md`, not new.

CONTRAST_BLOCKING flip check (DEC-443): `scripts/render-sweep-contrast.ts:25` reads `false`; this
lane's own run read 41/42, not all-PASS, so **no flip was made** — it stays `false`. No source file
changed by this task.

OPEN ITEMS: 0 new (the one contrast offender is a pre-existing, already-logged advisory finding,
carried forward unowned per DEC-430, not gate-failing).

RESULT: PASS — build, tests, bundle:check, and all four now-BLOCKING render-sweep gates (desktop
sweep, mobile overflow/tap-target, ADMIN_MOBILE_PASS, FONT_FLOOR) all green on this branch's own
run; the advisory WCAG AA contrast pass reads 41/42 with one previously-known, non-blocking
offender named above; `CONTRAST_BLOCKING` correctly stays `false`.

