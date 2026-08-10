# task-w15-e — spec-audit @ 7c4101c

Full detail for the `## 2026-08-10 task-w15-e — spec-audit @ 7c4101c`
section of `docs/verification-log.md`. Re-runs the task-w13-e checklist
(`docs/verification-log/task-w13-e-spec-audit.md`) at the post-DEC-076-barrier
sha, in a fresh worktree of latest `main` (worktree HEAD `7c4101c`, same sha
`main` pointed at when the worktree was cut — `task-w15-a` merged first per
the chain-link prerequisite).

- SPEC §8 quickstart/README parity: `package.json:5-17` scripts (`dev`,
  `build`, `db:migrate`, `seed`, `test`) match `README.md:18-22` verbatim
  (`npm i` / `npm run db:migrate` / `npm run seed` / `npm run dev`). Zero
  secrets required — Stage-1 quickstart runs entirely against local
  Miniflare-backed D1/R2 per `README.md:14-16`. PASS.
- README "For evaluators" credentials (`README.md:57-62`) diffed against
  `docs/fixtures/sample-data.json` `identities.{organizer,speaker,speaker2,
  reviewer}` via a one-off `python3 -c` script reading the JSON directly:
  all four email+password pairs (`sbek-organizer@example.com` /
  `SbekTest!2027-org`, `sbek-speaker@example.com` / `SbekTest!2027-spk`,
  `sbek-speaker2@example.com` / `SbekTest!2027-spk2`,
  `sbek-reviewer@example.com` / `SbekTest!2027-rev`) match exactly, no
  drift since w13-e. PASS.
- CI (`.github/workflows/ci.yml`): `build-and-test` job runs `npm run build`
  (tsc x2 + vite build, line ~22) then `npm test` (vitest run); a separate
  `walkthrough` job (DEC-063) brings up `wrangler dev` against a migrated +
  seeded local D1 and runs `npm run walkthrough`. Both present and unchanged
  in shape since w13-e. PASS.
- SPEC §9 four named invariants, each with a passing regression test,
  unchanged from w13-e (re-verified files still present and green in this
  worktree's `npm test` run):
  - close-date lock: `test/edit-lock.test.ts` + `test/submit-core.test.ts`.
  - speaker isolation: `test/task-file-access.test.ts:117` (cross-account
    403/404, IDOR check via the real route handler).
  - hidden-speaker exclusion: `test/headshot-gate.test.ts:80` (404
    unauthenticated for a pending/hidden speaker) against
    `visibleSubmissionConditions()` (`src/server/repo/public.ts`).
  - decision-never-auto-emails: `test/spec9-invariants.test.ts` (added at
    w13-e) — drives `updateSubmissionStatuses` through a fake db recording
    every table touched, asserts `schema.emailLog` is never among them.
  All PASS, pre-existing (no new test needed for this section — the sha
  under audit already carries all four).
- NEW at this sha — wave-14 security-fix regression coverage, confirmed
  present on `main` and exercised by this worktree's `npm test` run:
  - DEC-074 (portal-edit track injection): `test/portal-edit-track-validation.test.ts`
    — POST `/submissions/:id/edit` now runs the same `validateTrackChoice`
    gate the public submit path uses, after deduping posted trackIds via
    `Set`, before writing `submission_track` rows.
  - DEC-071 (portal_link must be absolute): `test/portal-link-absolute.test.ts`
    — covers both `resolvePortalLink` call sites (`src/routes/comms.ts`
    compose preview/send, `src/routes/api/contacts.ts` bulk-email) and both
    branches (existing user -> `${origin}/portal`, no user -> freshly
    minted `${origin}/claim/:token`).
  - DEC-072 (rate-limit identity keys): `test/rate-limit-identity-keys.test.ts`
    — exercises `checkAndIncrementScopedLimit` with the two independent
    scopes `src/routes/auth.tsx`'s `POST /login` now runs per attempt:
    `login-user` keyed by trimmed/lowercased email, `login-ip` keyed by
    `requestIpFromHeaders(...)`, proving per-account and per-IP caps are
    independently enforced (closes the shared-IP-lockout and
    x-forwarded-for-rotation bypass holes).
  - DEC-073 (schedule-slot roomId event-scoping): located under
    `test/agenda-room-ownership.test.ts` (not `test/api-submissions.test.ts`
    as the task's file hint suggested — the correct home turned out to be a
    dedicated file; confirmed via grep across `test/` for `roomBelongsToEvent`
    and `roomId`). Covers both halves named in the task:
    - write-path rejection: `describe("PUT /submissions/:id/slot (DEC-073
      room-ownership gate)")` — a `roomId` foreign to the submission's own
      event 400s with `error.fields.roomId` set (via
      `roomBelongsToEvent` in `src/routes/agenda.ts:60`); a same-event
      `roomId` succeeds (200). A third `describe` block unit-tests
      `roomBelongsToEvent` itself, asserting its WHERE clause is scoped by
      both `id` and `event_id`.
    - event-scoped public room lookup: `describe("getPublicAgenda room-name
      resolution (DEC-073: never leak a cross-event room)")` — asserts the
      room-name query issued by `src/server/repo/public.ts:361` scopes its
      WHERE by `event_id` (not just room id), that a foreign-event
      `roomId` resolves `roomName: null` rather than leaking the other
      event's room name, and that a same-event `roomId` resolves normally.
  All four PASS.
- DEC-070 cross-org rejection: the task's file hint (`test/api-submissions.test.ts`)
  does not hold the DEC-070 endpoint tests — those endpoints
  (`POST /api/v1/submissions/:id/participants`, `PATCH
  /api/v1/submissions/:id/participants/:participantId`) and their
  cross-org checks live in `test/api-participants.test.ts` (confirmed via
  `grep -n "DEC-070" -r src decisions test`). Two tests there, one per
  endpoint, both named `"404s a genuinely different org's organizer on a
  real submission id (cross-org isolation)"` (lines 190 and 259), assert a
  real submission id belonging to a different org 404s rather than leaking
  existence or allowing the write. `test/api-submissions.test.ts:268`
  separately has a tripwire count referencing DEC-070's move to the sibling
  `repo/participants.ts` module, but the actual cross-org endpoint
  assertions are in `api-participants.test.ts`. PASS (coverage confirmed
  present, just filed under the correct sibling module rather than the
  hinted file).

No named SPEC §9 invariant or wave-14/DEC-070 fix lacked a regression test
at this sha, so no new test was added by this task — this is a
verification-only gate section, not code-bearing.

Full suite in this worktree: `npm run build` PASS (tsc x2 + vite build
clean, bundle sizes unchanged from prior gate runs); `npm test` PASS — 89
test files / 898 tests, 0 failures.

RESULT: PASS
