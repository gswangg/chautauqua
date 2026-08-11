# task-w15-c - build-test (confirmation lane 1/DEC-327/DEC-320(ii)) @ f0d56ce

FROZEN SHA: f0d56cefd3c2949591526cebfd403290cdab244a
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: b1edfdf4c511f2f272b9c0b3eedf5460cdad840f (main after task-w15-a merge; see POST-S DELTA — no recheck of any claim below required)

Code-frozen, log-only lane: no files outside this log were touched.

## Part A — build + test

### (1) Clean install — `npm ci --prefer-offline --no-audit --no-fund`

```
added 366 packages in 2s
```

### (2) `npm run build` — dual `tsc --noEmit` (root + app/) then vite build

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...
✓ 138 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                 0.41 kB │ gzip:  0.27 kB
[... 18 more chunk lines ...]
../public/admin/assets/index-gvD_CSBC.js                 180.20 kB │ gzip: 58.93 kB
✓ built in 607ms
```

Both `tsc --noEmit` invocations exited 0 with no diagnostics (the `&&` chain would have stopped otherwise) before vite ran. `strict: true` confirmed unchanged in both tsconfigs:

```
$ grep -n '"strict"' tsconfig.json app/tsconfig.json
tsconfig.json:6:    "strict": true,
app/tsconfig.json:8:    "strict": true,
```

### (3) `npm test`

```
 Test Files  226 passed (226)
      Tests  1885 passed (1885)
   Start at  15:40:25
   Duration  24.84s (transform 4.91s, setup 0ms, collect 74.91s, tests 30.55s, environment 11.80s, prepare 17.14s)
```

226 files / 1885 tests, all passed, 0 skipped, 0 failed, 0 verbatim failure output to record. Confirmed no disabled tests exist:

```
$ grep -rn '\.skip(\|it\.todo\|xit(\|describe\.skip' test app/src | wc -l
       0
```

Two stderr blocks appear in the run (from `test/tasks-remind-now-mailer-failure.test.ts` and `test/users-create-mailer-failure.test.ts`) — these are the tests' own intentionally-simulated mailer-failure log lines (DEC-238 best-effort mailer semantics under test), not test failures; both tests report ✓.

### (4) `npm audit --omit=dev` (DEC-308 requirement)

```
found 0 vulnerabilities
```

### (5) `npm audit` (dev included, for the record — DEC-302)

```
4 vulnerabilities (2 moderate, 2 high)
```

Advisories, traced with `npm ls <pkg>`:

- `form-data` 4.0.0-4.0.5 (high, CRLF injection via unescaped multipart field/filenames) — transitive of `jsdom@25.0.1` (devDependency).
- `lodash` <=4.17.23 (high, `_.template` code injection + `_.unset`/`_.omit` prototype pollution x2) — transitive of `@testing-library/jest-dom@6.6.3` (devDependency).
- `react-router` 6.0.0-7.17.0 / `react-router-dom` (moderate, open-redirect via backslash + SSR-hydration deserializeErrors constructor injection) — `react-router-dom` is itself listed directly under `"devDependencies"` in `package.json`.

`npm ls form-data lodash react-router react-router-dom` confirms all four resolve only under `jsdom`, `@testing-library/jest-dom`, or `react-router-dom` — all three roots live in `package.json`'s `"devDependencies"` block (confirmed: `dependencies` = `{drizzle-orm, hono}` only). `npm audit --omit=dev` above shows 0, corroborating dev-only status. Per DEC-302, dev-dependency-only advisories are recorded here (not waved off) but are NOT counted as open items. Count: 4 (0 counted as open items).

## Part B — static confirmation of the six wave-14 fixes (quoted file:line, at FROZEN SHA)

### DEC-317 (three portal/comms gates)

- Gate 1 (public/portal read, visible-invite): `src/domain/acceptance.ts:93` `export const PORTAL_VISIBLE_INVITE_STATUSES = ["none", "accepted", "invited"] as const;` — used in the SQL WHERE at `src/server/repo/portal.ts:133` (submissions list), `src/server/repo/portal.ts:253` (detail), `src/server/repo/portal.ts:657` (my-sessions/my-events).
- Gate 2 (portal write, active-only): `src/server/repo/portal-edit.ts:80` `inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),` (import at `src/server/repo/portal-edit.ts:20`).
- `src/server/repo/files-authz.ts:9` `import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";`, used at `src/server/repo/files-authz.ts:42` `inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),` — this is the pending-invitee FILE access gate ratified by DEC-325 as following the WRITE gate; recorded here as CONFORMANT, not an open item.
- Comms participant filter: `src/server/repo/comms.ts:175` `inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),` inside `loadComposeSubmissions` (declared `src/server/repo/comms.ts:135`).
- `noRecipientFields`: declared `src/routes/comms.ts:213`; wired into the preview preflight at `src/routes/comms.ts:329` (inside `POST /api/v1/events/:eventId/compose/preview`) and the send preflight at `src/routes/comms.ts:371` (inside `POST /api/v1/events/:eventId/compose/send`) — both run the check before any render/ics/mailer step.

### DEC-318 (public schedule_slot event-range bound)

`slotWithinEventRange` declared `src/server/repo/public.ts:84`, ANDed into all four public schedule_slot reads:
- `src/server/repo/public.ts:358` — inside `hydrateSessions` (fn starts `src/server/repo/public.ts:236`).
- `src/server/repo/public.ts:529` — inside `getScheduleInfoForSubmissions` (fn starts `src/server/repo/public.ts:510`).
- `src/server/repo/public.ts:756` — inside `getPublicAgenda` (fn starts `src/server/repo/public.ts:745`).
- `src/server/repo/public.ts:836` — inside `getPublicAgendaByIds` (fn starts `src/server/repo/public.ts:806`).

