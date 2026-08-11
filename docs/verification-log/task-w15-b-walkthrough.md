# task-w15-b — walkthrough @ 1033d45 (detail)

Gate: J1-J12 walkthrough, DEC-196 lane b, port 8951.

## S'''' derivation (DEC-114/DEC-196)

- `git log --first-parent --oneline 1033d45..main` -> `4e5256e` (scribe
  wave 15) only.
- `git diff --name-only 4e5256e^ 4e5256e` -> `decisions/DEC-196.md`,
  `field-guide/index.md`, `src/decisions.ts`.
- `git diff 4e5256e^ 4e5256e -- src/decisions.ts` -> adds
  `export const DEC_196 = "..."` and fixes an escaped-newline typo
  inside the existing `DEC_131` string literal (`\\n` -> `\n` as a
  string constant character, not executable logic change). Pure
  bookkeeping per the DEC-114 exclusion pattern used at prior gates
  (cf. `4bc394c` in the S''' gate history).
- `1033d45` is therefore the newest code-bearing first-parent commit:
  S'''' = `1033d45` ("merge task-w14-c"), matching DEC-196's expected
  value.
- `git merge-base --is-ancestor 2dd2f33 1033d45` -> exit 0.
- `git merge-base --is-ancestor 7f7477e 1033d45` -> exit 0.

## DEC-196 precondition greps at 1033d45

- `git show 1033d45:src/routes/api/users.ts | grep -n "DEC-191\|contactId: null"`
  -> line 86 (`DEC-191` comment), line 88 (`contactId: null,`).
- `git show 1033d45:src/routes/review.ts | grep -n "DEC-191\|contactId: null"`
  -> line 462 (`DEC-191` comment), line 470 (`contactId: null,`).
- `git show 1033d45:src/views/form-render.tsx | grep -n "data-required"`
  -> 4 hits (lines 33, 43, 55, 85) — all four required-capable
  controls.
- `git show 1033d45:app/src/pages/submissions/SubmissionsTable.tsx | grep -n "chunkSelection\|/tracks"`
  -> `import { chunkSelection } from './bulk';`,
  `apiList<Track>(\`/events/${eventId}/tracks\`)`, and
  `chunkSelection(ids)` call site.
- `git ls-tree -r 1033d45 --name-only` includes
  `test/email-log-null-contact.test.ts`,
  `test/form-render-rules.test.ts`,
  `app/src/pages/submissions/bulk.ts`,
  `app/src/pages/submissions/bulk.test.ts`, `.dev.vars.example`; does
  NOT include `.dev.vars`.

All preconditions present, no miss.

## Run

- Fresh detached worktree: `git worktree add --detach
  <sibling-dir>/task-w15-b-run 1033d45`.
- Confirmed no `.dev.vars` in the fresh worktree pre-run (not read or
  printed).
- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean, no
  errors.
- `npm run build` — `tsc --noEmit` (root) + `tsc --noEmit -p
  app/tsconfig.json` + `vite build` all green; 132 modules, bundle
  ~180 kB / 58.9 kB gzip for the main admin chunk.
- `npm run db:migrate` — 14/14 migrations applied (local D1).
- `npm run seed` — D1 rows seeded plus 8 R2 objects (1 CFP resource
  file + 4 headshots) put into the local `chautauqua-files` bucket.
- Booted `npx wrangler dev --port 8951` directly (per task
  instruction, not via `npm run dev`) — because this bypasses npm's
  automatic `predev` lifecycle hook, `npm run predev` (i.e.
  `tsx scripts/ensure-dev-vars.ts`) was run explicitly first to
  materialize `.dev.vars` from the tracked `.dev.vars.example`
  (DEC-187); its contents were never read or printed, only copied by
  the script. Wrangler reported `Ready on http://localhost:8951`.
- `npm run walkthrough -- --url http://localhost:8951`:

```
PASS producer
PASS review
PASS speaker
PASS public
PASS data
PASS scale

walkthrough OK
```

All J1-J12 checks green, including:

- DEC-175 authz probes: reviewer 403 on admin plan settings/results,
  second-org organizer 404/403 (DEC-039), out-of-scope
  submission/evaluation existence-hiding 404s (not 403), speaker2 vs
  speaker1 cross-account 403/404 probes across portal, task-assignment
  forms, file downloads, and organizer API surfaces.
- DEC-187 `/dev/mailbox` assertions: J2 mailbox GET 200 (fixed the
  first run's failure — see below), bulk-remind/onboarding-remind
  mailbox visibility confirmed in speaker and review modules.
- Extra probe (per task instruction): producer J3 exercises
  `GET /api/v1/events/:id/tracks` then the submissions track filter —
  same data source `SubmissionsTable.tsx` (w14-a) now consumes
  client-side; both calls 200 with non-empty results. DEC-194
  `data-required` dataset contract confirmed present on all four
  required-capable controls via the precondition grep above
  (server-rendered markup, not re-verified via headless DOM here).

Server stopped after the run (`pkill -f "wrangler dev --port 8951"`).

## Note: first attempt failed on a harness step, not a product defect

The first walkthrough attempt (before running `npm run predev`
explicitly) failed at J2 with `GET /dev/mailbox` -> 404, because
`npx wrangler dev` was invoked directly and no `.dev.vars` file
existed yet in the fresh detached worktree (the `predev` npm
lifecycle hook only fires for `npm run dev`, not a bare
`wrangler dev` invocation). Running `npm run predev` once
materialized `.dev.vars` from `.dev.vars.example` and the re-run
passed cleanly. Not a product defect — recorded here as a gotcha for
future lanes that boot `wrangler dev` directly at a specific port.

## OPEN ITEMS: 0

## RESULT: PASS
