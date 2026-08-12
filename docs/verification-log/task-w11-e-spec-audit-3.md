# 2026-08-10 task-w11-e — spec-audit @ 7561cc1

Full detail for the `## 2026-08-10 task-w11-e — spec-audit @ 7561cc1` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-186/DEC-185/DEC-179..183/DEC-068 gate. Log-only lane. Full detail
in `docs/verification-log/task-w11-e-spec-audit.md`. Note: a
first-campaign homonym section `task-w11-e — spec-audit @ 3b7ed3d`
already exists earlier in this file (different sha, different
campaign) — inert per DEC-129; this section is distinguished by its
`@ 7561cc1` suffix.

**STEP 1 — sha derivation, ancestor check, preconditions.** First-
parent walk from `main` lands on `7561cc1` ("merge task-w10-d") —
matches DEC-185's expected S' exactly. `git merge-base --is-ancestor
2dd2f33 7561cc1` exits 0. All 17 preconditions (12 DEC-177 anchors +
5 DEC-185 markers: `DEC-179` in `src/lib/csv.ts`, `DEC-180` in
`src/lib/rate-limit.ts`, `DEC-181` in `src/server/middleware.ts`,
`DEC-182` in `src/server/http.ts`, `DEC-183` in `wrangler.jsonc` +
`.dev.vars` present with `DEV_MODE=1`) hit at `7561cc1`. No
precondition FAIL.

**STEP 2 — audit `git diff 38860f9..7561cc1`.** 44 files changed,
2717 insertions(+), 78 deletions(-) — exactly the five wave-10 fixes
+ tests, `.dev.vars` addition, and ledger/decision/field-guide
appends, no other product code touched. Each fix confirmed spec-
conformant: DEC-179's `toCsv` formula-injection escape only touches
export serialization (`formatCell`), leaving `parseCsv`/the
speakers.csv import fixture untouched — no corruption. DEC-180 adds
peek/increment/reset primitives and leaves `checkAndIncrementScoped
Limit` (used by public submit) byte-for-byte unchanged; `/login`
still runs DEC-072's two independent scopes (`login-user` 20/15min,
`login-ip` 100/15min flood guard), now counting failures only and
resetting `login-user` on success. DEC-181's `csrfFormOrHeader` on
`POST /logout` accepts the admin SPA's `x-chq-csrf: 1` header
(`app/src/App.tsx:69`, confirmed present) or the plain-form double-
submit pair; every `PortalLayout` call site now threads `csrfToken`
through to the sign-out form (`grep -L csrfToken` over every
`PortalLayout` caller returns empty). DEC-182's `parseBoundedIdArray`
throws `ApiError("invalid", message, {field: ...})`, matching the
`{error:{code,message,fields?}}` envelope, applied to all four bulk-
ids call sites (`contactIds`, `ids`, `fileIds`, optional `taskIds`).
DEC-183: `wrangler.jsonc`'s `vars.DEV_MODE` block is deleted (replaced
by a `// DEC-183` comment), `.dev.vars` is git-tracked (removed from
`.gitignore`) and sets `DEV_MODE=1`, and `/dev/mailbox` (`src/routes/
dev/mailbox.tsx`'s `shouldMountDevMailbox`) remains gated on
`env.DEV_MODE === "1"` — closes the prior stage-2 leak where a
`wrangler deploy` would have shipped `DEV_MODE=1` and exposed the
mailbox in production.

**STEP 3 — secrets / stage-2 wiring scan.** Grep over the diff for
credential-shaped patterns turns up only prose mentions of the word
"secret" in ledger/decision text, a pre-existing drizzle-generated
migration filename (`0000_secret_matthew_murdock`), existing
identifier names (`passwordHash`, `csrfToken`, etc.), and one
test-only fixture literal (`test/auth.test.ts`'s `PASSWORD =
"correct-password-123"`, used only to exercise the DEC-180 rate-limit
tests). Zero live secrets or API keys. No stage-2 platform wiring
introduced anywhere in the delta.

**Build/test.** `npm ci --prefer-offline --no-audit --no-fund
--silent` clean (cached). `npm run build`: PASS, 0 tsc errors, vite
build clean (131 modules). `npm test --silent`: PASS, **152 test
files / 1364 tests**, 0 failures.

OPEN ITEMS: 0

RESULT: PASS — S' = `7561cc1` ("merge task-w10-d"), 17/17
preconditions hit, delta audited clean against SPEC.md/docs/
precedence (clarifications.md overrides all), all five wave-10 fixes
spec-conformant, zero secrets, no stage-2 wiring.
