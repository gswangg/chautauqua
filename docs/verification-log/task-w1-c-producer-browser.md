# task-w1-c — producer browser persona pass (J1 + J3 + J5) @ c663cf2

DEC-254 browser persona pass, lane c (producer). Own worktree
`chautauqua-wt/task-w1-c`, own port 8803, boot sequence:
`npm ci` (cached) -> `npm run build` -> `npm run db:migrate` -> `npm run seed`
-> `npx tsx scripts/ensure-dev-vars.ts` -> `npx wrangler dev --port 8803`.
Driven with Playwright chromium (pattern from `scripts/render-sweep.ts`), logged
in via the real `/login` form as `sbek-organizer@example.com` /
`SbekTest!2027-org` (docs/fixtures/sample-data.json), against event
`devflow-conf-2027`. All console `error`/`pageerror` events were collected on
every page throughout (zero allowlist, same bar as the render-sweep gate)
except where noted below as an expected/intentional error response.

Driver scripts lived at `.scratch/w1c-{j1,j3,j5}.ts` inside the worktree for
the duration of the run and were deleted before commit (not product code,
scratch-only, per the harness note against writing report/scratch files into
the repo).

## J1 — Submissions > Forms (CFP-01, CFP-03)

Clicked "Add field" six times on `/admin/submissions/forms` and filled the
modal for each field kind, with help text and a required flag where noted:

- `text` "Speaker travel city" — required, help text set
- `long_text` "Extended abstract" — optional, help text set
- `dropdown` "Experience level" — required, options
  Beginner/Intermediate/Advanced, help text set
- `checkbox` "Willing to record" — optional, help text set
- `number` "Years speaking" — optional, help text set
- `file` "Slide deck draft" — optional, help text set

Added a seventh field, `text` "Workshop room setup notes", and built a
conditional rule in the same modal's "Show this field when..." fieldset:
field = Session format, condition = eq, value = "Workshop (120 min)". Saved.

Set the form's close date to 2027-04-01 (date input) and checked all three
track checkboxes (AI Engineering / Platform & Infra / Developer Experience)
in the "Tracks offered" fieldset, then clicked "Save settings".

Reloaded `/admin/submissions/forms` (full page reload, not SPA nav): all 7
new field labels were present in the field list table, the close-date input
still read `2027-04-01`, and the Condition column for the new field rendered
`if field_session_format eq "Workshop (120 min)"`. Zero console errors
through the whole flow.

Opened `/submit/devflow-conf-2027` in a **fresh browser context** (no
session, no prior cookies) to confirm server-side rendering:

- Body text contained "Speaker travel city" (an always-visible new field) —
  confirms the new question renders SSR without any admin-session state.
- Body text did **not** contain "Workshop room setup notes" on initial load
  — confirms the conditional field starts hidden server-side
  (`style="display:none"` on its wrap div, matching `src/views/form-render.tsx`'s
  `visible` prop).
- Selecting "Workshop (120 min)" in the Session format `<select
  data-field-id="field_session_format">` made the wrap div's `style`
  attribute go from `display:none` to empty (visible) via the inline
  vanilla-JS toggler (`FieldRulesScript`).
- Switching the format back to "Talk (30 min)" re-hid it
  (`style="display: none;"`), confirming the rule re-evaluates on every
  `change` event, not just once.
- Zero console errors in the fresh context.

**Result: PASS, 0 defects.** CFP-01/CFP-03 round-trip and conditional
visibility both work end-to-end exactly as a non-technical producer would
expect.

## J3 — Submissions list (CFP-06, CFP-12)

On `/admin/submissions`:

