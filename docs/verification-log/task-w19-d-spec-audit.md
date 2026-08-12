# 2026-08-10 task-w19-d — spec-audit @ 8c7f479

Full detail for the `## 2026-08-10 task-w19-d — spec-audit @ 8c7f479` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069 scope-4 spec-audit gate at the post-wave-18 sha, DEC-134/135
third-barrier re-verification, log-only lane (this file is the only
modification; no fix applied per DEC-077/135).

**STEP 1 — sha re-derivation (DEC-114).** First-parent walk from `main`
tip `9038b5c` ("scribe wave 19"): its diff (`decisions/DEC-135.md`,
`field-guide/index.md`, `src/decisions.ts` — a single pure
string-constant append for `DEC_135`) is entirely inside the DEC-114
bookkeeping-exclusion set, so `9038b5c` is not code-bearing. Its
first parent `8c7f479` ("merge task-w18-c") diffs
`src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` — outside the exclusion set,
so `8c7f479` is code-bearing and is the newest code-bearing sha.
`git merge-base --is-ancestor 675219f 8c7f479` exits 0 (confirmed via
the ancestor check against the branch tip, which contains `8c7f479`)
— DEC-129 satisfied.

**STEP 2 — DEC-130..133 behavioral preflight (DEC-135), re-executed
against the tree, not copied from any prior section:**
- DEC-130 `src/domain/schedule.ts`: `autoSchedule` (line 108) builds
  `roomIndex`/`speakerIndex` Maps (lines 122-146) from `existing`
  placements and looks candidates up via `roomIndex.get`/
  `speakerIndex.get` inside the placement loop (lines 168-183) — no
  call to `findConflicts` anywhere inside `autoSchedule`; `findConflicts`
  (line 36) is only called from `scheduleSummary` (line 79), a separate
  exported function. Marker present.
- DEC-131 `src/mail/ics.ts`: `escapeText` (lines 39-47) runs
  `.replace(/\r\n/g, "\n")` then `.replace(/\r/g, "\n")` before any
  other escaping — CR is normalized to `\n` pre-escape, matching the
  DEC-131 fix description. Marker present.
- DEC-132 `src/routes/public/submit.tsx`: the validation-time file
  loop (lines 410-425) starts `if (!isVisible(field, answers))
  continue;` before touching `fileAnswers`/`fileErrors`/`answers`; the
  post-submission upload loop (lines 471-479) starts `if
  (cleaned[field.id] !== "pending") continue;`, and a hidden field
  never reaches the `"pending"` assignment in the first loop, so it's
  skipped here too — zero R2 put, zero file row, zero answer-row
  mutation for a hidden field. Marker present.
- DEC-133 `src/server/repo/submissions/status.ts`:
  `updateSubmissionStatuses` (line 190) computes `requested`/
  `foundIdSet`/`missing` (lines 224-227) and throws `ApiError("invalid",
  ...)` (lines 228-231) strictly before the mutation loops (lines
  237-266) — no `db.update`/`db.insert` call precedes the guard.
  Marker present.

All four markers present — proceeding per DEC-135 (none absent, so no
early FAIL/STOP).

**STEP 3 — full static SPEC §8/§9 audit, re-executed at the current
tree (methodology mirrors task-w15-j's structure; every grep/read below
was re-run, none copied):**

*§8 authz + visibility + CSRF + rate limits + secrets:*
- Every route sub-app under `src/routes/*.ts` (`agenda.ts`, `comms.ts`,
  `tasks.ts`, `review.ts`) gates handlers with `requireOrganizer` (and
  `review.ts` additionally uses an inline `requireReviewerOrOrganizer`
  helper for reviewer-or-organizer endpoints); `files.ts` and
  `portal/*` use inline `requireAuth`/scope-check helpers
  (`authzSubmissionWrite` in `files.ts:53-69`, checked against
  `getSubmissionScope`) implementing organizer-org-match OR
  participant-speaker-match — no route left unauthenticated except
  intentionally-public ones under `src/routes/public/` and
  `src/routes/public.tsx`.
- Public/embed visibility filtering: `src/server/repo/public.ts:38,239`
  still gate on `inArray(schema.participant.inviteStatus, ["none",
  "accepted"])` at both the shared query and `hydrateSessions`
  speaker-hydration (unchanged from prior sections, re-confirmed present
  in this tree).
