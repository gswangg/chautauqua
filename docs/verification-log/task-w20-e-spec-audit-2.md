# 2026-08-10 task-w20-e — spec-audit @ 6807b67

Full detail for the `## 2026-08-10 task-w20-e — spec-audit @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069 scope-4 spec-audit gate, seventh-generation battery (DEC-205/206),
log-only lane (this file plus the optional detail doc below are the only
modification). Full detail: `docs/verification-log/task-w20-e-spec-audit.md`.

**STEP 1 — DEC-114 sha check.** Worktree cut from `main` tip `78bb286`
("scribe wave 20"). First-parent walk: `78bb286`'s diff
(`git diff --stat 6807b67 78bb286`) touches only `decisions/DEC-205.md`,
`decisions/DEC-206.md`, `field-guide/index.md`, `src/decisions.ts` (two
pure string-constant appends, `DEC_205`/`DEC_206`) — every path is inside
the DEC-114 bookkeeping-exclusion set, so `78bb286` is not code-bearing.
Its parent `6807b67` ("merge task-w18-b") is the newest code-bearing sha,
matching DEC-206's FROZEN binding exactly. Sha check: **PASS** (equals
`6807b67`, no drift).

**STEP 2 — DEC-203 precondition greps**, re-run against the tree (not
copied):
- `grep -n "toLowerCase" src/routes/api/users.ts` → line 57:
  `record.email === "string" ? record.email.trim().toLowerCase() : ""`.
- `grep -n "lower(" src/server/repo/users.ts` → line 54:
  `.where(sql\`lower(${schema.user.email}) = ${input.email}\`)`.
- `grep -n "accountRoutes" src/index.ts` → line 4 (import), line 41
  (`app.route("/", accountRoutes)`) — mounted.
- Welcome email text (`src/routes/api/users.ts:79`): `` `An account has
  been created for you.\n\nEmail: ${created.email}\n\nSign in at /login
  with the temporary password your organizer will share with you; you can
  change it at /account/password after signing in.` `` — the literal
  generated `password` variable is never interpolated into this string
  (only appears later in the JSON API response `{..., password}`, never
  in the mailer `text`/`html`). Precondition satisfied.

All four DEC-203 preconditions present. Proceeding.

**STEP 3 — homonym guard (DEC-129/206).** Searched
`docs/verification-log.md` for prior `spec-audit` sections: the most
recent by file position is `## 2026-08-10 task-w19-d — spec-audit @
8c7f479` (line 3302). Per DEC-206 this is an explicitly-named dead
homonym (full-heading mismatch: `8c7f479` != `6807b67`) from the
abandoned wave-19/20 unmerged lineage — its content was used only as a
structural template (methodology, section shape), not as evidence; every
finding below was independently re-derived against `6807b67`.

**STEP 4 — spot-check (a): DEC-199 case-insensitive org-user emails,
end to end.**
- `src/routes/api/users.ts:57` — email lowercased at the API boundary
  before any repo call (`record.email.trim().toLowerCase()`).
- `src/server/repo/users.ts:50-58` — `createUser` asserts its input is
  already lowercase (`if (input.email !== input.email.toLowerCase())
  throw new Error(...)`, line 52 area) and the duplicate check runs
  `sql\`lower(email) = ${input.email}\`` (line 54) rather than a plain
  equality, so pre-existing mixed-case rows (from before the fix) still
  collide correctly with a new lowercase attempt.
- `test/users-api.test.ts` — a `describe("DEC-199 email case
  normalization + login regression", ...)` block (line 169) exercises
  the real repo/route code (not a mock); `npx vitest run
  test/users-api.test.ts` — 12/12 tests pass.
- No stage-1 regression: login (`src/routes/auth.tsx`) was not touched
  by this audit's grep sweep beyond what DEC-199's own fix required;
  `test/auth.test.ts` is covered separately under the standing
  auth-flake disposition (DEC-197/203), not re-run here (out of this
  lane's scope — build+test lane owns it).

**STEP 5 — spot-check (b): DEC-200 self-service password change,
`src/routes/account.tsx`.**
- `verifyPassword(current, user.passwordHash)` (line 112) gates on the
  current password before any mutation; wrong current password returns
  400 with no state change.
- `next.length < 8` (line 117) enforces the minimum; `next !== confirm`
  (line 124) enforces confirmation match — both checked before the
  `db.update` write.
- Session handling (lines 136-153): `db.delete(schema.authSession)
  .where(eq(schema.authSession.userId, auth.userId))` revokes every
  session row for the user (including the one making the request), then
  a fresh `authSession` row + `Set-Cookie` is issued immediately after —
  net effect matches the DEC-200 comment exactly ("this browser stays
  signed in, every other device/browser is signed out").
- Anonymous access: `requireAuthOr302` (lines 86-94) redirects
  unauthenticated POSTs to `/login` with 302, running ahead of
  `csrfForm` per its own comment (so an anonymous POST never fails CSRF
  validation first).
- Links: `src/routes/portal/profile.tsx:131` — `<a
  href="/account/password">Change password</a>`; `app/src/pages/
  Settings.tsx:76` — same link text/href. Both present.
- Welcome copy: `src/routes/api/users.ts:79` — confirmed password-free
  (see STEP 2).
- `npx vitest run test/account-password.test.ts` — 7/7 tests pass,
  including "old password now fails login (401), new password
  succeeds" and "revokes every other session while the response's new
  cookie keeps this browser signed in".

**STEP 6 — spot-check (c): DEC-201/202 scoping.** `grep -rn "DEC_201\|
DEC-201\|DEC_202\|DEC-202" src/ docs/` (excluding `src/decisions.ts` and
this log) returns zero hits — no code branches on these decisions, i.e.
no stage-1 code was written to "fix" what DEC-201/202 explicitly accept
as stage-2 deferrals. Spot-confirmed the underlying behavior is still
present unmodified: `src/server/app.ts:13` imports
`bumpPublicVersionMiddleware` from `./pubcache` (global bump on every
mutation, matching DEC-201's "ACCEPTED for stage-1" text verbatim), and
the KV-backed rate limiter (`src/routes/auth.tsx`, unchanged by this
wave's diffs per STEP 1's file list) retains its documented
read-then-write non-atomicity (DEC-202). No stage-1 regression snuck in
around either acceptance.

**STEP 7 — spot-check (d): eval-rubric id -> verification-hook mapping.**
`docs/eval-rubric/*.yaml` — 7 files, 116 `rubric[].id` entries total
(`grep -n "^  - id:" docs/eval-rubric/*.yaml | wc -l` → 116). Every
rubric entry carries a `testability` field of `auto`, `auto-partial`, or
`manual`, each mapped to its `scenarios` list; the corresponding
`scenarios[].id` entries define the concrete UI steps a `walkthrough`
gate lane (task-w*-b, most recently `task-w17-*`/wave-18/19/20 walkthrough
confirms) exercises end-to-end, and `manual`/`auto-partial` ids each carry
explicit `manual_instructions` for the documented human-check hook (e.g.
CFP-08, CFP-14 above — email-delivery checks the walkthrough automation
cannot itself observe). Spot-checked two other areas
(`docs/eval-rubric/03-speaker-management.yaml`,
`docs/eval-rubric/04-content-management.yaml`) for the same shape — both
hold. No rubric id references `password`/`account`/`login`/`user`/`email`
by name (`grep -in` sweep, zero hits), so DEC-199/DEC-200 are stage-1
correctness fixes outside rubric scope, not new rubric gaps — consistent
with DEC-203's own framing ("two newly verified defects ... stage-1
correctness violations", not eval-rubric findings). No id lacks a hook.

**STEP 8 — SPEC.md J1-J12 / DEC-114-excluded-file re-audit.** No product
files changed between the last full-tree spec-audit PASS lineage
(`task-w15-f`/`task-w15-j`-style §8/§9 sweeps, which found zero drift)
and `6807b67` other than the DEC-199 (`080c07e`) and DEC-200 (`16f6020`)
commits themselves, both independently re-verified above. Re-ran the
standing §8/§9 spot checks: `grep -rln 'from "node:\|cloudflare:'
src/{auth,domain,forms,mail,lib}` → 0 hits (DEC-002 intact); `grep -rn
"process.env\|API_KEY\|SECRET" src/ wrangler.jsonc` → 0 hits (secrets-free
intact); `grep -n "^import" src/server/repo/submissions/status.ts | grep
-i mail` → 0 hits (status changes still never auto-email); `grep -n
"DROP" migrations/*.sql` → 0 hits (append-only intact). `npm run build`
clean.

**STEP 9 — build+test spot-check.** `([ -d node_modules ] || npm ci
--prefer-offline --no-audit --no-fund --silent) && npm run build` — clean
build. `npx vitest run test/users-api.test.ts test/account-password.test.ts
--silent` — 19/19 pass. No server started (log-only lane; full
build+test/perf-smoke/walkthrough/render-sweep ownership sits with the
other five wave-20 battery lanes).

No new gap found. STEP 4-8 all independently confirm the FROZEN sha's
DEC-199/DEC-200 fixes are correct and complete, DEC-201/202 remain
properly scoped stage-2 acceptances with no stage-1 code drift around
them, and every eval-rubric id maps to an existing verification hook.

OPEN ITEMS: 0

RESULT: PASS
