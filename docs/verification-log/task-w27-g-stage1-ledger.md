# task-w27-g: closing stage-1 ledger (DEC-496/DEC-507)

Read-only ledger. No server started, no product or test file touched.

**FROZEN LITERAL**: `aef16163a0fac3a1a43f9cc6369e800242d4ff23` ("merge
task-w27-c"), the HEAD of the `task-w27-g` worktree at the moment this ledger
was written. `git log --oneline -20` at this sha:

```
aef1616 merge task-w27-c
8ed042b docs(verification-log): stage-1 build+test+bundle evidence lane (DEC-507, task-w27-c)
2950e40 scribe wave 27
5ef2486 merge task-w26-f
1ca9d6f merge task-w26-c
867f058 merge task-w26-d
db97baa merge task-w26-e
4342353 merge task-w25-f
30de7a1 DEC-504: fix README alternate-port quickstart to include predev
ac96388 DEC-501: delete stale answers for portal-edit-hidden fields
3e2afa9 DEC-502: window the JSON embed feed to one page, not the cumulative prefix
667d603 merge task-w26-b
11c127b DEC-503: fix phone-sweep manifest parity for embed/schedule + embed/gallery
101c8d9 docs(verification-log): stage-1 completion ledger (DEC-496, task-w25-f)
ecd4b39 Fix DEC-500: PATCH options bricking dropdown fields
5fa693a merge task-w26-a
8780b29 DEC-499: strip all CTL chars from ICS CN, not just DQUOTE
95a79fc scribe wave 26
e5f41c6 merge task-w25-c
6fa5eb8 merge task-w25-b
```

Important note on tree drift: the *shared* `main` branch had already moved
**past** this frozen sha by the time this ledger was drafted — a concurrent
lane (`task-w27-a`, tip `e2505d2`) landed DEC-505 and was merged into `main`
(`8f6a7ed`, then `a42b591` merging `task-w27-e`) while this worktree was still
building. `git rev-parse HEAD` inside `task-w27-g` stayed pinned at
`aef1616163a0fac3a1a43f9cc6369e800242d4ff23` throughout (confirmed by a
second `git rev-parse HEAD` after the DEC-505 discovery below), so every grade
in this ledger is against that literal, not against whatever `main` has
since accreted. This is itself the "a branch is not a landing" lesson
(field-guide w21-24): DEC-505 is real, committed, and even already merged to
`main` — but not an ancestor of *this* ledger's frozen sha, so it is graded
PENDING-OWNED below, not PASS.

## Step 2 — DEC-499..506 grades (file:line at `aef1616`)

### DEC-499 — CN sanitization — **PASS**

`src/mail/ics.ts:110-112`:
```
function sanitizeCn(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/["\x00-\x1f\x7f]/g, "");
}
```
Strips DQUOTE (`"`) and every C0/DEL control character (`\x00-\x1f`, `\x7f`),
matching the iCalendar PARAM-VALUE grammar (any char except CTL/DQUOTE).
Two call sites, both quoted CN params: `src/mail/ics.ts:130`
(`ORGANIZER;CN="${sanitizeCn(opts.organizer.name)}"`) and `src/mail/ics.ts:134`
(`ATTENDEE;CN="${sanitizeCn(attendee.name ?? attendee.email)}"`, the one that
originates in unauthenticated public CFP text per the comment at
`src/mail/ics.ts:100-109`).

### DEC-500 — effective-kind options validation — **PASS**

`src/forms/builder.ts:110-113`:
```
const effectiveKind: FormFieldKind | undefined =
  typeof input.kind === "string" && FIELD_KINDS.includes(input.kind as FormFieldKind)
    ? (input.kind as FormFieldKind)
    : existing?.kind;
```
used at `src/forms/builder.ts:115` (`if (effectiveKind === "dropdown")`) to
gate the dropdown-options-required rule instead of the raw (possibly absent)
`input.kind`. `src/routes/api/forms.ts:203`
(`validateFieldDefInput(body, siblingDefs, { id: fieldId, kind: field.kind })`)
passes the field's **stored** kind as `existing` on PATCH, so `{"options":
[]}` on a PATCH that never sends `kind` is validated against the field's
real, persisted kind — not silently treated as non-dropdown.

### DEC-501 — hidden-field answers deleted on portal edit — **PASS**

`src/forms/validate.ts:34,50-52,137` accumulates `hiddenFieldIds` for every
field a `visible_if` rule currently hides and returns it alongside `cleaned`
(`{ ok: true, cleaned, hiddenFieldIds }`). `src/routes/portal/edit.tsx:243-284`
calls `validateAnswers(...)` and forwards `validation.hiddenFieldIds` (the
same computed set, not a re-derivation) into the repo write.
`src/server/repo/portal-edit.ts:303-319` deletes `submission_answer` rows for
those ids (excluding locked built-ins per `lockedFieldName(fieldId) === null`
at line 310), documented at lines 303-309 as closing the gap where a rule
change (e.g. format Workshop -> Talk hiding `workshop_length`) would
otherwise leave a stale answer visible in organizer detail/exports.

### DEC-502 — one page window per JSON feed — **PASS**

`src/server/repo/public/bounds.ts:27-31` (`boundedRowLimit`) returns a
**cumulative** LIMIT (`Math.min(page * perPage, MAX_PUBLIC_ROWS)`), consumed
by both `src/server/repo/public/sessions.ts:326` and
`src/server/repo/public/speakers.ts:68` — this is deliberate (it backs the
HTML "show more" cumulative list) and is windowed down to a single page at
the JSON-feed call site: `src/routes/public/index.tsx:285-287` (sessions:
`const start = (page - 1) * perPage; const windowed = (items as
unknown[]).slice(start, start + perPage);`) and `:296-298` (speakers, same
slice). `src/routes/public/feeds.ts:12-21` documents and types the resulting
contract (`items.length <= perPage`, `total` always the full unwindowed
count), consumed at `src/routes/public/index.tsx:175`
(`c.json(buildSurfaceFeed(event, surfaceParam, paged, new Date()))`).

### DEC-503 — phone manifest enumerated over SURFACES — **PASS**

`test/render-sweep-manifest-parity.test.ts:12-14` imports `SURFACES` from
`src/routes/public/shell.tsx` (not a hand-listed literal) and asserts every
entry has a `/e/<slug>/<surface>` and `/embed/<slug>/<surface>` row in both
`app/src/routeManifest.ts`'s `ROUTE_MANIFEST` and
`scripts/render-sweep.ts`'s `MOBILE_ROUTE_MANIFEST` (lines 25-59), plus a
count-based sanity assertion (lines 61-86). Ran fresh at this sha:
```
npx vitest run test/render-sweep-manifest-parity.test.ts
...
[DEC-503] SURFACES=5 ROUTE_MANIFEST(/e)=5 ROUTE_MANIFEST(/embed)=5 MOBILE_ROUTE_MANIFEST(/e)=5 MOBILE_ROUTE_MANIFEST(/embed)=5
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### DEC-504 — README alternate-port procedure — **PASS**

