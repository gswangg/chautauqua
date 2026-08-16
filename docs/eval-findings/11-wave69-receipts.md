# Wave 69 mandate-hygiene receipts

New file, per DEC-358's wave-68 amendment pattern ("verification that stays in
a planner's head is verification the next wave pays for again ... written
into its own receipts file, a new file, not the shared open lists, so it
cannot collide with the [prior wave's] hygiene lane already editing them").
This file is `11-wave69-receipts.md` specifically so it cannot collide with
`task-w68-e`'s `10-wave68-receipts.md` or with `docs/eval-findings.md` itself.

DOCS-ONLY lane of a code wave (DEC-069): no gate ran, no
`docs/verification-log/index/` section is filed for this lane. Every
citation below was re-derived at THIS lane's own runtime against main tip
`5305cc7c` ("scribe wave 69") — do not copy these line numbers forward
without re-checking them; the merge train moves under every wave.

## Verdicts

### (1) Interim-run item 2 — auto-schedule un-flagged speaker double-bookings via invite-status exclusion

CLOSED-WITH-RECEIPT. The root-cause hypothesis (conflict counting excludes
participants by invite status) is closed: `src/server/repo/agenda/rows.ts:205-216`
and `src/server/repo/agenda/payload.ts:275-280` both scope their participant
join to `inArray(schema.participant.inviteStatus, [...SCHEDULING_PARTICIPANT_STATUSES])`
(DEC-974 — `'none'/'invited'/'accepted'`, not `ACTIVE_INVITE_STATUSES` and not
`participant.visible`), so a CSV-batch not-invited speaker IS visible to
clash detection. The still-open candidate cause is a DIFFERENT kind of
conflict entirely: `break_overlap` (DEC-557's wave-71 amendment) is built in
the SPA (`app/src/pages/agenda/types.ts:38-46`, `ConflictChip.tsx:21-66`,
`app/src/pages/agenda/PhoneAgenda.tsx:53`) and absent from `src/` — confirmed
again this wave, `grep -rn breakId src/` still returns nothing. That gap is
owned by `task-w69-a` (see branch census below), not by this item.

### (2) Interim item 5 — embed accent not applied

CLOSED-WITH-RECEIPT. `src/routes/public/saved-embed.tsx:143` passes
`accentOverride={parseAccent(opts.accent ?? "") ?? undefined}` into
`EmbedShell`; `EmbedShell` (`src/routes/public/shell.tsx:275-277`) resolves
`const accent = validAccent(props.accentOverride ?? b.accentColor);` — the
override reaches the rendered accent.

### (3) GATE-11 small #3 — API-tokens row missing from the Your-data EDIT view

CLOSED-WITH-RECEIPT. `app/src/pages/settings/YourDataPanel.tsx:198` renders
the summary row's value as `<ApiTokensPanel readOnly />`; the edit branch at
`:224` renders the full `<ApiTokensPanel />` (create/revoke flow included).
Both branches present the row.

### (4) P3 #21 — speakers dashboard per-task filter narrows nothing

CLOSED-WITH-RECEIPT. `app/src/pages/speakers/OnboardingGrid.tsx:423`
computes `visibleTasks = filters.taskId ? grid?.tasks.filter((t) => t.id ===
filters.taskId) ?? [] : grid?.tasks ?? []`, and the header at `:867` renders
`visibleTasks.map((task) => ...)` — selecting a task facet does collapse the
rendered columns to that one task (the in-code comment at `:416-424`
correctly documents that only the columns collapse; `grid.tasks` itself and
the task picker stay unfiltered by design).

### (5) P3 #22 / interim item 9 — history entries minute-granular

CLOSED-WITH-RECEIPT. `app/src/pages/submissions/SubmissionDetailPage.tsx:1809`
renders `{formatDateTimeWithSeconds(entry.at)}` for each history entry
(imported from `../../lib/dates` at `:7`) — seconds-precision, not
minute-granular.

### (6) P3 #15 — deadline day-boundary wording

CLOSED-WITH-RECEIPT, timezone-aware. `src/routes/root.tsx:130-139`
`closesLine()` builds `` `CLOSES ${label} · ${days} DAY(S) LEFT` `` from
`formatEventCloseDateLabel` (`src/lib/event-time.ts`, DEC-918: one
server-side calendar-day grammar) and `daysUntilCalendarDay` (`event-time.ts:223`),
both computed in the event's own IANA timezone per DEC-408 (never UTC-bare).

### (7) GATE-10 reopen #6 — portal co-presenter inputs at intrinsic 188px

CLOSED-WITH-RECEIPT. `src/routes/portal/edit.tsx:343` (`<input id="cp-email"
class="chq-input" ...>`) and its sibling text/select inputs on the same form
all carry `class="chq-input"`, the same sized-input class used elsewhere in
the portal — none render at raw intrinsic width.

### (8-11) Four review-lens items closed in source before wave 69 started

All four re-confirmed CLOSED-WITH-RECEIPT at this lane's runtime:

- `listDeliverableCandidates` status filter — `src/server/repo/portal/tasks.ts:207`
  scopes to `eq(schema.submission.status, "accepted")` (owned by task-w66-g).
- `requestIpFromHeaders` property statement — `src/lib/rate-limit.ts:43-72`'s
  doc comment states the exact three-branch behavior and its non-shared-bucket
  caveat for branch 2, matching the function body at `:73-78+` (owned by
  task-w67-g).
- Auth-claim insert-then-consume — `src/routes/auth-claim.tsx:119-157`: the
  `db.insert(schema.user...)` runs first (with a unique-violation catch that
  redirects to `/login` without consuming the token), then
  `consumeClaimToken(kv, token)` runs only after the insert has won (owned by
  task-w66-h).
- send.ts mint-after-templateId-400 ordering — `src/routes/comms/send.ts:142-177`:
  the `templateId` 400 validation block precedes the DEC-397 portal-link
  minting block, so a bad templateId 400s before anything is minted.
  Additionally re-confirmed this wave: the content-note config hoist
  (`src/routes/content-notes.ts:97-105` resolves `origin` via
  `resolveBaseUrl(c)` before the first durable write, DEC-547) and
  `readSortToken` throwing on an unrecognized token
  (`src/server/repo/submissions/query.ts:133-136`, DEC-843).

## (12) Standing fact for future perf lanes

`db.batch(` is used NOWHERE in `src/` as of main `5305cc7c` — the only hit
for the literal is the comment documenting the fact itself,
`src/server/repo/submissions/status.ts:499`. `task-w68-a` (`088eef82`,
already landed on main via `merge task-w68-a`) collapsed `PATCH
/submissions/:id`'s write phase from 7 sequential round trips to 2, still
without `db.batch(` — it did not amend DEC-155's constraint against
parallelizing two writes, it just removed five of the round trips. A future
perf lane proposing `db.batch(` should re-read DEC-155 and
`status.ts:495-502`'s idempotence argument before treating an unbatched pair
of writes as an oversight.

## Wave-69 branch census (re-derived at this lane's own runtime, main `5305cc7c`)

- `task-w69-a` — worktree at `5305cc7c`, no commits yet at this reading (in
  flight). Per the injected field guide, scoped to DEC-557's break_overlap
  gap (server-side kind + emission), still open per item (1) above.
- `task-w69-b` — `73f35f84` "Unify UnplacedReason vocabulary: one label
  renderer for all seven members" (closes DEC-615 — the 4-of-7-member SPA
  mirror). Landed on the branch, not yet merged to main as of this reading.
- `task-w69-c` — worktree at `5305cc7c`, no commits yet at this reading (in
  flight). Not independently confirmed this wave; field-guide context
  suggests DEC-856's `TracksRoomsPanel` stale-error-banner gap as the likely
  scope, but that is UNCONFIRMED — do not treat as closed or as this
  branch's committed scope until it lands a commit.
- `task-w69-d` — `3dda1761` "DEC-945 (amendment, wave 69): role-blocked
  /admin bounce says why" (`src/routes/portal/index.tsx`, `src/routes/root.tsx`,
  plus new test `test/portal-admin-bounce-notice.test.ts`). Landed on the
  branch, not yet merged to main as of this reading.
