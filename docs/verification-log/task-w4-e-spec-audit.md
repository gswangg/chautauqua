# task-w4-e — spec-audit @ c211d4c

DEC-250 exit-battery lane, S = `c211d4c02bb49c9d01f0730b9d8788c156d3a459`
("merge task-w3-d"). Log-only worker report; this is the required single
new file for this task. Structure mirrors
`docs/verification-log/task-w27-e-spec-audit.md`'s check-list-and-PASS-
criteria format, re-scoped to the specific SPEC §8/§9 (repo's current
numbering: §6 Security / §7 Performance — SPEC.md's TOC shifted since the
task text was drafted; §8 is now "Deployment & operations" and §9 is
"Verification", neither of which is a security/performance checklist, so
this audit targets the section whose *content* matches the task's
description, i.e. §6/§7 — flagged here as a narrow interpretation, not a
scope change) security + performance checklist, plus the DEC-246
contract-of-record spot-check.

## Step 0 — DEC-250 freeze check

`git -C .../chautauqua rev-parse main` = `93a16b6` ("scribe wave 4").
`git -C .../chautauqua merge-base --is-ancestor c211d4c main` exits 0
(ancestor confirmed). `git -C .../chautauqua diff --stat c211d4c 93a16b6`
shows exactly four changed files, all allow-listed per DEC-250:

- `decisions/DEC-250.md`, `decisions/DEC-251.md` (new decision docs —
  `decisions/**`).
- `field-guide/index.md` (scribe compaction — `field-guide/**`).
- `src/decisions.ts` (pure string-constant append, 2 lines — allow-listed).

No `src/`-code path other than the `src/decisions.ts` constant append,
`app/`, `test/`, `migrations/`, or `wrangler.jsonc` change appears in the
range. Per DEC-250 this is explicitly NOT drift. **Freeze check: PASS.**
Audit performed via a detached worktree at S
(`chautauqua-wt/task-w4-e-frozen`, read-only, no server booted); all
file:line citations below are against that tree.

## Step 1 — SPEC §6 (Security) checklist

