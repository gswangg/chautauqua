# task-w11-e — spec-audit @ 7561cc1 (full detail)

## STEP 1 — sha derivation, ancestor check, preconditions

First-parent walk from `main` (worktree HEAD `bdc472b` "scribe wave 11")
lands on `7561cc1` ("merge task-w10-d") as the newest code-bearing
first-parent commit — matches DEC-185's expected S' exactly (literal
`git log --oneline -1 7561cc1` confirms the message). `git merge-base
--is-ancestor 2dd2f33 7561cc1` exits 0 (descends from the campaign-3
reset; DEC-129 homonym guard satisfied).

All 17 preconditions re-verified present at `7561cc1` via `git show
7561cc1:<path> | grep`:

12 DEC-177 anchors (six w6 anchors + DEC-173/174/175 closure anchors):
- `DEC-167` in `src/domain/contacts.ts` (line 165)
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts` (line 15)
- `"unknown track id"` in `src/routes/api/forms.ts` (line 113, as
  `` `unknown track id: ${unknown}` ``)
- `"anonymized === false"` in `src/server/repo/files.ts` (line 153)
- `openDate` in `app/src/pages/review/PlanEditor.tsx` (line 107)
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts` (line 19)
- `DEC-174` in `scripts/seed.ts` (line 975)
- `DEC-173` in `scripts/walkthrough/public.ts` (line 440) and
  `scripts/walkthrough/speaker.ts` (line 923)
- `DEC-175` in `scripts/walkthrough/producer.ts` (line 773),
  `scripts/walkthrough/speaker.ts` (line 1156), and
  `scripts/walkthrough/review.ts` (line 312)

5 DEC-185 markers:
- `DEC-179` in `src/lib/csv.ts` (line 145)
- `DEC-180` in `src/lib/rate-limit.ts` (line 41)
- `DEC-181` in `src/server/middleware.ts` (line 262)
- `DEC-182` in `src/server/http.ts` (line 51)
- `DEC-183` in `wrangler.jsonc` (line 39); `.dev.vars` present at S'
  containing `DEV_MODE=1`

17/17 hit. No precondition FAIL.

## STEP 2 — audit `git diff 38860f9..7561cc1`

`git diff --stat 38860f9..7561cc1`: 44 files changed, 2717
insertions(+), 78 deletions(-). Composition matches the expected
delta exactly: five wave-10 fixes + their tests, `.dev.vars` addition
(and its `.gitignore` un-ignore), and doc-only ledger/decision/field-
guide appends (`docs/verification-log.md` and eight per-task detail
files under `docs/verification-log/`, `decisions/DEC-179.md` through
`DEC-185.md`, `field-guide/index.md`, `src/decisions.ts`). No other
product code touched.

