# J11/J12 (data) + scale (DEC-089) walkthrough — task w9-e

LOG-ONLY gate (SPEC section 9 "the real bar", DEC-062, DEC-389 reporting
discipline, DEC-412 repair policy). This lane owns
`scripts/walkthrough/data.ts` and `scripts/walkthrough/scale.ts` only.

- SHA measured (`git -C <repo> rev-parse main` at run time):
  `1f8aaf8c6ed0d16876bbbdb2336b5e1c6a7ca8ac`
- Run date: 2026-08-12
- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w9-e`
- Port: 8813 (per assignment; w9-c/w9-d use 8811/8812)

## Procedure and exit codes

| Step | Command | Exit code | Notes |
|---|---|---|---|
| 1 | `npm ci --prefer-offline --no-audit --no-fund --silent` | 0 | `node_modules` was absent, ran fresh |
| 2 | `npm run db:migrate` | 0 | 18 migrations, all ✅, no secret required |
| 3 | `npm run seed` | 0 | seeded D1 rows + 8 R2 objects, no secret required |
| 4 | `npx wrangler dev --port 8813` (first attempt) | n/a | booted directly via `npx wrangler dev`, which **skips the `predev` npm hook** (`tsx scripts/ensure-dev-vars.ts && vite build ...`) — no `.dev.vars` existed, so `DEV_MODE` was unset in the Worker env |
| 5 | `npx tsx scripts/walkthrough/scale.ts --url http://localhost:8813` (first attempt) | 1 | **FAILED at step5**: `GET /dev/mailbox` → 404 (see root cause below) |
| 6 | `npx tsx scripts/ensure-dev-vars.ts` | 0 | created `.dev.vars` from `.dev.vars.example` (`DEV_MODE=1`), then edited `PUBLIC_BASE_URL` to `http://localhost:8813` to match the assigned port (DEC-296) |
| 7 | `npx vite build --config app/vite.config.ts` | 0 | rebuild admin/app assets (part of `predev`, run manually since step 4 bypassed it) |
| 8 | `npx wrangler dev --port 8813` (second attempt) | n/a (long-running) | `GET /health` → 200, `GET /dev/mailbox` → 200. ZERO secrets present at any point. |
| 9 | `npx tsx scripts/walkthrough/data.ts --url http://localhost:8813` | 0 | all J11/J12 checks passed, no output changes needed |
| 10 | `npx tsx scripts/walkthrough/scale.ts --url http://localhost:8813` | 0 | all 6 steps passed, no output changes needed |
| 11 | `npx tsx scripts/walkthrough/data.ts --url http://localhost:8813` (re-run, confirm stability) | 0 | still passes |

No step in the final procedure demanded a secret at any point.

## Root cause of the first scale.ts failure (step5, `GET /dev/mailbox` → 404)

This was an **environment-setup mistake in this lane's own run, not a
product regression**. `npm run dev` normally runs `predev` first
(`tsx scripts/ensure-dev-vars.ts && vite build ...`), which creates
`.dev.vars` (`DEV_MODE=1`) from `.dev.vars.example` if absent. This lane's
first boot invoked `npx wrangler dev --port 8813` directly (bypassing
`predev` and `npm run dev`'s script wrapper) per the delegated boot
instructions ("then `npx wrangler dev --port 8813`"), which left
`DEV_MODE` unset. `src/server/app.ts`'s `guardDevMailbox` (DEC-005/DEC-183)
correctly 404s `/dev/mailbox*` whenever `DEV_MODE !== '1'` — this is the
guard working as designed, not a bug.

Fix (environment only, no product code touched): ran
`tsx scripts/ensure-dev-vars.ts` manually to create `.dev.vars`, edited
`PUBLIC_BASE_URL` to the assigned port per DEC-296's own instruction ("Change
this ... when running wrangler dev on another port"), ran the `vite build`
half of `predev` manually, and rebooted. `/dev/mailbox` then returned 200
and both walkthrough modules passed cleanly on a clean seed with zero
product-code or walkthrough-script changes.

## Per-area PASS/FAIL table (this lane's two modules only)

| Area | Result | Notes |
|---|---|---|
| data — J11 (CRM: contacts, segments, bulk email, dashboard) | PASS | all checks green, no assertion changes |
| data — J12 (own-your-data: bearer tokens, exports, API docs) | PASS | all checks green, no assertion changes |
| scale (DEC-089, step1-6: 110-row bulk accept/chunked loads/exactly-once/no-auto-email/purge-refresh) | PASS | all 6 steps green, no assertion changes |

## DEC-412 repair policy — assertions changed

**None.** Both `scripts/walkthrough/data.ts` and `scripts/walkthrough/scale.ts`
were left byte-for-byte unmodified. No assertion was re-pinned, softened, or
deleted.

## DEC-412 repair policy — product fixes

**None.** No product code in `src/` was modified. The scale walkthrough's
step2 (bulk accept, DEC-355/356/357/358 set-based bulk ops), step4
(exactly-once re-accept), step5 (no-auto-email invariant), and step6
(purge-refresh via DEC-399) all passed against the current `src/` on the
first correctly-booted run — no regression found in the >100-id volume
paths, chunked D1 loads, or purge-refresh path that DEC-396/w6-w7 changed.

## Summary

RESULT: PASS (both areas, this lane's scope)
OPEN ITEMS: 0

The one failure encountered (`scale.ts` step5, `GET /dev/mailbox` 404) was
traced to this lane's own boot sequence skipping the `predev` npm hook that
creates `.dev.vars`, not to a product defect — resolved by running
`ensure-dev-vars.ts` + `vite build` manually before the second boot. Future
lanes booting via bare `npx wrangler dev` (rather than `npm run dev`) should
run `npx tsx scripts/ensure-dev-vars.ts` first, or the `/dev/mailbox`-mount
guard (DEC-005/DEC-183, working as designed) will 404 every dev-mailbox
assertion in the producer, speaker, and scale walkthrough modules.