### DEC-319 (manual-reminder batch cap + dedupe)

- `src/domain/reminders.ts:11` `export const MAX_REMINDER_BATCH = 100;` and `src/domain/reminders.ts:12` `export const MANUAL_DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1h`.
- `planManualReminders` declared `src/domain/reminders.ts:93`; internally calls `capReminderGroups` at `src/domain/reminders.ts:121`.
- `capReminderGroups` declared `src/domain/reminders.ts:76`.
- `src/server/repo/tasks.ts:701` — `remindNow` (declared `src/server/repo/tasks.ts:683`) calls `planManualReminders`.
- `src/server/repo/tasks.ts:735` — `sendDueRemindersForEvent` (the cron pass, declared `src/server/repo/tasks.ts:714`) calls `capReminderGroups` directly after `planReminders` at `src/server/repo/tasks.ts:726`.
- Reporting: `app/src/pages/speakers/OnboardingGrid.tsx:97-107` reads `{ sent, skipped, remaining }` from the remind-now response and renders all three (skipped/remaining conditionally appended to the toast message).

### DEC-321 (optional locked job_title/company/bio)

- `src/forms/types.ts:45-52` `export const LOCKED_SPEAKER_FIELDS = ["first_name", "last_name", "email", "job_title", "company", "bio"] as const;` — six entries.
- `src/server/repo/forms.ts:101` `const OPTIONAL_LOCKED_SPEAKER_FIELDS = new Set<string>(["job_title", "company", "bio"]);`, used at `src/server/repo/forms.ts:149` `required: !OPTIONAL_LOCKED_SPEAKER_FIELDS.has(fieldId),` inside `createDefaultForm` (declared `src/server/repo/forms.ts:110`).
- Blank-only fill: `src/routes/public/submit.tsx:539` calls `fillContactProfileIfBlank(...)` (only overwrites null/empty stored columns); resolved participant snapshot written via `titleAtTime`/`orgAtTime` in the `createParticipant` call at `src/routes/public/submit.tsx:565-566`.

### DEC-322 (safe external URLs on public speaker detail)

- `src/domain/contacts.ts:36` `export function safeExternalUrl(raw: string | null | undefined): string | null {` — http:/https: allowlist, returns null otherwise.
- `src/server/repo/public.ts:644` `const safe = safeExternalUrl(parsedSocial[key]);` inside `getPublicSpeakerDetail` (declared `src/server/repo/public.ts:582`).
- `src/routes/public/detail.tsx:42` `<a href={link.url} rel="noopener noreferrer nofollow" target="_blank">` — rel/target attributes present on the first user-facing href sourced from `safeExternalUrl`'s output.

## Tripwire tests

```
$ npx vitest run test/docs-route-coverage.test.ts test/spa-contract-sweep.test.ts test/schema-fk-indexes.test.ts test/migration-parity.test.ts
 ✓ test/migration-parity.test.ts (1 test) 6ms
 ✓ test/schema-fk-indexes.test.ts (1 test) 2ms
 ✓ test/spa-contract-sweep.test.ts (8 tests) 1107ms
 ✓ test/docs-route-coverage.test.ts (2 tests) 2ms

 Test Files  4 passed (4)
      Tests  12 passed (12)
```

All four tripwires pass (also included in the full 226-file/1885-test run above).

## POST-S DELTA

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline f0d56cefd3c2949591526cebfd403290cdab244a..refs/heads/main -- src app migrations scripts test
8c90b60 Fix schedule.ics empty-agenda bug and public onError cache leak (DEC-323, DEC-324)

$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua diff --stat f0d56cefd3c2949591526cebfd403290cdab244a..refs/heads/main -- src app migrations scripts test
 src/routes/public/index.tsx      | 40 ++++++++++++++++++++++------------------
 test/itinerary-roundtrip.test.ts | 23 +++++++++++++++++++++++
 test/public-404-no-store.test.ts | 33 +++++++++++++++++++++++++++++++++
 3 files changed, 78 insertions(+), 18 deletions(-)
```

`main` moved from FROZEN SHA to `b1edfdf` (merge of `task-w15-a`) during this lane's execution. The entire delta is task-w15-a's schedule.ics/onError work (DEC-323/DEC-324), touching only `src/routes/public/index.tsx` and adding two new test files — none of the six wave-14 anchor files quoted in Part B above (`src/domain/acceptance.ts`, `src/server/repo/portal.ts`, `src/server/repo/portal-edit.ts`, `src/server/repo/files-authz.ts`, `src/server/repo/comms.ts`, `src/routes/comms.ts`, `src/server/repo/public.ts`'s schedule-slot functions, `src/domain/reminders.ts`, `src/server/repo/tasks.ts`, `app/src/pages/speakers/OnboardingGrid.tsx`, `src/forms/types.ts`, `src/server/repo/forms.ts`, `src/routes/public/submit.tsx`, `src/domain/contacts.ts`, `src/routes/public/detail.tsx`) are touched by this delta.

Per DEC-280 a non-empty delta is never a STOP. Per DEC-327 a delta consisting only of task-w15-a/b (schedule.ics and scripts/) does not invalidate this lane's wave-14 findings — this delta is exactly task-w15-a (schedule.ics), matching that carve-out precisely. No claim in Part A or Part B above depends on `src/routes/public/index.tsx`, so no recheck of any claim above is required. RECHECK SHA = b1edfdf4c511f2f272b9c0b3eedf5460cdad840f (main's HEAD at delta-check time, recorded for traceability; not a re-verification target).

Stage-2 items (deploy, real Resend, Airtable, DNS, CDN measurement) are never open items — none apply to this lane.