**DEC-179 (`src/lib/csv.ts`)** — `formatCell` now prepends `'` to any
string cell whose first character is `= + - @` or a leading tab/CR,
applied before the existing quote-when-needed logic. This only
affects `toCsv` (export serialization); the fixture `speakers.csv`
used by the eval-rubric's bulk-import scenarios (`03-speaker-
management.yaml`, `07-speaker-crm.yaml`) is consumed by `parseCsv`
(import), which is untouched — no corruption of import values.
`test/csv.test.ts` adds a dedicated `DEC-179 formula injection
neutralization` block (8 cases) plus keeps every existing RFC-4180
golden/round-trip test green. Spec-conformant.

**DEC-180 (`src/lib/rate-limit.ts`, `src/routes/auth.tsx`)** — adds
`peekScopedLimit`/`incrementScopedLimit`/`resetScopedLimit` as new,
additive primitives; `checkAndIncrementScopedLimit` (the function
`src/routes/public/submit.tsx` uses for the public-submit scope) is
byte-for-byte unchanged. `/login` now peeks both `login-user` (20/
15min) and `login-ip` (100/15min) scopes before verifying the
password, increments both only on a verified failure, and resets only
`login-user` on success. This is exactly DEC-072's two-scope design
(per-email anti-brute-force + per-IP flood guard) with the semantics
unchanged — only the counting trigger (every attempt -> failures
only) and the on-success reset are new. Claim-token routes are
untouched (DEC-072 says they stay unguarded; confirmed no diff there).
Spec-conformant.

**DEC-181 (`src/server/middleware.ts`, `src/routes/auth.tsx`,
`src/routes/portal/*.tsx`)** — new `csrfFormOrHeader` middleware
accepts either `x-chq-csrf: 1` (the admin SPA's fetch-based sign-out,
confirmed present in `app/src/App.tsx:69`) or the existing plain-form
double-submit cookie pair, and is mounted on `POST /logout`. Every
`PortalLayout` call site across `src/routes/portal/{index,edit,
profile,tasks}.tsx` now threads a `csrfToken` prop through to the
sign-out form's new hidden `chq_csrf` field (`grep -L csrfToken` over
every file calling `PortalLayout` returns empty — none missing it).
Two portal GET handlers (`/portal/submissions/:id`,
`/portal/tasks/resources`) gained `ensureCsrfCookie` calls to supply
the token. Spec-conformant.

**DEC-182 (`src/server/http.ts` + four call sites)** — new
`parseBoundedIdArray(value, field, opts?)` throws `ApiError("invalid",
message, { [field]: ... })` on non-array/empty/oversized/non-string/
empty-or->64-char-string input, matching the pre-existing
`{error:{code,message,fields?}}` envelope shape (`errorEnvelope`
unchanged). Applied to `contactIds` in `src/routes/api/contacts.ts`
and `src/routes/tasks.ts` (assign), `ids` in `src/routes/api/
submissions.ts` (status), `fileIds` in `src/routes/files.ts`
(archive), and the optional `taskIds` in `src/routes/tasks.ts`
(remind) with an explicit `undefined`-passthrough for the "remind all"
case. Spec-conformant.

**DEC-183 (`wrangler.jsonc`, `.dev.vars`, `.gitignore`)** —
`wrangler.jsonc`'s `vars` block (which set `DEV_MODE: "1"`) is deleted
and replaced with a `// DEC-183` comment; a new committed `.dev.vars`
file sets `DEV_MODE=1` (wrangler dev auto-loads it); `.gitignore`'s
`.dev.vars` line is removed so the file stays tracked. `src/routes/
dev/mailbox.tsx`'s `shouldMountDevMailbox` (`env.DEV_MODE === "1"`)
and `src/server/app.ts`'s DEC-005 mount guard are unchanged — the
mailbox route remains gated on `DEV_MODE`, and it is no longer baked
into any config a production `wrangler deploy` would ship. Spec-
conformant, and closes a stage-2 leak: a prior deploy of
`wrangler.jsonc` as-was would have shipped `DEV_MODE=1`, exposing
`/dev/mailbox` (claim links, one-time passwords) in production.

## STEP 3 — secrets / stage-2 wiring scan

`git diff 38860f9..7561cc1 | grep -iE
"api[_-]?key|secret|token.*=.*['\"][a-zA-Z0-9]{20,}|password.*=.*['\"]|AKIA|sk-|bearer "`
returns only: prose mentions of the word "secret" in ledger/decision
doc text discussing the DEC-183 fix itself and pre-existing drizzle
auto-generated migration filenames (e.g. `0000_secret_matthew_
murdock`, a stock drizzle-kit adjective-name generator, not a
credential); `passwordHash`/`verifyPassword`/`newSessionToken`/
`resetToken`/`csrfToken`/`claimToken` identifier names (existing
patterns, not literal values); and one test fixture literal
`const PASSWORD = "correct-password-123"` in `test/auth.test.ts`
(a hardcoded test-only password for exercising the DEC-180 rate-limit
tests, not a real credential, not committed to any runtime config).
Zero live secrets, API keys, or external-service credentials in the
delta. No stage-2 platform wiring introduced — the entire diff is
either local rate-limit/CSRF/CSV/id-validation logic, a local dev-vars
config change, or documentation.

## RESULT

OPEN ITEMS: 0

RESULT: PASS — S' = `7561cc1` ("merge task-w10-d"), ancestor check
passes, all 17 preconditions hit, `git diff 38860f9..7561cc1` audited
clean against SPEC.md/docs/ precedence: all five wave-10 fixes
(DEC-179..183) are spec-conformant per DEC-114/DEC-072/DEC-181's
stated invariants, zero secrets/credentials, and no stage-2 wiring
introduced.