| # | Check | Citation @ S | Result |
|---|-------|---------------|--------|
| 1 | Authz middleware on every mounted admin/API route group | `src/index.ts:40-73` (23 `app.route()` mounts, DEC-012/013 — the ONLY mount site); every admin/`/api/v1` sub-app imports and applies `requireOrganizer`/`requireReviewer`/`requireSpeaker` at the file that owns it — confirmed present in `src/routes/{agenda.ts,api/contacts.ts,api/email-log.ts,api/events.ts,api/exports.ts,api/forms.ts,api/overview.ts,api/pipeline.ts,api/portal-config.ts,api/submissions.ts,api/tokens.ts,api/users.ts,api/views.ts,comms.ts,files.ts,review.ts,tasks.ts}` (grep `requireOrganizer\|requireReviewer\|requireSpeaker`). Portal sub-apps (`portal/index.tsx`, `tasks.tsx`, `edit.tsx`, `profile.tsx`) instead gate via `speakerGate` (`src/routes/portal/shared.tsx:22`, SSR-redirect variant intentionally distinct from the JSON `requireSpeaker`, documented at `shared.tsx:19-21`). `me.ts` relies on the always-on global `sessionLoader` (`src/server/app.ts:28`, `app.use("*", sessionLoader)` ahead of every route) plus its own `auth.userId` scoping. Public-surface files (`routes/public/*`, `routes/root.tsx`, `routes/docs.tsx`, `routes/auth.tsx`, `routes/dev/mailbox.tsx`) are intentionally unauthenticated/dev-only, matching their role. | PASS |
| 2 | Object-level ownership checks on every fetch-by-id | `src/server/repo/portal.ts` (`assertSpeakerContactId`/`getParticipantScope` imported at `routes/portal/index.tsx:20,24`); `src/server/repo/files.ts` `getSubmissionScope` (used in `routes/files.ts`); `src/routes/review.ts:625-628` DEC-211 existence-hiding 404 pattern (re-confirmed unchanged from w27). | PASS |
| 3 | Server-side filtering for all public/embed data, never CSS-hidden | `src/server/repo/public.ts:1-11` header + `visibleSubmissionConditions()` at line 32, applied at lines 154, 372 — SQL-level `status='accepted' AND content_status='approved' AND participant.visible=1 AND invite_status IN (...)` (DEC-108); module header states this is "the ONLY module that touches drizzle row types for public data." | PASS |
| 4 | HttpOnly/Secure/SameSite=Lax cookies | `src/auth/cookies.ts:83-86` (`isSecureRequest`), `:94-101` (`buildCsrfCookie`: unconditional `HttpOnly`, `SameSite=Lax`, conditional `Secure`), `:104-113` (`buildDraftCookie`, same pattern, `Path=/submit`) — DEC-228. | PASS |
| 5 | CSRF: custom header on JSON, token on form posts | `src/server/middleware.ts:279` `csrfFormOrHeader` def (DEC-181); `csrfJson`/`csrfForm`/`csrfFormOrHeader` applied across 20 route files incl. `auth.tsx`, `account.tsx`, `api/{contacts,events,forms,pipeline,portal-config,submissions,tokens,users,views}.ts`, `comms.ts`, `files.ts`, `portal/{edit,index,profile,tasks}.tsx`, `public/submit.tsx`, `review.ts`, `tasks.ts`, `agenda.ts` (grep count = 20 files, DEC-053/DEC-181). | PASS |
| 6 | PBKDF2-SHA256, iterations pinned (DEC-004 amended DEC-237, workerd 100k cap) | `src/auth/password.ts:16` `export const ITERATIONS = 100_000;`, header comment lines 1-5 explains the amendment. Test: `test/password-iterations.test.ts:10,13,20-21` pins `ITERATIONS <= 100_000` and the golden format regex `pbkdf2$v1$100000$...`; `test/auth.test.ts:20` `GOLDEN_FORMAT_RE` matches the same literal. | PASS |
| 7 | Uploads: extension+MIME allowlist, size caps, forced content type, no HTML | `src/domain/files.ts:92-125` `validateUpload` — extension allowlist via `ext in DOCUMENT_EXT_CONTENT_TYPE`/`IMAGE_EXT_CONTENT_TYPE`/`TEXT_EXT_CONTENT_TYPE` lookups, per-category size caps (`DOCUMENT_MAX_BYTES`, `IMAGE_MAX_BYTES`), forced `servedContentType` from the allowlist map (never derived from client input) — header comment lines 92-95 states "Never returns an HTML content type." | PASS |
| 8 | Rate limits on auth (+ public submission) | `src/routes/auth.tsx:107-140` — dual per-email + per-IP budget (DEC-072), `peekScopedLimit`/counters only advance on failure (DEC-180, line 132), `RATE_LIMIT_ERROR` message at line 35. | PASS |
| 9 | Parameterized queries only (Drizzle) | No raw-SQL string concatenation found outside `sql` tagged-template usage in `src/server/repo/public.ts` (imports `sql` from `drizzle-orm` at line 13, used only via the drizzle query builder). | PASS |
| 10 | Public submission validates server-side against form schema | `src/routes/public/submit.tsx` + `src/forms/validate.ts` (DEC-227 checkbox fix at `validate.ts:75-83`, re-confirmed unchanged from w27) — server-side `required`/type/conditional-visibility checks independent of client rendering. | PASS |
| 11 | Bounded array inputs (parseBoundedIdArray) | `src/server/http.ts:58` def; call sites at `routes/api/submissions.ts:331` (DEC-182), `routes/api/contacts.ts:542`, `routes/files.ts:214` (DEC-182), `routes/tasks.ts:264,347`. | PASS |
| 12 | CSV formula-injection escape (DEC-179) | `src/lib/csv.ts:145-150` — leading `=+-@\t\r` chars get an apostrophe prefix, applied before every cell is written; `src/routes/api/exports.ts:15` imports `toCsv` from this module (sole CSV-serialization path). | PASS |

