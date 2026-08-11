# task-w4-d — render-sweep @ c211d4c

Scope: DEC-250 exit-battery verification-only task. DEC-144/DEC-139 browser
render-sweep gate re-run against the frozen sha S = c211d4c02bb49c9d01f0730b9d8788c156d3a459.

## STEP 0 — freeze check

- `git log -1` on the repo's `main` at task start: `93a16b6c` ("scribe wave 4"),
  one commit ahead of S.
- `git diff --stat c211d4c 93a16b6c` shows only:
  `decisions/DEC-250.md`, `decisions/DEC-251.md`, `field-guide/index.md`,
  `src/decisions.ts` — all allow-listed drift per DEC-250. No product-code
  drift. Freeze check PASSED; proceeded.

## STEP 1 — fresh build at S

Worktree `task-w4-d` created at S (c211d4c02bb49c9d01f0730b9d8788c156d3a459).

- `rm -rf .wrangler`
- `npm ci --prefer-offline --no-audit --no-fund` — 423 packages, clean.
- `npm run build` — `tsc --noEmit` (root + app/tsconfig.json) + `vite build`
  all green, no errors.
- `npm run db:migrate` — all 14 migrations (0000-0014, plus 0011 skip per
  numbering gap) applied `✅`.
- `npm run seed` — seed.ts + .seed.sql + seed-r2.ts completed, 8 R2 objects
  uploaded.
- `npx tsx scripts/ensure-dev-vars.ts` — created `.dev.vars` from
  `.dev.vars.example`.
- Manually started `npx wrangler dev --port 8973` in the background and
  confirmed `GET /` returned **200** (health check satisfied per task step 1).

## STEP 2 — gate:render-sweep

Read `scripts/render-sweep.ts` first. Its actual convention: the script does
**not** accept a `--url`/host argument. It is fully self-contained — it picks
its own free ephemeral port via `findFreePort()`, re-runs migrations + seed
itself against `.wrangler` local state, spawns its own `wrangler dev` on that
port, logs in each persona via the real `/login` form using
`docs/fixtures/sample-data.json` credentials, then walks every entry in
`app/src/routeManifest.ts` (34 entries at S — not 31; see note below) via
Playwright chromium, asserting response status 200, non-empty rendered text,
and zero collected console `error`/`pageerror` events (DEC-144, no allowlist).

Because the script re-applies migrations+seed against whatever `.wrangler`
local D1 state already exists, running it against the DB I had already
manually seeded in Step 1 for the health check caused a
`UNIQUE constraint failed: pipeline_entry.org_id, pipeline_entry.contact_id`
error on the second seed pass (expected — seed.ts is not idempotent against
an already-seeded DB, decisions/DEC-015 append-only). Ran `rm -rf .wrangler
.seed.sql .seed-assets`, then `npx playwright install chromium` (no-op,
already installed), then let `npm run gate:render-sweep` perform its own
full migrate+seed+boot cycle end-to-end as designed (the script does not
accept an external URL to attach to, so the task instruction's "with the url
http://localhost:8973" could not be applied literally — the script always
manages its own isolated server/port; this is the narrowest reasonable
interpretation of the instruction given the script's actual design).

### Route count

`grep -c 'path:' app/src/routeManifest.ts` = **35** manifest lines, but the
`organizer` wildcard entry `/admin/*` and per-role duplicate `/account/password`
paths (organizer/reviewer/speaker) mean the sweep visits **34 (path, role)
pairs** — the run output header line reads `34/34 routes passed`. (Prior
wave logs cited "31+ at last accepted run"; the manifest has grown since —
34 is the exact count at S.)

### Result

```
34/34 routes passed
gate:render-sweep OK
```

All 34 (path, role) combinations — organizer (15), reviewer (3), speaker
(6), public (6), plus 3x `/account/password` (organizer/reviewer/speaker)
and 1x `/admin/*` wildcard — returned PASS: status 200, non-empty rendered
`#root`/`body` text, and zero console-error/pageerror events. No failing
route to report; no error text to capture verbatim.

## OPEN ITEMS: 0

RESULT: PASS — render-sweep gate green, 34/34 routes pass with zero
blank-screen/console-error failures at frozen sha c211d4c02bb49c9d01f0730b9d8788c156d3a459;
no product drift found in STEP 0 freeze check.
