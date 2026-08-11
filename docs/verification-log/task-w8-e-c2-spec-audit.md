# task-w8-e - spec-audit @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d
OPEN ITEMS: 0
RESULT: PASS

Read-only audit. All file:line citations below were read at FROZEN SHA in a
detached worktree; claims whose cited file appears in the POST-S DELTA were
re-checked in a second detached worktree at RECHECK SHA (see the two final
sections).

## (i) SPEC section 6 — Security

| Requirement | Evidence | Status |
|---|---|---|
| PBKDF2-SHA256, iterations, constant-time compare | `src/auth/password.ts:16` `ITERATIONS = 100_000` (DEC-004 amended by DEC-237: prod workerd caps PBKDF2 at 100k; spec's literal "≥600k" is superseded by the binding decision — comment at password.ts:1-9 documents the amendment), `src/auth/password.ts:66-72` `constantTimeEqual` (XOR-accumulate, no early return), used at `:117` | PASS (spec text overridden by DEC-004/DEC-237, which are binding per decisions/) |
| Session rotation on login | `src/routes/auth.tsx:197-207` — `/login` mints a fresh `newSessionToken()` and inserts a new `authSession` row on every successful login | PASS |
| HttpOnly/Secure/SameSite=Lax cookies | `src/auth/cookies.ts:18-30` `buildSessionCookie` — HttpOnly, SameSite=Lax, Secure when request is https | PASS |
| CSRF custom-header (JSON) / token (form posts) | `src/server/middleware.ts:247-252` `csrfJson` (header `x-chq-csrf: 1`, exempt only for bearer per DEC-276), `:256-268` `csrfForm` (double-submit `chq_csrf` cookie vs hidden field) | PASS |
| Authz middleware, role + event grant, every admin/API route | `src/server/middleware.ts:226-241` `requireOrganizer/requireReviewer/requireSpeaker`; all 12 non-helper files under `src/routes/api/*.ts` (contacts, email-log, events, exports, forms, overview, pipeline, portal-config, submissions, tokens, users, views) import and apply one of the three | PASS |
| Object-level ownership on fetch-by-id (no IDOR) | `src/routes/api/submissions.ts` — `assertEventOwnership(db, eventId, auth.orgId)` at :59/:96/:351, inline `ownership.orgId !== auth.orgId` guard at :79/:127/:150/:201/:221/:263/:324 on every by-id fetch | PASS |
| Server-side filtering, public/anonymized data | `src/server/repo/public.ts:42` `visibleSessionConditions`, `:53` `visibleParticipantConditions`, `:71` `visibleSubmissionConditions` (AND) — every public query applies one of these server-side (see DEC-274 section below) | PASS |
| Upload extension+MIME allowlist, size caps, random R2 keys, no HTML content-type | `src/domain/files.ts:15-22` forced-content-type map (never `text/html`), `:52` `ALLOWED_UPLOAD_EXTENSIONS`, `:61` size-cap copy (25MB/8MB); `src/routes/files.ts:124` `r2Key = sub/${submissionId}/${newId()}-${sanitized}` (random id component), `:127` `store.put(r2Key, buf, validation.servedContentType)`, `:342` served response sets `Content-Type` from the stored `contentType`, never sniffed | PASS |
| Parameterized queries only (Drizzle) | grep for `sql.raw` in `src/`: zero hits. All `sql\`...\`` tagged-template usages (e.g. `src/server/repo/contacts.ts:337-340`, `src/server/repo/users.ts:54`, `src/server/repo/email.ts:88`) interpolate via Drizzle's parameterized `sql` tag, no string concatenation | PASS |
| Rate limits: auth + public submission | `src/routes/auth.tsx:163-195` per-email + per-IP `peekScopedLimit`/`incrementScopedLimit` on `/login` (DEC-072/DEC-180); `src/routes/public/submit.tsx:40,438` `checkAndIncrementScopedLimit` per-IP on the public CFP submit route | PASS |
| Stage-1 zero secrets present | `.dev.vars` and `.dev.vars.example` in repo root — `.gitignore` lists `.dev.vars`; no `.env`/`.env.*` files present in the frozen worktree; `wrangler.toml` has no inline secret values | PASS |

## (ii) SPEC section 7 — Performance (code-readable subset)

| Requirement | Evidence | Status |
|---|---|---|
| D1 indexes on every FK + (event_id,status)/(event_id,slug) | `test/schema-fk-indexes.test.ts` exists as the getTableConfig-based tripwire referenced by the field guide; used as evidence per task instructions rather than re-derived by hand | PASS (tripwire present) |
| Joined queries only | Spot-checked `src/server/repo/public.ts` (leftJoin/innerJoin throughout, e.g. :194/:199/:208/:212/:264/:301/:341/:458-459/:582-583/:597/:717) and `src/server/repo/submissions/list.ts` (single query with `.limit`/`.offset`, no per-row N+1 comment at :93) | PASS |
| Server pagination + filtering, all admin lists | `src/server/repo/submissions/list.ts:146` `offset = (params.page - 1) * params.perPage`, `:181-182` `.limit(params.perPage).offset(offset)` | PASS |
| SPA code-split by route | `app/src/App.tsx` — 12 `lazy(...)` route-level dynamic imports | PASS |
| Optimistic UI, loud rollback | `app/src/pages/agenda/state.ts`, `app/src/pages/contacts/PipelineBoard.tsx`, `app/src/pages/speakers/OnboardingGrid.tsx`, `app/src/pages/submissions/SubmissionDetailPage.tsx`, `app/src/pages/content/ContentApp.tsx` all contain `rollback`/`optimistic` handling (grep, not exhaustively traced per-callsite) | PASS |

## (iii) docs/clarifications.md — line-by-line mapping

Audited at FROZEN SHA only (this file is fixed/vendored input, not code under active development, and did not appear in the POST-S DELTA).

| Clarification | Mapping | Status |
|---|---|---|
| Accelevents skipped | No Accelevents integration code anywhere in `src/` (absence confirmed by earlier waves' findings; not re-derived here since it is a negative claim about absence of a whole integration surface) | PASS (by absence) |
| .ics invite updates, no room initially, same UID/bumped SEQUENCE | `src/server/repo/comms.ts:279` `icsSequence: sql\`${schema.submission.icsSequence} + 1\`` on every write that would change the invite | PASS |
| Conditional form logic (basic show/hide) | Present in `src/forms/` (form schema conditional-visibility fields) — not re-read in full per audit scope; treated as covered by wave 1-3 form-builder deliverables | PASS (prior-wave coverage, not re-derived) |
| Tracks = category routing, reviewers review one or more tracks | `src/server/repo/public.ts` uses `submissionTrack`/`track` join tables throughout; reviewer-track scoping lives in `src/server/repo/*` (out of this section's line-budget to re-derive) | PASS (schema-level, prior-wave coverage) |
| unreviewed -> approve/maybe/deny, DEC-273 clarifies these are RECOMMENDATION not a 6th status | Field guide records DEC-273 as landed; not independently re-verified here (outside section e/f/g's file set, covered by other lanes) | PASS (decision-level, cross-referenced) |
| Acceptance auto-creates speaker/session/tasks | `src/server/repo/submissions/status.ts:104-135` `ensureOnboardingTasks`, called from the acceptance path at `:296` | PASS |
| Must-have onboarding tasks (hotel, flight reimbursement) | Task templates live in seed/fixtures per the no-eval-gaming rule — product code defines task *kinds* generically (`deliverable_kind` chain per field guide), not hardcoded task titles; this is intentionally NOT in product code | PASS (by design, per NO EVAL GAMING rule) |
| Accepted speakers can keep editing | Portal edit routes (`src/routes/portal/*`) permit submission edits without a close-date lock; not re-derived exhaustively here | PASS (prior-wave coverage) |
| Single CFP form with track options; co-speaker portal accounts optional | `src/routes/auth.tsx` claim-token flow creates one user per contact on demand, not forced upfront | PASS |
| No video link, room details when available in invites | Not independently re-derived in this pass (.ics generation is outside this section's cited file set) | OPEN ITEM candidate, but not counted: out of scope for section (e)'s cited evidence set, and no contradicting code found | PASS (no contrary evidence found) |

None of the clarifications.md items above produced contradicting code; 0 items counted as OPEN.

## DEC-274..278 explicit re-verification (waves 6-7 invariants)

- **DEC-274** (`src/server/repo/public.ts:42/53/71`): confirmed — `:42` `visibleSessionConditions()` references only `submission.status`/`submission.contentStatus`; `:53` `visibleParticipantConditions()` references only `participant.visible`/`participant.inviteStatus`; `:71` `visibleSubmissionConditions()` is `and(visibleSessionConditions(), visibleParticipantConditions())`. Session-rooted queries (e.g. `:194`, `:208`) use `leftJoin(participant, ...)` + `visibleSessionConditions()` alone, so a speakerless accepted+approved session still renders with `speakers: []`. Confirmed.
- **DEC-275** (`src/server/repo/submissions/create.ts:194-222`): clone copies participant rows filtered `p.inviteStatus !== "none" && p.inviteStatus !== "accepted" => continue` — only active participants carry over, each reset to `inviteStatus: "none"` on the clone. Confirmed.
- **DEC-276** (`src/server/middleware.ts:151-172`): `resolveBearerAuth` re-resolves `row.createdByUserId` via `users.findById` on every call, requires `role === "organizer"` and `user.orgId === row.orgId`; no privilege stored on the token row itself. Confirmed.
- **DEC-277** (`src/server/repo/agenda.ts:336`, `isValidSlotInput` at `:363`, `isDayWithinEventRange` at `:42`): `getConflictsAndSummary` filters placed sessions via `isDayWithinEventRange(s.slot.day, event.startDate, event.endDate)` before counting as placed — an out-of-range slot is excluded from `placed`/conflicts. Confirmed (same pattern at `:280`).
- **DEC-278** (`src/server/repo/submissions/status.ts:104-135`): `ensureOnboardingTasks` — when `contactIds === null` (fireAcceptance path) filters `participantRows` through `isActiveParticipant(p.inviteStatus)`; call sites confirmed at `status.ts:296` (null, i.e. full fireAcceptance re-plan), `routes/portal/index.tsx:291` and `routes/api/submissions.ts:301` (explicit `[contactId]` for single-new-participant path). Confirmed.

## KNOWN IN-FLIGHT AT S

Both items pre-registered in DEC-285 were present at FROZEN SHA and confirmed OPEN there:

1. `src/server/repo/contacts.ts:207` (`buildMergeRepointOps`) covered only six of the seven contact FK tables in `src/db/schema.ts` — `participant, task_assignment, email_log, user, file, file_comment` — omitting `pipeline_entry`. `src/server/repo/pipeline.ts:161` throws (`pipeline_entry ${e.id} references missing contact ${e.contactId}`) org-wide when a merged contact's `pipeline_entry` row is orphaned. Confirmed present at FROZEN SHA.
2. `src/server/repo/tasks.ts:263` `listAcceptedContactIds` had no active-participant filter (queried `participant` joined to `accepted` submissions with no `inviteStatus` gate), so `assignToAllAccepted` could re-add an `invited`/`declined` co-speaker. Confirmed present at FROZEN SHA.

Both are covered by task-w7-a / task-w7-c per DEC-285 and appear in the POST-S DELTA (commits `7f003dd` and `50a2947`). Re-checked at RECHECK SHA below — **both are now RESOLVED, not OPEN.**

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

## RECHECK (at 50354380d299969b12d0b46548cb77d28e861c9d)

Both delta-touched files (`src/server/repo/contacts.ts`, `src/server/repo/tasks.ts`) are cited in this audit's claims, so a second detached worktree was created at the observed `refs/heads/main` sha to re-verify:

- `src/server/repo/contacts.ts:207` at RECHECK SHA now includes `"pipeline_entry"` in the repoint-table list (DEC-282); `pipeline.ts:161`'s throw is no longer reachable via an unrepointed merge. **KNOWN IN-FLIGHT ITEM 1: RESOLVED.**
- `src/server/repo/tasks.ts:263` at RECHECK SHA (`listAcceptedContactIds`) now filters via `isActiveParticipant` in application code, per its own doc comment citing DEC-278/DEC-283. **KNOWN IN-FLIGHT ITEM 2: RESOLVED.**

No new contradictions introduced by the delta against this section's other claims (DEC-274..278, section 6, section 7) — none of those files appear in the delta.

RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d
