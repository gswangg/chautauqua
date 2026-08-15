# task-w28-e — SPEC §6/§7 static audit @ c6dbdb7c

QUALIFYING SPEC static-audit lane (DEC-069 wave-28 amendment), constrained
by DEC-063 (a check that passes nine times has stopped checking), DEC-976
(a claim without a quoted line is a rumour), DEC-129. LOG-ONLY — no server
started, no `src/`/`app/src/`/`scripts/`/`test/`/`migrations/`/
`package.json` file touched by this lane; `npm run build` +
`npm run bundle:check` were run read-only against the checked-out tree to
produce a measured number (writes only to gitignored `public/admin` /
`dist`, not committed).

S (tip sha read from `.git` at runtime,
`git -C .../task-w28-e rev-parse HEAD`) = `c6dbdb7cc615248d1a49485d63320570168f4c7` (short `c6dbdb7c`).

`git log --oneline ceda66f2..c6dbdb7c -- src/ app/src/ migrations/
package.json` = 3 merge/fix commits touching only
`app/src/pages/comms/comms.css` (-1 line), `app/src/pages/forms/forms.css`
(-1 line), `src/routes/auth.css.ts` (-1 line, all `line-height:1` deletions
per DEC-991) and `src/server/repo/submissions/status.ts` (+10/-4). None of
the four is a schema, migration, vite-config, or bundle-check file, so
task-w27-e's `ceda66f2` §7-item-1 (FK indices) and §7-item-2 (code-split)
findings carry forward unchanged at S — re-cited, not re-derived, per
DEC-063.

## §8/§9 — two things re-checked, rest cited (nine-times-green, DEC-063)

Newest two receipts that graded §8/§9 clause-by-clause:
`docs/verification-log/task-w27-e-spec-audit-ceda66f2.md` (§8/§9 section,
"retired to citations (PASS nine times across two campaigns)") and
`docs/verification-log/task-w27-e-spec-audit.md` (J1-J12 + rubric-ID sweep,
tree `f01459a`). Per DEC-063 the two rot-prone facts only:

1. Quickstart literal match, README.md:45-48 vs package.json:
   README.md:45-48 reads (verbatim):
   ```
   npm i
   npm run db:migrate
   npm run seed
   npm run dev
   ```
   package.json:8,11,12 (script name column): `"dev": "wrangler dev"`,
   `"db:migrate": "wrangler d1 migrations apply chautauqua --local"`,
   `"seed": "tsx scripts/seed.ts && wrangler d1 execute chautauqua --local
   --file=.seed.sql && tsx scripts/seed-r2.ts"`. All three script names
   (`db:migrate`, `seed`, `dev`) used by README.md exist verbatim in
   package.json's `scripts` block. **Still matches.**

2. "For evaluators" URLs + credentials vs `scripts/seed.ts`:
   README.md:213-219 (persona table) reads (verbatim, quoting the header +
   organizer row): `| Persona | Email | Password |` /
   `| Organizer (producer/admin) | \`sbek-organizer@example.com\` |
   \`SbekTest!2027-org\` |`, captioned "Seeded persona credentials (verbatim
   from `docs/fixtures/sample-data.json`, as loaded by `scripts/seed.ts`)".
   `docs/fixtures/sample-data.json:30-31` quotes `"email":
   "sbek-organizer@example.com"`, `"password": "SbekTest!2027-org"` — and
   the speaker/speaker2/reviewer rows (README.md:214-216) match
   `sample-data.json:36-37,48-49,56-57` (`sbek-speaker@example.com` /
   `SbekTest!2027-spk`, `sbek-speaker2@example.com` /
   `SbekTest!2027-spk2`, `sbek-reviewer@example.com` /
   `SbekTest!2027-rev`) exactly. `scripts/seed.ts` is the script README.md
   itself names as the loader (not independently re-read here — the receipt
   this cites, task-w27-e-spec-audit.md's Step 5, already confirmed
   `scripts/seed.ts` reads `sample-data.json` rather than hardcoding
   personas). README's demo event slug line ("Seeded demo event slug:
   `devflow-conf-2027`", README.md:211) also present, unchanged. **Still
   matches.**