`README.md:66-76`: "If you need to run on a non-default port ... run `npm run
predev` yourself first and pass `--var` on the `wrangler dev` invocation --
do **not** invoke `npx wrangler dev` directly, since that skips the `predev`
hook that both builds the admin SPA bundle (`/admin` 500s without it) and
creates `.dev.vars` from `.dev.vars.example` (`DEV_MODE` stays unset without
it, so `/dev/mailbox` 404s -- DEC-005/DEC-183)" followed by the fenced
`npm run predev` + `npx wrangler dev --port 8801 --var
PUBLIC_BASE_URL:http://localhost:8801` example at lines 74-76.

### DEC-505 — field kind/section patchable — **PENDING-OWNED(task-w27-a)**

At `aef1616`, `src/server/repo/forms.ts:277-283`'s `FieldPatch` interface
carries only `label`/`helpText`/`required`/`options`/`rule` — no `kind`, no
`section` — and `patchField` (lines 285-300) never touches
`schema.formField.kind` or `.section`. `src/routes/api/forms.ts:203`'s PATCH
handler still constructs `validateFieldDefInput`'s `existing` from the
stored `field.kind` alone, consistent with builder.ts's own comment at that
sha ("PATCH never sends `kind`" — `src/forms/builder.ts:88`, pre-DEC-505
wording).

