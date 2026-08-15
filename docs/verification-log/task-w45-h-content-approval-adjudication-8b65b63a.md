# task-w45-h — J8/J10 content-approval adjudication @ 8b65b63a

FILE, NEVER FIX (DEC-069 w45): this lane touches nothing under `src/**`,
`app/src/**`, `migrations/**`, `package.json`, `docs/eval-findings.md`,
`scripts/exit-predicate.ts`, `scripts/assemble-verification-log.ts`. Every
finding below is read-only investigation against the checked-out tree,
adjudicated per DEC-358 (whole-population verdicts, no partial claims).

## Claim 1 — public read doors gate in SQL

Enumerated every door named in the task, plus its actual data source:

- `src/server/repo/public/sessions.ts:167` (list) / `:264` (paginated
  variant) — `visibleSessionConditions()` in `baseConditions`, plus
  `visibleParticipantConditions()` on every participant join (:178, :196,
  :221, :237, :275, :290, :304, :317).
- `src/server/repo/public/detail.ts:117` (`getPublicSpeakerDetail`, uses
  the AND'd `visibleSubmissionConditions()`), `:215`
  (`getPublicSessionDetail`, `visibleSessionConditions()`).
- `src/server/repo/public/speakers.ts:50` (`getPublicSpeakers`) —
  `visibleSubmissionConditions()` in the distinct-id query's WHERE.
  `src/routes/public/speakers.tsx` itself has no query — it is JSX render
  functions (`SpeakersContent`, `SpeakerGalleryContent`) that consume
  already-gated `PublicSpeakerWithSessions[]` passed in from callers
  (`src/routes/public/index.tsx:497`, `src/routes/public/dispatch.tsx:140,171`,
  both calling `getPublicSpeakers`).
- `src/server/repo/public/agenda.ts:56` (`getPublicAgenda`), `:206`
  (`getPublicAgendaByIds`), `:247` (a third internal call site) — all three
  put `visibleSessionConditions()` + `slotWithinEventRange(event)` in the
  `.where(...)`.
- `src/server/repo/public/counts.ts:42,59` — `sessionConditions` /
  `visibleSubmissionConditions()` composed into the aggregate query WHERE.
- `src/routes/public/saved-embed.tsx:52-90` — resolves the embed row, then
  either renders through `renderSurfaceContent` (`./dispatch`, the same
  pipeline `/embed/:eventSlug/:surface` uses — already gated) or issues a
  302 redirect to a feed twin (`/e/:eventSlug/:surface.json|.xml` or
  `/e/:eventSlug/agenda.ics`) — it never runs its own unfiltered query.
- `src/routes/public/index.tsx:365-398` (`schedule.ics`) and `:409-424`
  (`agenda.ics`) both call `getPublicAgenda`/`getPublicAgendaByIds`
  (gated, see above); `src/routes/public/feeds.ts` (`buildSurfaceFeed`,
  `agendaIcsEvents`, `projectCardFields`) is a pure mapper over rows
  already fetched under the gate — no `Db` import, no query.
- `src/routes/public/cards.tsx` — pure JSX template (`SessionCard`, etc.)
  consuming already-gated `PublicSession` values; no query, no `Db`
  import.

No door found doing a JS post-filter (e.g., fetch-then-`.filter()`) in
place of a SQL WHERE clause. Verdict: **NO DEFECT**.

## Claim 2 — version minting

`src/server/repo/files-versions.ts:477-511` (`insertFile`):

```
let versionNo = 1;
if (input.previousFileId) {
  const predRows = await db.select({ versionNo: schema.file.versionNo })
    .from(schema.file).where(eq(schema.file.id, input.previousFileId)).limit(1);
  ...
  versionNo = pred.versionNo + 1;
}
await db.insert(schema.file).values({ ..., versionNo, ... });
```

Two separate statements (SELECT then INSERT), the arithmetic done in JS
between them — textbook read-then-write. `src/db/schema/content.ts:47-80`
defines the `file` table's only indexes as plain (non-unique) btrees:
`file_submission_id_idx`, `file_previous_file_id_idx`,
`file_uploaded_by_contact_id_idx`, `file_task_assignment_id_idx`. There is
no `uniqueIndex` on `previous_file_id`, nor on any `(submission_id, kind,
version_no)` tuple, that would reject a second row claiming the same
version number in the same chain. Two concurrent re-uploads of the same
deliverable (both reading the same `previousFileId`'s `versionNo` before
either insert commits) can both compute and insert `versionNo = N`,
producing two sibling rows both claiming to be version N of the same
chain — silently corrupting the DEC-818 "version number is an identity"
invariant the module's own doc-comment (`files-versions.ts:470-476`)
asserts. Verdict: **CONFIRMED-DEFECT** — file at
`src/server/repo/files-versions.ts:477-511`; no compensating unique
index at `src/db/schema/content.ts:74-79`.

## Claim 3 — upload caps, one shared constant

Server: `src/domain/files.ts` `validateUpload` (~:113 onward) enforces
`sizeBytes > DOCUMENT_MAX_BYTES` (:206), `IMAGE_MAX_BYTES` (:218),
`TEXT_MAX_BYTES` (:230), `VIDEO_MAX_BYTES` (:251, recording tier),
`DOCUMENT_MAX_BYTES` again for the resource tier (:273); constants
declared once, :67-96. `HEADSHOT_MAX_BYTES` (:466) is declared as `=
IMAGE_MAX_BYTES` (DEC-020 wave-67 amendment closed the prior duplicated
8 MB literal). Server call sites: `src/routes/api/portal-config.ts:225`,
`src/routes/portal/tasks.tsx:406,557` (plus `src/routes/files.ts` per
DEC-020's base contract) all call `validateUpload`/`validateHeadshotUpload`
from this same module — no route hand-rolls its own size check.

Client: `allowedUploadExtensions()` (same file, :124) drives the `accept`
attribute at `src/views/form-render.tsx:124`,
`src/routes/portal/tasks/views.tsx:277,308`; `HEADSHOT_EXTENSIONS` (:471)
drives `src/routes/portal/profile.tsx:179`. Help/hint text
(`uploadHintText`/equivalent, :133-148, :483) interpolates the same
constants rather than hand-typing MB figures (DEC-020 wave-67 amendment's
scan already forbids a hand-typed `' MB'` literal outside a constant
declaration in this module).

One module, one set of constants, both sides of the wire read it.
Verdict: **NO DEFECT**.

## Claim 4 — DEC-020 reopen consequence

`decisions/DEC-020.md`, "Amendment (wave 43): the re-upload reopen is
DELIBERATE and is already disclosed at BOTH upload doors — the row closes
on an exercised check, not on further filing" directly adjudicates this
exact claim (a raw upload demoting a publicly-approved session to
`pending` with no organizer action) and rules:

> RULING: DELIBERATE and ADEQUATELY DISCLOSED; no product change. Content
> gating public visibility is the point of DEC-274's session gate, and the
> honest requirement this DEC's wave-58 amendment set — disclose at the
> point of upload rather than leaving it silent — is met at both doors.

Re-verified at this HEAD, unchanged from that ruling:
`src/server/repo/files-content-status.ts:105-117` (`reopenContentReview`)
is one idempotent set-based UPDATE returning `{ reopened: boolean }`, no
mailer import (DEC-009 upheld); `src/server/pubcache.ts:355-362,396-400`
classify both `/api/v1/submissions/:id/files` and
`/portal/tasks/:id/upload` PUBLIC_AFFECTING for exactly this write, so the
cache correctly busts rather than serving a stale "still public" page;
disclosure sites: organizer 201 payload
(`src/routes/files.ts:237,246-247`), speaker pre-upload notice
(`src/routes/portal/tasks/views.tsx:188-195`, with the `deliverableKind`
null negative control for plain handouts), speaker post-upload receipt
(`src/routes/portal/tasks.tsx:629-630`). Falsifying tests named in the
wave-43 amendment (`test/content-reopen-disclosure.test.ts`,
`test/content-reupload-reopens.test.ts`, `test/portal-tasks.test.ts`) all
pass at this HEAD (see targeted run below). The demotion itself is the
intended behavior of DEC-274's session gate (SPEC J8 "unapproved content
never reaches public surfaces" — a re-uploaded, unreviewed deck IS
unapproved content) — a speaker being able to trigger it is a direct,
disclosed consequence of speakers being allowed to upload deliverables at
all, not an unintended side channel. Verdict: **INTENDED, per
decisions/DEC-020.md wave-43 amendment — not a defect.**

## Targeted tests

`npm run test:targeted -- test/files-repo.test.ts
test/content-reupload-reopens.test.ts test/content-reopen-disclosure.test.ts
test/public-invite-visibility.test.ts test/public-cacheability-enumeration.test.ts
test/public-session-gate.scan.test.ts test/public-speakers-facet-parity.test.ts
test/public-feeds.test.ts test/public-gallery.test.ts
test/participant-invite-audience.scan.test.ts test/files-upload-stream.test.ts
test/files-allowlist-prototype.test.ts test/content-status-single-writer.test.ts
test/files-headshots.test.ts test/public-embed-links.test.ts`

Result: `Test Files  15 passed (15)` / `Tests  144 passed (144)`.

## Summary

3 of 4 named claims adjudicated NO DEFECT / INTENDED (claims 1, 3, 4).
1 CONFIRMED-DEFECT (claim 2, version-mint read-then-write race). OPEN
ITEMS = 1, matching the confirmed-defect count per this task's contract.

RESULT: PASS — adjudication complete, all four claims resolved with
file:line evidence and a check run; 1 CONFIRMED-DEFECT filed (claim 2).
OPEN ITEMS: 1