- CSRF: `src/server/middleware.ts:233-237` `csrfJson` requires header
  `x-chq-csrf: 1` UNLESS `c.var.auth?.viaBearer` is true (Bearer `chq_`
  token clients exempted per DEC-027, since they can't be
  cross-site-forged); `csrfForm` (lines 241-254) enforces the
  double-submit `chq_csrf` cookie-vs-hidden-field match for HTML form
  posts. Every mutating route in the four sub-apps above passes
  `csrfJson` after its authz middleware (confirmed via grep — every
  `.post/.put/.patch/.delete` call site includes `csrfJson` or
  `csrfForm` in its handler chain).
- Rate limits: `src/routes/auth.tsx:25-27,113-127,180-189` enforces
  `AUTH_RATE_LIMIT_MAX=20` per `AUTH_RATE_LIMIT_WINDOW_SECONDS=900` on
  both `/login` and `/claim`, returning 429 with a generic message on
  exceedance.
- Secrets-free config: `wrangler.jsonc` declares only local D1
  (`database_id: "local"`), local R2, local KV, and `vars: {DEV_MODE:
  "1"}` — no API key/secret binding anywhere in the file; `grep -rn
  "process.env\|API_KEY\|SECRET" src/ wrangler.jsonc` (excluding tests)
  returns zero hits.

*§9 invariants:*
- Fail loudly: `ApiError` (src/server/http.ts:26-37) is the sole error
  vocabulary; no `catch` blocks swallowing errors were found in the
  four DEC-130..133-touched files or the route files scanned above.
- Status changes never auto-email: `src/server/repo/submissions/
  status.ts` has no mail-related import (grep for `^import` lines
  matching `mail` returns zero hits in this file, matching its own
  file-header comment asserting the same, and matching the
  `test/api-submissions.test.ts` source-scan test referenced in its
  header). Files that DO import `makeMailer`/`mail/render`
  (`tasks.ts`, `review.ts`, `comms.ts`) do so for explicit
  reminder/compose-send actions, not automatic status-change side
  effects.
- Error envelope: `errorEnvelope` (src/server/http.ts:39-41) returns
  exactly `{error: {code, message, fields?}}`.
- List envelope: every list endpoint checked returns `{items, total,
  page, perPage}` — e.g. `src/routes/api/email-log.ts:48`,
  `src/routes/review.ts:380,441,471`, `src/routes/comms.ts:61`,
  `src/routes/api/contacts.ts:129,288` — all match the shape exactly
  (single-page endpoints synthesize `page:1`/`perPage:
  items.length||1`, which is the documented convention, not a
  deviation).
- Append-only migrations: `migrations/*.sql` through `0009_review_
  rounds.sql` — `grep -n "DROP" migrations/*.sql` returns zero hits;
  no migration file removes a column or table.
- Pure-core import discipline (DEC-002): `grep -rln 'from "node:\|
  cloudflare:' src/{auth,domain,forms,mail,lib}` returns zero hits —
  none of the five pure-core directories imports node:/cloudflare
  anything.

No new SPEC §8/§9 drift found anywhere in this run.

**STEP 4 — wave-18-file regression audit (already folded into STEP 2's
per-file evidence above; summarized here per the task's explicit ask):**
`schedule.ts` — greedy first-fit ordering (duration desc, then track)
and all four exported signatures (`findConflicts`, `scheduleSummary`,
`autoSchedule`, `buildIcsEvent` n/a — that's ics.ts) are unchanged from
the DEC-010 doc comment; `ics.ts` — `\r` appears only in `\r\n`
line-join/fold separators (lines 72, 132) and the filename-sanitizer's
strip pattern (line 106), never emitted raw inside a field value;
`submit.tsx` — confirmed zero-trace hidden-field handling (STEP 2);
`status.ts` — guard is atomic (missing-id check precedes both mutation
loops; nothing in the chunk-read/select phase mutates state) and
`{updated: rows.length}` is truthful since `rows` only contains ids
that passed the `missing.length > 0` all-or-nothing guard, so a
successful return always reflects exactly the mutated count.

STEP 5 — no gap found in preflight, static audit, or regression audit.

RESULT: PASS