- **Search**: typed "CI" into the search box — 2 rows matched (`SES-008`
  "Building Resilient Incident Response Pipelines", `SES-001` "Taming
  40-Minute CI: Incremental Builds at Monorepo Scale"), both plausible
  substring matches on title. Cleared search, count returned to full list.
- **Filter by track**: the track `<select>` offered "All tracks" + the 3
  event tracks; selecting "AI Engineering" narrowed the table to 12 rows,
  and the Tracks column for every visible row indeed contained "AI
  Engineering" (checked all returned track-column text). Reset to "All
  tracks".
- **Filter by status**: toggling the "Pending" status pill narrowed to 14
  rows, and the Status column for every row read exactly "Pending" (no
  other status leaked through). Toggled back off. (Format has no
  standalone filter control by design — DEC-243 explicitly keeps format as
  a form answer surfaced only via the default-visible column, not a new
  query filter; verified the column itself below.)
- **Column toggle**: opened the "Columns" `<details>/<fieldset>` picker —
  labeled, not the unlabeled do-nothing checkboxes DEC-243 fixed. The
  "Session format" column (DEC-249's widened label match for "Session
  format" vs. plain "Format") was checked by default and its `<th>` was
  present in the table header **before** the picker was even opened,
  confirming the DEC-243/DEC-249 default-visible behavior. The **Tracks**
  column (a fixed built-in column, not part of the picker) already showed
  track **names** joined by ", " (e.g. "AI Engineering, Platform & Infra"),
  not a raw count — confirmed above under the track-filter check. Toggling
  "Audience level" on added a new `<th>Audience level</th>` to the header
  immediately.
- **Save/reopen a view**: opened the Views dropdown, clicked "Save current
  as view…", accepted the name prompt with "J3 Regression View" — it
  appeared in the Views list. Changed the search box to an unrelated
  string, then clicked the saved view's button: the search box reverted to
  its saved (empty) value, confirming the view round-trips filter state,
  not just column state.
- **Bulk select + status change**: checked 2 row checkboxes; the bulk
  action bar (`role="toolbar"`) appeared. Before: both rows read
  "Declined". Clicked "Mark Accepted": both rows updated to "Accepted" in
  place (optimistic update, confirmed correct after the round trip).
- **Manual submission + clone**: clicked "New submission", filled title +
  description, submitted — the modal closed and the new title appeared
  when searched for. Clicked "Clone" on that row — after the clone, 2 rows
  matched the same title text (original + clone), confirming
  `POST /submissions/:id/clone` worked end-to-end from the UI.
- **Permalink**: clicked a submission's title link, landed on
  `/admin/submissions/seed_submission_0030`; did a hard `page.reload()` on
  that exact URL (simulating a bookmarked/shared permalink) and the detail
  page still rendered non-empty content at the same URL — confirms it's a
  real deep link, not SPA-only client state.

Zero console errors across the entire J3 flow.

**Result: PASS, 0 defects.**

## J5 — Bulk decide, then Comms (compose/templates/history/cap)

Confirmed the dev mailbox message count via `/dev/mailbox` before touching
anything: **3** (residual from earlier lanes/seed — irrelevant, only the
before/after delta matters).

**Decide alone sends nothing:** filtered Submissions to "Pending", selected
3 rows ("A Practical Guide to Internal Tooling", "Rethinking Data Contracts:
Lessons from Production", "What Nobody Tells You About Deployment
Pipelines"), clicked "Mark Accepted" in the bulk action bar. Re-checked
`/dev/mailbox`: still **3** — unchanged. Confirms DEC-009 invariant #1 (status
changes never auto-send email) holds through the real bulk-decide UI path,
not just at the API layer.

**Comms > Templates:** created a new template "J5 Decision Notice <ts>" with
subject `Update on your talk: {talk_title}` and body starting `Hi
{speaker_name},\n\nThanks for submitting `, then clicked the `{talk_title}`
merge-field chip — the body textarea correctly appended `{talk_title}` at
the end (verified via `.inputValue()`: `"Hi {speaker_name},\n\nThanks for
submitting {talk_title}"`). Saved; the template appeared in the templates
table.

**Comms > Compose:** step 1 (accepted+declined default filter) showed 17
rows including the 3 just-accepted submissions. Selected 3, advanced to step
2, picked the new template from the dropdown — subject field auto-populated
with the raw `{talk_title}` token (unresolved, as expected pre-render).
Advanced to step 3 (Preview): the pane showed a **per-recipient stepper**
("Previous / Recipient 1 of 3 / Next") with the merge fields already
resolved for the first recipient (`To: Xan Chen <xan.chen@example-speakers.test>`,
subject and body with `{speaker_name}`/`{talk_title}` substituted with real
values, no raw braces left). Clicked "Send to 3 recipients" — landed on the
"Sent" step reading "Sent 3 emails."

**Mailbox after send:** `/dev/mailbox` count went from 3 (unchanged after
decide) to **6** — a delta of exactly 3, matching the 3 recipients sent.

**History tab:** navigated to Comms > History — 6 total rows (all 6 sent
emails across this run, including earlier walkthrough residue), and the
resolved subject text `Update on your talk:` (not the raw template) appeared
in the table, confirming every recipient of this send is present in history
with merge fields already resolved (not the raw template placeholders).

**100-recipient cap:** created a fresh event via the organizer's own
authenticated session (`x-chq-csrf: 1` header, same contract
`src/server/middleware.ts` csrfJson enforces) and 101 manual submissions in
it (mirroring `scripts/walkthrough/producer.ts`'s own overflow-fixture setup
pattern, since the seeded `devflow-conf-2027` doesn't carry >100
submissions). Opened that event's Comms > Compose, filtered to "Pending",
selected all 101 rows, filled a from-scratch subject/body, clicked "Next:
preview" — the wizard **did not advance** to step 3; it stayed on step 2 and
showed the cap error banner: "101 recipients exceeds the 100-recipient cap;
narrow the batch. Narrow your submission selection to 100 or fewer
recipients and try again." One console error was logged for this
interaction (`Failed to load resource: ... 400 (Bad Request)`) — this is the
browser's own network-layer log of the *expected* rejection response from
`POST /events/:id/compose/preview`, not an application defect; the UI
correctly caught the `ApiError` and rendered the cap banner instead of
crashing (`ComposeWizard.tsx`'s `runPreview` `capMessage` branch). Re-checked
`/dev/mailbox`: still **6** — the blocked cap attempt sent nothing.

**Result: PASS, 0 defects.** All J5 checks (decide != notify, merge-field
templates, per-recipient preview stepper, send, history round-trip, 100-cap
enforcement, cap-block sends nothing) passed exactly as specified.

## Files touched

None. No defects were found in
`app/src/pages/Submissions.tsx`, `app/src/pages/submissions/*`,
`app/src/pages/forms/*`, `app/src/pages/Comms.tsx`, `app/src/pages/comms/*`,
`src/routes/api/submissions.ts`, `src/routes/api/forms.ts`, or
`src/routes/comms.ts` during this pass. Per DEC-254, a clean 0-item PASS is
a valid outcome and no speculative changes were made.

## Build/test

`npm run build` and `npm test` both green in this worktree prior to writing
this log (184 test files / 1573 tests passed; build: `tsc --noEmit` x2 +
`vite build` clean). No source changes were made in this task, so these are
the pre-existing green baseline, re-confirmed at the end of the pass.

OPEN ITEMS: 0
RESULT: PASS