- `task-w69-e` — worktree at `5305cc7c`, no commits yet at this reading (in
  flight). Not independently confirmed this wave; field-guide context
  suggests DEC-919's off-screen public-search-submit gap as the likely
  scope, but that is UNCONFIRMED for the same reason as `task-w69-c`.
- `task-w69-f` (this lane) — mandate hygiene: file wave 69's closures with
  receipts in this new file, record branch ownership, append the DEC-358
  amendment. Docs-only, no source or test touched.

## OFF-LIMITS wave-68 scopes, by branch (do not re-file in wave 70+)

All five already merged into main (`a53f0008`, `25236fd0`, `ba9d50f9`,
`54a61a57`/wt-named `task-w68-b-savechanges`, and `2b5e8851` via
`merge task-w68-e`):

- `task-w68-a` (`088eef82`) — `PATCH /submissions/:id` write-phase collapse,
  7 round trips down to 2 (DEC-155 w68).
- `task-w68-b-savechanges` (`d8d98ff1`) — settings edit footer: one "Save
  changes" grammar (DEC-896).
- `task-w68-c` (`ec421da8`) — every destructive `ConfirmDialog` primary
  names its object (DEC-941 w68).
- `task-w68-d` (`202a6687`) — one vocabulary for submission sort orders
  (DEC-613, wave-68 amendment).
- `task-w68-e` (`2b5e8851`) — wave-68 mandate-hygiene receipts,
  `docs/eval-findings/10-wave68-receipts.md`.