Rest of §8/§9: cited from `task-w27-e-spec-audit-ceda66f2.md` §8/§9 section
(deploy command, seed-as-grader-package, MIT license) — not re-derived.

## §6 Security (SPEC.md:306-321) — clause by clause

1. **PBKDF2-SHA256, 100,000 iterations, constant-time compares; session
   rotation on login** (SPEC.md:312): `src/auth/password.ts:27`
   `export const ITERATIONS = 100_000;`, comment at `password.ts:1`
   ("Password hashing per DEC-004 (amended): PBKDF2-SHA256, 100000
   iterations..."). Constant-time compare and session-rotation-on-login NOT
   RE-CHECKED this lane (budget spent on FK/bundle/rate-limit items below;
   grep confirms `src/auth/password.ts` exists and matches the iteration
   count, deeper verify-path/rotation tracing deferred).

2. **HttpOnly/Secure/SameSite=Lax cookies; CSRF custom-header on JSON,
   token on form posts** (SPEC.md:313-314): `src/auth/cookies.ts:21-22`
   `"HttpOnly", "SameSite=Lax"` (session cookie attrs, `Secure` pushed
   conditionally at `cookies.ts:26-27` `if (options.secure) {
   attributes.push("Secure"); }`). CSRF: `src/server/middleware.ts:267-271`
   `export const csrfJson: MiddlewareHandler<AppEnv> = async (c, next) => {
   if (!c.var.auth?.viaBearer && c.req.header(CSRF_HEADER) !== "1") { throw
   new ApiError("invalid", "Missing or invalid CSRF header"); } ...}` (JSON,
   header-based); `src/server/middleware.ts:276-291`
   `export const csrfForm: ... const cookieToken = cookies[CSRF_COOKIE_NAME];
   ... const formToken = body[CSRF_COOKIE_NAME]; if
   (!checkDoubleSubmitCsrf(cookieToken, formToken)) { throw new ApiError
   ("invalid", "CSRF token mismatch"); }` (form, double-submit token).
   **Confirmed.**

3. **Authz middleware on every admin/API route: role + event grant;
   object-level ownership on every fetch-by-id (no IDOR); speaker→/admin
   403/redirect** (SPEC.md:315-317): role gate —
   `src/server/middleware.ts:245-259` `function requireRole(role) { return
   async (c, next) => { const auth = c.var.auth; if (!auth) { throw new
   ApiError("unauthorized", "Login required"); } if (auth.role !== role) {
   throw new ApiError("forbidden", \`Requires role '${role}'\`); }
   await next(); }; } export const requireOrganizer = requireRole
   ("organizer"); export const requireReviewer = requireRole("reviewer");
   export const requireSpeaker = requireRole("speaker");`. Object-level
   ownership on fetch-by-id — `src/server/repo/files-authz.ts:113-129`
   `getFileScope` loads the file row by `fileId`, then derives
   `getSubmissionScope` (participant/org scoping) before any content is
   served, consumed at `src/routes/files.ts:655-669`
   (`authzServeFile` → `if (!canAccessResourceFile(auth, resourceScope))
   throw new ApiError("forbidden", ...)` / `if (!canAccessTaskFile(auth,
   taskScope)) throw new ApiError("forbidden", ...)`) — every branch is a
   scope-lookup-then-authorize pair, no fetch-by-id returns content before
   an ownership check. Speaker→/admin 403/redirect NOT RE-CHECKED this
   lane (not grepped; would require tracing the `/admin` mount's
   role-guard composition, outside this budget slice).

4. **Server-side filtering for public/anonymized data** (SPEC.md:318):
   `src/server/repo/public/gates.ts:25-27` `export function
   visibleSessionConditions() { return and(eq(schema.submission.status,
   "accepted"), eq(schema.submission.contentStatus, "approved")); }` and
   `gates.ts:36-41` `export function visibleParticipantConditions() {
   return and(eq(schema.participant.visible, true), inArray
   (schema.participant.inviteStatus, ["none", "accepted"])); }` — both are
   SQL `WHERE`-clause builders (`drizzle-orm`'s `and`/`eq`/`inArray`), not
   post-fetch/client filters. **Confirmed server-side, not CSS-hidden.**

5. **Uploads: extension+MIME allowlist, size caps, random R2 keys,
   authenticated serve route, no HTML content types** (SPEC.md:319-320):
   allowlist — `src/domain/files.ts:24-25` comment "DEC-020 allowlist:
   extension -> forced served content type. Never an HTML content type";
   size caps — `files.ts:67-68,96`
   `export const DOCUMENT_MAX_BYTES = 25 * BYTES_PER_MB; export const
   IMAGE_MAX_BYTES = 8 * BYTES_PER_MB; ... export const VIDEO_MAX_BYTES =
   95 * BYTES_PER_MB;`. Random R2 keys —
   `src/routes/files.ts:213` `` const r2Key = `sub/${submissionId}/
   ${newId()}-${sanitized}`; `` (also `portal/tasks.tsx:411,569`,
   `portal/profile.tsx:383`, `api/contacts/crud.ts:476`,
   `api/portal-config.ts:215` — every upload site keys off `newId()`, not a
   client-supplied name). Authenticated serve route + no-HTML enforcement —
   `src/domain/files.ts:546-548`
   `if (value.toLowerCase().startsWith("text/html")) { throw new Error(...)
   }` (`assertServedContentTypeHeader`), called at
   `src/routes/files.ts:674` before every served response, plus
   `X-Content-Type-Options: nosniff` (`files.ts:677` header block) and
   `Content-Disposition: attachment` for non-images (`files.ts:679-681`).
   **Confirmed on all five sub-claims.**

6. **Parameterized queries only (Drizzle)** (SPEC.md:321): cited from
   `task-w27-e-spec-audit-ceda66f2.md` §6-item-4 (grep for
   template-literal string concatenation outside the `sql` tag: zero hits;
   no `src/**` change touches a query-building file since `ceda66f2`, per
   the diff-stat above) — re-cited, not re-derived.

7. **Rate limits on auth + public submission** (SPEC.md:321):
   `src/routes/auth-login.tsx:120,141,163` — three independent scopes,
   `checkAndIncrementScopedLimit(db, "login-account", accountKey, ...)`,
   `checkAndIncrementScopedLimit(db, "login-user", identityKey, ...)`,
   `checkAndIncrementScopedLimit(db, "login-ip", ip, ...)`.
   `src/routes/auth-reset.tsx:78,99` — `checkAndIncrementScopedLimit(db,
   "forgot-ip", ip, now, ...)` and `checkAndIncrementScopedLimit(db,
   "forgot", normalizedEmail, now, ...)`. `src/routes/account.tsx:202-204`
   — `checkAndIncrementScopedLimit(db, "password-change", auth.userId,
   rateLimitNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS, max:
   AUTH_RATE_LIMIT_MAX, ...})`. Public submission —
   `src/routes/public/submit-post.tsx:36-37` imports
   `requestIpFromHeaders` and `checkAndIncrementScopedLimit` (same
   mechanism applied to the public CFP POST route). **Confirmed: auth
   (login/forgot/password-change) and public submission both rate-limited
   via the same scoped-limit primitive, `src/server/repo/rate-limit.ts`.**

8. **`.dev.vars` gitignored; secrets via `wrangler secret`** (SPEC.md:321):
   cited from `task-w27-e-spec-audit-ceda66f2.md` §6-item-5 (`.gitignore:9`
   = `.dev.vars`) — re-cited, no gitignore change since `ceda66f2`.

9. **Public submission validates against server form schema (required,
   types, conditional visibility), never trusts client rendering**
   (SPEC.md:320-321): `src/routes/public/submit-post.tsx:25-26` imports
   `validateAnswers` (from `../../forms/validate`) and
   `makeVisibilityPredicate` (from `../../forms/visibility`) —
   `src/forms/validate.ts:57` `export function validateAnswers(` is the
   server-side entry point invoked on every POST, independent of whatever
   the client rendered (imports `resolveHiddenFieldIds` from
   `./visibility` at `validate.ts:2` to re-derive conditional visibility
   server-side rather than trusting a client-sent hidden-field list).
   **Confirmed.**

## §7 Performance (SPEC.md:322-358) — clause by clause

**Server budgets** (SPEC.md:326-335): p95 latency numbers, one-round-trip
joined queries, edge-cache TTFB, and Smart Placement are runtime/production
claims — NOT RE-CHECKED this lane (LOG-ONLY, no server started, no
production deploy to measure against; static grep cannot verify a
millisecond budget). Recorded as open, not silently passed.

**Perceived budgets** (SPEC.md:337-345): optimistic-render/fail-loudly-
rollback, <300ms nav, 100ms "feels instant" threshold are UX-runtime claims
— NOT RE-CHECKED this lane for the same reason (would need a running
browser + measurement harness, outside a LOG-ONLY static audit).

**Mechanics** (SPEC.md:347-358), the two never-checked structural claims:

**(a) D1 indexes on every FK + (event_id,status) + (event_id,slug).**
Re-derived from `task-w27-e-spec-audit-ceda66f2.md`'s full 65-row FK-column
population (every `<x>Id: text("<x>_id")` match across `src/db/schema/*.ts`
cross-referenced against `index()`/`uniqueIndex()` in the same files) —
**zero FK columns found with no covering index**; `(event_id,status)` =
`submission_event_id_status_idx` (`submissions.ts:40`); `(event_id,slug)`
resolves to `event_slug_idx` (`event.ts:28`, a `uniqueIndex` on `slug`
alone, since `event` IS the event row and has no `event_id` self-column).
`git diff --stat ceda66f2..c6dbdb7c -- src/db/schema src/db/schema.ts
migrations` at S = empty (no output — confirmed no schema/migration file
changed between the two audits), so this table carries forward unchanged,
not re-transcribed here to avoid drift risk from a second hand-copy
(DEC-976: cite the receipt that holds the quoted lines, don't re-type them
into a second document that can silently diverge). **Re-verified: zero
schema/migration delta since the audit that produced the table, so the
table's "zero gaps" finding still holds at S.**

**(b) code-splitting + bundle budget.** `app/vite.config.ts:19-22`
(`build: { outDir: '../public/admin', emptyOutDir: true }`) does not itself
configure `manualChunks` or any splitting — code-splitting instead comes
from `app/src/App.tsx`'s `lazy(pageLoaders.X)` per-route dynamic imports
(re-cited from `task-w27-e-spec-audit-ceda66f2.md` §7-item-2: no static
`import { XPage } from './pages/...'` of a page component found in
`App.tsx`), which is what Vite's default Rollup output actually
code-splits on. The 300 KB budget is enforced separately by
`scripts/bundle-check-lib.ts:5` `export const BUDGET_BYTES = 300 * 1024;`
consumed by `scripts/bundle-check.ts` (globs `public/admin/assets/index-
*.js` + `index-*.css`, gzips, sums, throws over budget). **Measured fresh
at S this lane** (`npm run build && npm run bundle:check`, run read-only,
output not committed):
```
Entry bundle: index-BhPrbvpM.js + index-DpG2gFFa.css = 69.19 kB gzip (budget 300.00 kB)
bundle:check PASSED
```
This closes the open item left by `task-w27-e-spec-audit-ceda66f2.md`
("pending-at-S ... NOT re-verified in this LOG-ONLY lane") — 69.19 kB gz
against the 300 KB budget is confirmed at `c6dbdb7c` itself, not carried
forward from wave 26's `73f380f2` measurement. Matches SPEC.md:357's
stated budget exactly (`300 KB gz`).

CI perf smoke (SPEC.md:358, "hit the hot endpoints against the 2k-row seed
and fail the build over budget"): NOT RE-CHECKED this lane (would require
running the seed + dev server + `scripts/perf-smoke.ts` against a live D1,
outside LOG-ONLY scope).

## Summary

OPEN ITEMS: 4 — §6 item 1's constant-time-compare/session-rotation detail
(not traced past the iteration-count constant), §6 item 3's
speaker→/admin redirect detail (not traced), §7's server + perceived
runtime budgets (both require a running instance to measure), §7's CI perf
smoke enforcement (requires seed + dev server). None graded PASS by
inference; all four recorded NOT RE-CHECKED with reason above.
