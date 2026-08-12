# task-w25-f — stage-1 completion ledger (DEC-496)

LOG-ONLY task. No files under `src/`, `app/src/`, `scripts/`, `test/`,
`migrations/`, or `decisions/`, nor `package.json`, were touched. The only
non-tracked file written was the gitignored `.dev.vars` (needed to start
`wrangler dev` with `DEV_MODE=1` so `/dev/mailbox` mounts — see §1 and
§6; not a code change, not tracked by git, not part of this repo's diff).

Note on sha: the worktree for this task was originally cut at `5c0520a`
(`merge task-w25-e`), and all of §0-§7 below were first drafted and
verified there. Before this ledger was committed, the worktree
infrastructure recycled the directory (an environment event, not a
product or planning issue) and `main` had meanwhile advanced two more
merges (`merge task-w25-b`, `merge task-w25-c`, plus their prerequisite
commits `aab51d0 DEC-494` and `58c8ec1 DEC-495`). Per this task's own
instruction ("branch fresh from main and build directly on it"), the
worktree was re-cut from current `main` and every check below (§0-§1
build/test/bundle/walkthrough, §2-§3 file:line reads) was re-run from
scratch at the new sha rather than reusing the earlier draft — this
ledger is evidence about its own sha, given below, only.

## §0 — sha, build, test, bundle

```
$ git rev-parse HEAD
e5f41c6e88ea91eac01629bd81078101b90316f8
```

`git log --oneline -20`:

```
e5f41c6 merge task-w25-c
6fa5eb8 merge task-w25-b
8464c20 docs: verification log for task-w25-c public speaker scale (DEC-495)
aab51d0 Comms compose-preview ics chip renders in the owning event's timezone (DEC-494)
5c0520a merge task-w25-e
511a216 merge task-w25-a
58c8ec1 DEC-495: fill perf seed's public speaker range to 800 via co-speakers
05602c7 docs(verification-log): fresh-clone zero-secret quickstart evidence (w25-e)
6b2a86b w25-a: repair walkthrough harness's two seeded-event-resolution/validation defects
c19559d merge task-w25-d
2cee4ce task-w25-d: re-cut render-sweep + phone evidence at DEC-489/490 sha, add missing embed twins to routeManifest
f4421b1 scribe wave 25
03c03b9 merge task-w24-e
5ff2527 DEC-492: atomic set-based ics_sequence bump + bounded auto-schedule writes
745b785 merge task-w24-b
443df31 DEC-489: parity for embed knobs between HTML and .json twins
0f361ad merge task-w24-d
7a14e3d merge task-w24-c
5fa528d merge task-w24-a
574fc3c DEC-491: measure and bound the CSV import's per-row write burst
```

`npm run build` — clean, `✓ built in 670ms`, no errors.

`npm test` (vitest, whole suite):

```
Test Files  303 passed (303)
     Tests  2765 passed (2765)
  Duration  24.90s
```

`npm run bundle:check`:

```
Entry bundle: index-Flt4w77N.js + index-BOb7RLKn.css = 62.06 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

All three green at this sha, run by me in this worktree.

## §1 — J1-J12 walkthrough

Migrated (`npm run db:migrate`, 0001-0018 all `✅`) and seeded
(`npm run seed`, clean, 8 R2 objects) a fresh local D1/R2. Started
`npx wrangler dev --port 8794` (DEC-498: my assigned port; `kill <the PID
I started>` at cleanup, never `pkill -f` — confirmed `lsof -i :8794`
empty afterward). `GET /` → 200, `GET /dev/mailbox` → 200 once
`.dev.vars` (`DEV_MODE=1`) was present (see §6's open item — the
non-default-`npm run dev` startup path doesn't create this file
automatically).

`npm run walkthrough -- --url http://localhost:8794`, one clean run
against the freshly migrated+seeded instance:

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

J1-J12 to module/output-line map (`scripts/walkthrough/<module>.ts`):

| Journey | Module | Evidence |
|---|---|---|
| J1 (launch a CFP) | producer.ts | `Running J1 (launch a CFP)... ok` |
| J2 (public submit + claim) | producer.ts | `Running J2 (public submit + claim) against devflow-conf-2027... ok` |
| J3 (triage at volume) | producer.ts | `Running J3 (triage at volume) against devflow-conf-2027... ok` |
| J4 (reviewer/committee) | review.ts (`scripts/walkthrough/review.ts:1`: "SPEC §9, job J4") | `review walkthrough: OK (all checks passed)` / `PASS review` |
| J5 (compose: merge fields, cap, ICS, HTML escaping) | producer.ts | `Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027... ok` |
| J6 (acceptance -> onboarding auto-creation) | speaker.ts (`scripts/walkthrough/speaker.ts:300`: "J6: organizer accepts...") | `ok   default onboarding task set was created for the speaker` |
| J7 (speaker portal: submissions/tasks/sessions/resources/profile) | speaker.ts (`scripts/walkthrough/speaker.ts:414`: "J7: speaker portal...") | `ok   portal dashboard shows my submissions with status` |
| J8 (Presentation deliverable upload, versioning, comment thread, content approval) | speaker.ts (`scripts/walkthrough/speaker.ts:1139`: "J8: Presentation deliverable...") | `ok   upload a valid Presentation deliverable (v1)` |
| J9 (agenda: rooms/tracks, scheduling, conflicts, auto-schedule) | public.ts | `ok   J9 auto-schedule places remaining sessions without introducing conflicts` |
| J10 (public event surfaces + embeds + visibility gates) | public.ts | `ok   J10 DEC-108 invite-visibility gate: accepted invitee shown, pending and declined invitees absent` |
| J11 (CRM: contacts, segments, bulk-email, dashboard stats) | data.ts | `-- J11: dashboard stats (returning speakers, top companies)` |
| J12 (API: bearer tokens, exports, docs) | data.ts | `-- J12: GET /docs/api returns 200` |

All twelve journeys pass at this sha in a clean-seed run. No module still
fails — the harness repair task-w25-a landed (DEC-493, ancestor of this
sha) holds.

**Open item (harness usage, not product).** The walkthrough scripts are
not idempotent across repeated invocations against the same DB: an
initial exploratory run of mine (before I settled on a fresh-reseed
protocol) hit a second-reviewer-email 409, a stale-fixture-id 404 in the
close-date probe, an already-placed auto-schedule 500, and a `chq_csrf`
cookie-state drift in scale step 6 — all four traced to running the
script twice against consumed state, none of them a J1-J12 regression. A
single run against a freshly wiped+reseeded DB (quoted above) passes all
six modules cleanly. This is a run-hygiene note for whoever next drives
`scripts/walkthrough.ts`, not a FAIL-unowned finding, and it is outside
this LOG-ONLY task's scope to fix in the harness itself.

## §2 — SPEC.md:353 "server pagination + filtering on all admin lists"

`npx vitest run test/list-envelope-enumeration.test.ts`:

```
✓ test/list-envelope-enumeration.test.ts (4 tests) 18ms
Test Files  1 passed (1)
     Tests  4 passed (4)
```
**Verdict: PASS.**

DEC-488 closure, by direct read at this sha:

- `src/server/repo/forms.ts:250`: `export const MAX_FORM_FIELDS = 200;`
- `src/routes/api/forms.ts:154-156`:
  ```
  if (existing.length >= repo.MAX_FORM_FIELDS) {
    throw new ApiError("invalid", `This form already has the maximum of ${repo.MAX_FORM_FIELDS} questions.`, {
      label: `Max ${repo.MAX_FORM_FIELDS} fields per form`,
  ```
  The 201st field is rejected, naming the number (200) in the message.
- `src/routes/api/forms.ts:264`:
  ```
  return c.json({ items: reordered.map(toPublicField), total: reordered.length, page: 1, perPage: repo.MAX_FORM_FIELDS });
  ```
  Full `{items, total, page, perPage}` envelope echoed on reorder.
- `test/list-envelope-enumeration.test.ts:117-120` (`ENVELOPE_ALLOWLIST`)
  contains exactly two entries at this sha — `src/routes/comms.ts:388`
  and `src/routes/api/contacts/bulk-email.ts:189` (the comms.ts line
  number shifted from `:384` at the earlier sha to `:388` here because
  DEC-494's ICS-chip timezone fix added lines above it; confirmed by
  direct grep of the allowlist array and by the test passing, i.e. the
  allowlisted line still matches a real `c.json({ items` site).
  `src/routes/api/forms.ts:259` (task-w21-f's open item #2 site) is GONE
  from this allowlist.

For each surviving allowlist entry, the constant that actually enforces
its rationale, read at this sha:

- `src/routes/comms.ts:388` (POST `.../compose/preview`): bounded by
  `src/domain/compose.ts:9` `export const MAX_COMPOSE_RECIPIENTS = 100;`,
  enforced inside `expandRecipients` (`src/domain/compose.ts:50`, cap
  check at `:62`). `expandRecipients` is called once, at
  `src/routes/comms.ts:320` inside the shared `buildRenderTargets`
  helper, which both the preview handler
  (`commsRoutes.post("/api/v1/events/:eventId/compose/preview"` at
  `:351`) and the send handler
  (`commsRoutes.post("/api/v1/events/:eventId/compose/send"` at `:391`)
  call — one shared enforcement point for both paths.
- `src/routes/api/contacts/bulk-email.ts:189`: bounded by
  `src/routes/api/contacts/bulk-email.ts:115`
  `const BULK_EMAIL_PREVIEW_LIMIT = 5;`, applied at `:179`
  (`const previewContacts = contacts.slice(0, BULK_EMAIL_PREVIEW_LIMIT);`)
  before the preview renders.

Neither allowlist rationale is narration — both cite a constant that is
actually read on the code path producing the allowlisted response.

## §3 — DEC-488/489/490/491/492, one row each, at this sha

| DEC | File:line at this sha | Verdict |
|---|---|---|
| 488 | `src/server/repo/forms.ts:250` (`MAX_FORM_FIELDS = 200`) + `src/routes/api/forms.ts:154-156,264`. See §2. | PASS |
| 489 | `src/routes/public/dispatch.tsx:23` (shared `query: { trackId, page, q, day, limit, fields }` object), `:30,45,54,66,74,86` (every surface — sessions/speakers/agenda/schedule/gallery — reads `query.limit`), `:93,98` (agenda/schedule read `query.day`). HTML and the `.json` twin both flow through this one `dispatch.tsx` handler; there is no separate JSON-only branch hard-coding `PUBLIC_PER_PAGE`. `app/src/pages/settings/embedSnippet.ts:35` (`EMBED_KNOBS_BY_SURFACE`) is the one declared surface->knob table. | PASS |
| 490 | `app/src/pages/settings/embedSnippet.ts:35` (`EMBED_KNOBS_BY_SURFACE`) + `:64` (`const knobs = format === 'ics' ? [] : EMBED_KNOBS_BY_SURFACE[surface];`) — the embed builder serializes only the knobs the selected surface's table entry lists. `app/src/pages/settings/EmbedsPanel.render.test.tsx:125-126` asserts the builder renders a control only when the table lists it. | PASS |
| 491 | `src/server/repo/contacts/import.ts:49` (`MAX_IMPORT_ROWS = 2000`), `:52` (`IMPORT_MAX_STATEMENTS_PER_ROW = 3`, measured worst case), `:59` (`MAX_IMPORT_WRITE_STATEMENTS = MAX_IMPORT_ROWS * IMPORT_MAX_STATEMENTS_PER_ROW`, the real per-request write-burst bound). The file's own comment (`:31-46`) documents `applyImportRows` uses dedicated create/update helpers issuing exactly 1-3 statements/row (never the unbounded `createContact`/`patchContact` re-read path), measured by `test/contacts-import-write-burst.test.ts`. | PASS |
| 492 | `src/server/repo/agenda.ts` — `bumpIcsSequences` (plural, set-based) called from `scheduleSlot`/`unscheduleSlot` (this build's read of the file shows the read-then-write singular `bumpIcsSequence` pattern is gone). `runAutoSchedule`'s placement loop batches inserts in `ID_CHUNK_SIZE` chunks and calls `bumpIcsSequences` once over all new placements, bounded by `MAX_AUTO_SCHEDULE_PLACEMENTS = 2000`. Landed by `5ff2527 DEC-492: atomic set-based ics_sequence bump + bounded auto-schedule writes`, merged at `03c03b9 merge task-w24-e`. | PASS |

DEC-492 mechanical-ancestry check (per this task's instruction, since the
task brief flagged it as a possible gap):

```
$ git log --merges --oneline | grep w24
03c03b9 merge task-w24-e      <- the one that matters
745b785 merge task-w24-b
0f361ad merge task-w24-d
7a14e3d merge task-w24-c
5fa528d merge task-w24-a
e5753de merge task-w24-f      (older, unrelated wave-24 slot reuse)
d6ca408 merge task-w24-c      (older, unrelated wave-24 slot reuse)
45d57e8 merge task-w24-e      (older, unrelated wave-24 slot reuse)
180631e merge task-w24-d      (older, unrelated wave-24 slot reuse)
0235ce3 merge task-w24-b      (older, unrelated wave-24 slot reuse)
04b170d merge task-w24-a      (older, unrelated wave-24 slot reuse)

$ git merge-base --is-ancestor 03c03b9 HEAD && echo "03c03b9 IS ancestor"
03c03b9 IS ancestor
```

`merge task-w24-e` (`03c03b9`) IS an ancestor of this sha, and the direct
read of `src/server/repo/agenda.ts` above confirms the DEC-492 fix
(atomic set-based bump, chunked bounded insert loop) is present. **DEC-492
is not PENDING-OWNED at this sha — it is landed and verified by direct
read, matching the mechanical-ancestry check.**

## §4 — Perf (SPEC.md:325-338)

`git merge-base --is-ancestor <sha> HEAD` confirms both perf artifacts
under this sha's history are ancestors:

- `docs/verification-log/task-w25-c-perf-smoke.md` reports all ten p95
  probes under the 150ms local-runtime advisory budget vs. the w20-c
  baseline, worst ratio 1.92x (submission detail, 27.1ms, still well
  inside budget, flagged as noise not regression), `RESULT: PASS`.
- `docs/verification-log/task-w25-c-public-speaker-scale-stage1.md`
  (DEC-495, the commit right above this sha's merge point) reports the
  perf seed now reaches SPEC's 800-speaker top end via co-speakers rather
  than more sessions, and the deepest public-speakers page reads 19.6ms
  adjusted p95 against a 150ms public-class budget (~7.7x headroom), all
  26 `perf:smoke` checks passed, `RESULT: PASS`.

Both cited directly, not re-run in this LOG-ONLY task.

## §5 — Render/phone (SPEC.md:374-377)

`docs/verification-log/task-w25-d-render-sweep-stage1.md` is an ancestor
of this sha (`merge task-w25-d`, `c19559d`). It reports: desktop pass
44/44 PASS, mobile pass (390x844, 21 routes) 21/21 PASS, admin mobile
pass 20/20 PASS, font-floor pass 85/85 PASS, WCAG-contrast pass 44/44
PASS. One open item carried: `scripts/render-sweep.ts`'s
`MOBILE_ROUTE_MANIFEST` still lists only 3 of 5 embed twins (missing
`/embed/:slug/schedule` and `/embed/:slug/gallery` from the
phone-viewport-only pass), explicitly out of that task's file-touch
scope. `RESULT: PASS` with that one open item carried forward (not a
FAIL). Cited directly, not re-run in this LOG-ONLY task.

## §6 — Quickstart / zero-secrets (SPEC.md:42-47, 361-366)

`docs/verification-log/task-w25-e-fresh-clone-stage1.md` is an ancestor
of this sha (`merge task-w25-e`, `5c0520a`). It confirms: all four
Quickstart commands (README.md:42-47) completed zero-secret on a fresh
clone; all four "For evaluators" credentials (README.md:158-163) worked
exactly as printed; the public sessions surface, admin SPA shell, speaker
portal, and dev mailbox all rendered real seeded content. Two open items
carried, both documentation gaps in the non-default-port section of the
README: missing `npm run build` before `/admin` works, missing
`.dev.vars` creation before `/dev/mailbox` works — both because that
section skips the `predev` hook that `npm run dev` runs automatically.
`RESULT: PASS`.

This ledger independently reproduced open item #2 of that artifact: I ran
`npx wrangler dev --port 8794` directly (bypassing `predev`) and got
`/dev/mailbox` → 404 until I manually created `.dev.vars` with
`DEV_MODE=1` (see §1). Same documented gap, not a new finding — confirms
task-w25-e's open item #2 is accurate and still present at this sha.

## §7 — Carried items from task-w21-f-stage-1-completion-ledger.md

**Item #1 — STRUCK.** The item claimed a perf-budget row was marked
`UNMEASURABLE-BY-CONSTRUCTION at this sha` in
`docs/verification-log/task-w21-e-perf-smoke-stage1.md`. Direct quote of
that file, lines 102-103:

> "**Neither row is UNMEASURABLE-BY-CONSTRUCTION at this sha.**
> Independently confirmed live via the API (§4 below): `GET
> /api/v1/pipeline?page=1&perPage=50` returns `total=803`; `GET
> /api/v1/users?page=1&perPage=50` returns `total=104` — matching the DB
> counts exactly, once queried against the correct worktree's server (see
> the port-collision gotcha above)."

This is the opposite of what task-w21-f's open item #1 claimed its own
cited source says. **STRUCK.**

**Item #2 — CLOSED.** `src/routes/api/forms.ts:259` no longer returns a
bare `{items}` envelope; the file at this sha shows the reorder handler
at line 264 returning the full `{items, total, page, perPage}` envelope,
and the field-create path (`:154-156`) enforces `MAX_FORM_FIELDS = 200`
naming the number in its error message. See §2 above. **CLOSED.**

## §8 — Stage-2 scope (explicitly OUT, not graded)

Cloudflare provisioning, `wrangler deploy` to a live account, real Resend
email delivery/webhooks, Airtable sync wiring, domains/DNS, CI deploy
pipelines, production edge-cache validation. Stage 1 runs entirely on
local `wrangler dev` + local D1/R2 + the dev-mail-sink, zero external
accounts/secrets required (confirmed again in §6 above). Absence of any
of these is not a stage-1 gap.

## OPEN ITEMS

1. (harness usage note, §1) The walkthrough scripts are not idempotent
   across repeated runs against the same seeded DB. A clean single run
   against a freshly migrated+seeded DB passes all six modules (quoted in
   §1). Not FAIL-unowned — a run-hygiene note, not a product defect, and
   outside this LOG-ONLY task's scope to fix.
2. (documentation gap, carried from task-w25-e, §6) README.md:61-69's
   non-default-port procedure omits the `predev` steps (`npm run build`
   and `.dev.vars` creation) that `npm run dev` runs automatically — both
   independently reproduced again in this ledger. Not FAIL-unowned —
   already logged by task-w25-e as a documentation gap.
3. (perf, carried from task-w25-c, §4) `submission detail` p95 moved from
   14.1ms (w20-c) to 27.1ms (w25-c), a 1.92x ratio, still well inside the
   150ms budget; flagged as noise to watch, not a regression. Not
   FAIL-unowned.
4. (render, carried from task-w25-d, §5) `MOBILE_ROUTE_MANIFEST` in
   `scripts/render-sweep.ts` still lists only 3 of 5 embed twins for the
   phone-viewport-only pass. Not FAIL-unowned — desktop coverage of all 5
   embed twins is confirmed PASS; this is a phone-manifest gap in a
   script this LOG-ONLY task cannot touch.

## FAIL-unowned

(none)

## PENDING-OWNED

(none — DEC-492/task-w24-e, the one item the task brief flagged as a
possible PENDING-OWNED candidate, is confirmed landed and verified by
direct read in §3, not pending on any branch)

## RESULT: PASS

Build, full test suite (2765/2765), and bundle:check all green at this
sha (§0). A clean single-seed J1-J12 walkthrough run passes all twelve
journeys across all six modules (§1). The DEC-473/480 list-envelope
enumeration test passes, and SPEC.md:353's "server pagination + filtering
on all admin lists" universal claim holds with two allowlisted,
constant-enforced exceptions (§2). DEC-488/489/490/491/492 all verify PASS
by direct file:line read at this sha, including DEC-492, which the task
brief flagged as a possible gap but which direct read confirms is landed
(§3). Perf, render/phone, and quickstart/zero-secrets all cite in-history
ancestor artifacts reporting PASS with only advisory open items carried
forward (§4-6). Both carried items from task-w21-f are settled — one
STRUCK by its own cited source, one CLOSED by direct file:line evidence
(§7). The FAIL-unowned list is empty.
