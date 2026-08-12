# task-w11-d — SPEC §9 persona walkthrough, all six modules (DEC-423, DEC-412)

SHA measured: `a3dbba69137120da98862b2af1091546f67c94c3` (`git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w11-d
rev-parse HEAD`, `main` tip at worktree creation for this lane).

Scope per the assigned task: run all six SPEC §9 persona-walkthrough
modules (`scripts/walkthrough/{producer,review,speaker,public,data,
scale}.ts`) standalone against current `main`, in sequence against one
booted server, and report PASS/FAIL per module with product-defect vs.
harness-drift disposition for any failure. LOG-ONLY — no gate is
flipped, no product code touched.

## Setup

- Fresh worktree of `main` at the SHA above; `npm ci --prefer-offline
  --no-audit --no-fund --silent` (node_modules already present, no-op);
  `npm run build` — clean (`tsc --noEmit` x2 + `vite build` succeed, no
  errors).
- `rm -rf .wrangler/state && npx tsx scripts/ensure-dev-vars.ts` (created
  `.dev.vars` from `.dev.vars.example`) — required per the trap recorded
  in `docs/verification-log/task-w9-d-walkthrough-speaker-public.md:23-33`
  and `task-w9-e-walkthrough-data-scale.md:31-50`: a bare `npx wrangler
  dev --port N` skips the `predev` hook, so `.dev.vars` never gets
  created, `DEV_MODE` stays unset, and every `/dev/mailbox` assertion
  404s. Running `ensure-dev-vars.ts` directly avoids needing `npm run
  dev`'s default (unpinned) port.
- `npm run db:migrate` — 18/18 migrations apply clean (D1 local).
- `npm run seed` — completes clean, including R2 seed uploads (8
  objects into local `chautauqua-files` bucket).
- Booted with `npx wrangler dev --port 8811 --var
  PUBLIC_BASE_URL:http://localhost:8811` (backgrounded). Verified before
  running any module:
  - `GET /dev/mailbox` -> `200` (confirms `DEV_MODE=1` took effect and
    the trap above did not recur)
  - `GET /` -> `200`

All six modules below ran against this one booted server, in the
sequence listed, from a single fresh migrate+seed (matching the
producer -> review -> speaker -> public -> data -> scale ordering
`scripts/walkthrough.ts`'s orchestrator uses, since several modules'
fixtures depend on state earlier modules mutate — e.g. review depends
on submissions producer accepted).

## RESULT — per module

| # | Module    | Command                                                              | Exit | Result |
|---|-----------|-----------------------------------------------------------------------|------|--------|
| 1 | producer  | `npx tsx scripts/walkthrough/producer.ts --url http://localhost:8811` | 0    | PASS   |
| 2 | review    | `npx tsx scripts/walkthrough/review.ts --url http://localhost:8811`   | 0    | PASS   |
| 3 | speaker   | `npx tsx scripts/walkthrough/speaker.ts --url http://localhost:8811`  | 0    | PASS   |
| 4 | public    | `npx tsx scripts/walkthrough/public.ts --url http://localhost:8811`   | 0    | PASS   |
| 5 | data      | `npx tsx scripts/walkthrough/data.ts --url http://localhost:8811`     | 0    | PASS   |
| 6 | scale     | `npx tsx scripts/walkthrough/scale.ts --url http://localhost:8811`    | 0    | PASS   |

All six modules exit 0 with real assertion output (not silent no-ops).
Representative tail lines confirming substantive checks ran, per
module:

- **producer**: `Running DEC-175 authz probes (unauthenticated
  requests)... ok` / `producer walkthrough OK (J1, J2, J3, J5)`
- **review**: `ok: remind writes an email_log row for the laggard, none
  for the completed reviewer` / `ok: results are sorted by weighted
  aggregate score descending` / `ok: results CSV downloads with a row
  per result (plus header)` / `review walkthrough: OK (all checks
  passed)`
- **speaker**: three DEC-175 organizer-API authz probes (`GET
  /api/v1/events/:id/submissions -> 403`, `GET /api/v1/contacts ->
  403`, `GET /api/v1/events/:id/email-log -> 403`) all `ok` /
  `walkthrough/speaker.ts: all checks passed`
- **public**: `ok J10 visibility gate: accepted-but-content-unapproved
  session is absent from every surface` / `ok J10 visibility gate
  (DEC-274): hidden participant's name vanishes everywhere but the
  session stays public with speakers:[]` / `ok J10 DEC-108
  invite-visibility gate: accepted invitee shown, pending and declined
  invitees absent` / `walkthrough/public.ts OK — all J9/J10 checks
  passed`
- **data**: `J12: showflow.csv fixed columns` / `J12: export of another
  org's event 404s` / `J12: GET /docs/api returns 200` /
  `walkthrough:data OK — J11/J12 checks passed`
- **scale**: `PASS step5 (dev mailbox message count unchanged by bulk
  accept)` / `PASS step6 (purge-refresh probe: title change reflected
  immediately on /e/<slug>/sessions)` / `scale walkthrough OK`

## Failures

None. No assertion re-pinning was necessary this run (no DEC-412 repair
required — all six modules ran green against `main` @
`a3dbba69137120da98862b2af1091546f67c94c3` unmodified). No product
defect found, no harness/copy drift found.

## OPEN ITEMS: 0

## RESULT: PASS