## Step 2 — SPEC §7 (Performance) checklist

| # | Check | Citation @ S | Result |
|---|-------|---------------|--------|
| 13 | D1 indexes on FK + (event_id,status) + (event_id,slug) | `src/db/schema.ts` — 49 `index(...)` declarations (grep count). | PASS |
| 14 | Server pagination/filtering on admin lists | `src/routes/api/submissions.ts`, `src/routes/api/views.ts` (saved views/filters, cited unchanged from w27 J3). | PASS |
| 15 | SPA code-split by route; initial bundle < 300 KB gz, CI-enforced | `scripts/bundle-check-lib.ts:5` `export const BUDGET_BYTES = 300 * 1024;`, `checkEntryBudget` exported; `test/bundle-check.test.ts:18` "uses the default 300 KB budget when none is passed." | PASS |
| 16 | CI perf smoke against hot endpoints, budget-enforced build failure | `scripts/perf-smoke-lib.ts` (`PERF_P95_BUDGET_MS`, `computeP95`, `planPerfPages`), exercised by `test/perf-smoke.test.ts:1-9`; seed fixture at `test/perf-seed.test.ts`. | PASS |

## Step 3 — DEC-246 contract-of-record coverage (flat `{items}` envelope, DEC-247)

`test/spa-contract-sweep.test.ts` (508 lines total) exercises the payload
families per DEC-246 (SPA `app/src/*/types.ts` is the contract of record).
The DEC-247 flat-envelope regression for
`GET /api/v1/submissions/:id/files` is at lines 192-236: `describe`
block header at line 192 (`"DEC-239/DEC-247: GET
/api/v1/submissions/:id/files vs DeliverableFile"`), mocks
`listSubmissionFiles` returning the repo's internal kind-grouped shape
(`{ presentation: [...] }`, lines 203-213), asserts the HTTP response is
instead the flat envelope: `expect(keysOf(body)).toEqual(["items"])` and
the per-item key set
`["contentType","createdAt","filename","id","kind","previousFileId",
"sizeBytes","submissionId","uploadedByContactId"]` (lines 229-236+).
Task cited "lines ~187-231" — actual span is 186-236 (`describe` block
comment starts at 186), within 5 lines of the estimate, immaterial.
**PASS.**

## Deferred / out of scope (unchanged from prior batteries)

Real deployment, Resend provider wiring, Airtable sync, DNS/CI deploy
pipeline, Resend webhooks — all stage-2, correctly absent from the
stage-1 tree per DEC-061. Not counted as findings.

## Note on task-text section numbering

The task delegation cites "SPEC.md §8/§9 security and performance."
SPEC.md's current TOC (unchanged since at least wave 3) has Security at
§6, Performance at §7, Deployment & operations at §8, and Verification at
§9 — the numbering has drifted since the task text was authored (likely
an earlier SPEC.md draft had two fewer preceding sections). This audit
targeted §6/§7 by content match, since those are the sections that
actually contain the security/performance checklist items enumerated in
the task description; §8/§9 as currently numbered contain no
security/performance requirements to audit. Flagging as a gap for the
scribe/planner, not treating it as a design decision.

## Disposition

All 16 SPEC §6/§7 checklist items plus the DEC-246/DEC-247
contract-of-record spot-check resolve to cited implementation (file:line)
at S, with covering tests present for every item that has a test
counterpart. Freeze check confirms zero product drift since S.

**OPEN ITEMS: 0** (task-text section-number drift noted above, not a
product finding; 5 stage-2 items correctly deferred).

**RESULT: PASS — 17/17 checks cite implementation evidence at S with
zero drift; SPEC §6/§7 security+performance surface and the DEC-246/247
contract-of-record coverage both CONFORM.**