The fix exists, committed, as `e2505d2` ("DEC-505: patch a form field's kind
and section, refuse orphaning changes") — but:
```
$ git merge-base --is-ancestor e2505d2 HEAD; echo "exit=$?"
exit=1
```
`e2505d2` is not an ancestor of `aef1616`. It is the tip of branch
`task-w27-a` (`git branch --all --contains e2505d2` -> `task-w27-a`), which
this ledger's worktree branched from `main` **before** `task-w27-a` was
merged (main's ref moved to `8f6a7ed` = "merge task-w27-a" only after this
worktree's `git worktree add` ran). Owning branch: `task-w27-a`.

### DEC-506 — one `likeContains` + `ESCAPE` at every call site — **FAIL-unowned**

Two separate `likeContains` implementations still exist at `aef1616`, not one
shared home (`src/server/repo/like.ts` does not exist —
`find src -iname "like.ts"` returns nothing):
- `src/server/repo/contacts/query.ts:47-50` — escapes `\`, `%`, `_`, lowercases,
  documents (lines 41-46) that callers must pair it with `LIKE ${like} ESCAPE
  '\\'`.
- `src/server/repo/submissions/query.ts:78-82` (`export function
  likeContains`) — a second, independent copy.

Consumers of one or the other (correctly escaped + `ESCAPE '\\'` paired):
`src/server/repo/contacts/crud.ts:159-167`, `src/server/repo/tasks/grid.ts:131`,
`src/server/repo/submissions/list.ts:81`, `src/server/repo/files-library.ts:118`.

But two call sites build a raw, **unescaped** `%${q}%` pattern directly and
call `LIKE` with **no** `ESCAPE` clause at all — neither uses `likeContains`:
- `src/server/repo/public/speakers.ts:51-58` — the **unauthenticated public
  speaker-search** surface (`getPublicSpeakers`, `opts.q`): `const pattern =
  \`%${q}%\`;` then three bare `LIKE ${pattern} ... COLLATE NOCASE` clauses
  (lines 54-56). A literal `%` or `_` in `?q=` widens the match instead of
  being treated as a literal character, on a route that requires no
  authentication.
- `src/server/repo/email.ts:85-89` (admin-authenticated `listEmailLog`
  search) — same raw-`%${...}%`-no-`ESCAPE` pattern.

No commit on any reachable branch touches `likeContains`, `like.ts`, or
either of these two call sites for a DEC-506 fix:
```
$ git log --oneline --all | grep -iE "DEC-506|likeContains"
(no output)
```
and every open task-w27-* branch (`task-w27-a/b/d/e/f`) is either identical
to `main` at branch-point or contains only its own already-graded commit
(`task-w27-a` = DEC-505 only, `task-w27-e` = DEC-503 evidence doc only).
Nothing owns DEC-506. Per instructions this is **FAIL-unowned** and is not
softened to PENDING; there is no branch to name.

## Step 3 — carried-forward open items from prior artifacts

Newest triage-closure: `docs/verification-log/task-w27-f-triage-closure.md`
(frozen at `f01459a`, one commit behind this ledger's `aef1616` by a
DEC-232-allow-listed docs-only diff — see that report's Step 1). Its OPEN
ITEMS section: "0 required for PASS" plus one advisory (stale-ref cleanup
deferred until wave-28 planner review) — not a product-code item, nothing to
carry.

Newest spec-audit: `docs/verification-log/task-w27-e-spec-audit.md` (also
frozen at `f01459a`). Its Disposition: "**OPEN ITEMS: 0** (5 stage-2 items
correctly deferred, not findings)." Nothing to carry.

One item from that spec-audit's own J12 section needs a correction, not a
strike (its cited source doesn't contradict it — my own fresh read at
`aef1616` does): it states "Airtable **NOT implemented** (`grep -rli airtable
src app` returns zero hits on the `f01459a` tree, DEC-061 confirms stage-2
deferral)." Re-running that grep fresh at `aef1616` (one commit later, no
allow-listed docs-only diff away from `f01459a`... but `src/decisions.ts` IS
part of that docs-only diff per the w27-f report, and it now contains
`DEC_190`/`DEC_435`/`DEC_450` text mentioning "Airtable") returns 4 hits:
`src/decisions.ts`, `src/server/scheduled.ts`, `src/server/env.ts`,
`src/sync/airtable.ts`. An Airtable sync module (`src/sync/airtable.ts`) now
exists, wired into the cron handler (`src/server/scheduled.ts:18-19`,
`runAirtableSync(env, makeDb(env))`). This is **not** a stage-1 violation:
`src/server/env.ts:22-25` and `src/sync/airtable.ts:99-108,122-124` gate it
behind optional `AIRTABLE_TOKEN`/`AIRTABLE_BASE_ID` Worker secrets — both
unset means the sync is a no-op (`if (!token || !baseId) return null; //
integration not configured — off, not an error`), and `DEC_435`/`DEC_450`
(`src/decisions.ts:441,456`) explicitly frame this as "code correctness is
stage-1 even though its wiring is stage-2." No external account, API key, or
deployment is required to build/run/test this tree. J12 verdict below
updates the citation accordingly; this is a correction to a stale grep
result in the carried artifact, not a defect.

No other open items found in either carried artifact requiring action here.

## Step 4 — SPEC.md J1-J12 enumeration (green/blocked, file/route citation)

Fresh existence/relocation check at `aef1616` (several source files the prior
`f01459a` spec-audit cited have since moved into split directories — same
"tree moves mid-plan" pattern the field guide flags; re-verified below, not
re-cited blind):

- **J1 — Launch a CFP in an afternoon** — GREEN. `src/routes/api/events.ts`
  (event create/branding), `src/routes/api/forms.ts` + `src/forms/builder.ts`
  (field types/required/conditional visibility), `src/lib/submit-core.ts`
  (`isFormClosed`), `src/routes/public/submit.tsx` (public link/draft
  resume).
- **J2 — Submit a talk without friction** — GREEN.
  `src/routes/public/submit.tsx:509-540` (confirmation email w/ claim link),
  `src/domain/edit-lock.ts` (edit-stays-open-after-acceptance override),
  DEC-227 checkbox-required fix live in `src/forms/validate.ts`.
- **J3 — Triage hundreds of submissions without drowning** — GREEN.
  `app/src/pages/submissions/SubmissionsTable.tsx`, `src/routes/api/views.ts`,
  `src/routes/api/submissions.ts`, bulk chunking at
  `app/src/pages/submissions/bulk.ts`.
- **J4 — Run committee review in waves** — GREEN. Route file relocated from
  the prior artifact's `src/routes/review.ts` citation to a split module,
  `src/routes/review/{index,plans,recusals,reviewer,shared}.ts` (confirmed
  present at this sha, `src/routes/review.ts` itself does not exist).
  DEC-211 at `src/routes/review/reviewer.ts:184` and
  `src/routes/review/recusals.ts:23`; DEC-212 at
  `src/domain/evaluation.ts:82`; DEC-213 at `src/routes/review/plans.ts:145`.
- **J5 — Decide and notify, deliberately** — GREEN. `src/routes/comms.ts`,
  `src/domain/compose.ts` — status-change endpoints
  (`src/routes/api/submissions.ts`) issue no mailer call; notify is a
  separate compose/preview/send action, matching the house invariant that
  status changes never auto-email.
- **J6 — Onboarding runs itself** — GREEN. `src/domain/acceptance.ts`
  (auto-create speaker/session/tasks), `src/domain/reminders.ts` +
  `wrangler.jsonc` cron trigger, DEC-214 kind-gates at
  `src/routes/tasks.ts:44,385`.
- **J7 — Speakers self-serve everything** — GREEN. `src/routes/portal/*`
  (branded portal, `requireSpeaker` gating), DEC-108 invite accept/decline.
- **J8 — Collect, review, and approve content** — GREEN. `src/routes/files.ts`,
  `src/domain/files.ts`, `src/server/repo/files.ts` (version chain via
  `previous_file_id`), content-status enum in `src/db/schema.ts`.
- **J9 — Build the agenda under constant change** — GREEN.
  `app/src/pages/agenda`, `src/routes/agenda.ts`, `src/domain/schedule.ts`
  (warn-never-block conflicts, auto-schedule).
- **J10 — Publish continuously to the website** — GREEN. Five public surfaces
  under `src/routes/public/` (now split: `src/server/repo/public/{sessions,
  speakers,agenda,detail,event,gates,bounds}.ts` + `src/routes/public/
  {index,dispatch,shell,feeds}.tsx`), `.ics` in `src/mail/ics.ts`. Server-side
  visibility enforced in SQL: `visibleSubmissionConditions()` at
  `src/server/repo/public/gates.ts:54` (relocated from the prior artifact's
  single-file `src/server/repo/public.ts` citation, which is now a directory).
- **J11 — Reuse the network next event** — GREEN. `src/domain/contacts.ts`,
  `src/server/repo/contacts.ts`, `src/routes/api/contacts/{index,crud,import,
  merge,segments,bulk-email,shared}.ts` (relocated from the prior artifact's
  single-file `src/routes/api/contacts.ts` citation, now a directory).
  Contact -> speaker -> public ladder never collapses (same DEC-108 gate as
  J10).
- **J12 — The data stays theirs** — GREEN. `src/routes/api/exports.ts`,
  `src/routes/api/tokens.ts` (REST bearer tokens). Airtable sync
  (`src/sync/airtable.ts`) exists but is stage-2 wiring behind optional
  secrets (see Step 3 correction above) — no secret required to build/run,
  DEC-450 confirms code-correctness-is-stage-1 framing.

**12/12 GREEN.**

## Step 5 — verdict

Of the 8 graded DEC items: 6 PASS (DEC-499, 500, 501, 502, 503, 504), 1
PENDING-OWNED, 1 FAIL-unowned.

**STAGE 1 IS NOT COMPLETE.** Two explicit numbered blockers, both scoped and
owned:

1. **DEC-505** (field kind/section PATCH) — code exists and is correct
   (`e2505d2`, branch `task-w27-a`, already merged into shared `main` at
   `8f6a7ed`/`a42b591` by the time this ledger was written) but is not an
   ancestor of this ledger's frozen sha `aef1616163a0fac3a1a43f9cc6369e800242d4ff23`.
   Owner: merge `task-w27-a` (or its equivalent state, already on `main`)
   into whatever tree becomes the stage-1 exit sha. No further code work
   needed — this is a merge-sequencing gap, not an implementation gap.
2. **DEC-506** (one `likeContains` + `ESCAPE '\\'` at every LIKE call site) —
   unowned, unimplemented on every branch reachable from `aef1616`. Two
   concrete defects remain: (a) `src/server/repo/public/speakers.ts:51-58`,
   the **unauthenticated public speaker search**, builds `%${q}%` with no
   escaping and no `ESCAPE` clause — a `%`/`_` in `?q=` is user-controlled
   wildcard injection on a route requiring no auth; (b)
   `src/server/repo/email.ts:85-89` (admin-authenticated email-log search)
   has the same defect at lower severity. Fix requires: one shared
   `likeContains` home (collapsing the `contacts/query.ts` and
   `submissions/query.ts` duplicates), and converting both raw-pattern call
   sites to use it with a paired `ESCAPE '\\'` clause. Owner: unassigned —
   needs a new task branch.
