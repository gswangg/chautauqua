# task-w1-f — speaker CRM browser persona pass (J11) @ 5344b10

DEC-254 browser persona pass, lane f (speaker CRM, docs/eval-rubric/
07-speaker-crm.yaml). Own worktree `chautauqua-wt/task-w1-f`, own port 8806,
boot sequence: `npm ci` -> `npm run build` -> `npm run db:migrate` ->
`npm run seed` -> `npx tsx scripts/ensure-dev-vars.ts` ->
`npx wrangler dev --port 8806`. Driven with Playwright chromium, logged in
via the real `/login` form as `sbek-organizer@example.com` /
`SbekTest!2027-org` (docs/fixtures/sample-data.json), against event
"DevFlow Conf 2027". Console `error`/`pageerror` events and all
`/api/*` 4xx/5xx responses were collected on every page throughout. Driver
scripts lived at `.scratch/crm-*.ts` inside the worktree for the duration of
the run and were not committed (scratch-only).

The worktree was wiped by an external process mid-task twice (once during
initial exploration, once mid-edit while writing the second fix's
regression test) — both times the fix + tests were re-applied from scratch
in a freshly recreated worktree before continuing. All browser evidence
below is from the final, post-fix state.

## CRM-S1 — Build and organize the speaker database

**Navigation (CRM-01):** "Contacts" is a top-level nav item (`/admin/contacts`),
outside any single event's menu, rendering a searchable directory table (31
seed contacts, Name/Email/Company/Title/# Submissions/Actions columns).

**CSV import (CRM-05) — found and fixed a P1 defect:** opened Import CSV,
uploaded `docs/fixtures/speakers.csv` (header `name,email,title,company,bio`
— one combined "name" column, not separate first/last). The wizard's
auto-suggest mapped `name` only to `firstName` (no target existed for a
combined name column), so the mapping preview showed every row's Last name
as blank and — traced through `src/domain/contacts.ts`'s `mapImportRow` —
the server-side import would have silently written blank last names for all
3 rows. Fixed in `app/src/pages/contacts/csv.ts` (new client-only
`FULL_NAME_TARGET` pseudo-mapping + `splitFullName`/`expandFullNameMapping`/
`toCsv` helpers) and `app/src/pages/contacts/ImportWizard.tsx` (offers "Full
name (splits into first / last)" in the mapping `<select>`, auto-suggested
for `name`/`fullname`/`contactname`/`speakername` headers, and splits
client-side into two real columns before the request reaches the server —
no server/domain change needed). Re-verified in browser: preview now showed
First/Last correctly split (Priya/Raman, Marcus/Okafor, Dana/Kowalski);
clicked Import — result "Created 1, updated 2, skipped 0" (2 already existed
from the chained area-03 import, matched + updated by email; Dana was new).
Directory count went 31 -> 32, "Dana Kowalski" appeared with the correct
name, title, and company from the CSV.

**Search:** typed "Priya" into the directory search box — narrowed to the
2 Priya Raman rows (a pre-existing seeded near-duplicate); cleared, full
list returned.

**Multi-criteria filter (CRM-02):** added `company contains "Northwind
Systems"` then `title contains "Software Engineer"` via the Field/Operator/
Value filter panel — both chips shown, result narrowed to exactly 3 rows
(Alex Delgado, Uma Ionescu, Kai Tanaka), all three actually matching both
criteria (AND-narrowing, not just the second filter). "Clear all" restored
the full list.

**Save/reopen/delete segment (CRM-09):** with the two-filter set applied,
switched to the Segments tab, saved as "AI Experts". Switched back to
Directory, cleared filters, then selected "AI Experts" from the Segment
dropdown — reopened showing the same 3-contact member list. Re-applied the
segment, then deleted it from the Segments panel **while actively applied**
(DEC-254's specific regression target, following the w1-c-era
`onDeletedActiveSegment` fix already in `ContactsApp.tsx`): no error banner
appeared at any point (checked immediately after the click and 1s later),
and the Directory view cleanly reverted to "All contacts" / the full 32-row
list with zero flash of an error state.

**Contact profile + notes + history (CRM-03):** opened Priya Raman
(`priya.speaker@sbek-test.example.com`). Profile shows identity fields
(name/email/company/title/phone), a bio, and a headshot uploader. Added the
internal note "Met at DevFlow 2026 - strong on CI topics; shortlist for
keynote.", saved, reloaded the page, reopened the same contact — the note
was still present verbatim. The Submissions/Emails/Events tabs are the
history surfaces (this contact had none of any of the three yet, correctly
rendering "No events."/etc. rather than erroring).

**Custom field (CRM-04):** set the custom-fields JSON textarea to
`{"Speaker Type": "External"}`, saved, reloaded, reopened — the value
persisted verbatim after reload.

**Duplicate detection + merge (CRM-06):** created a same-name/
different-email duplicate (`Priya Raman` / `priya.raman.alt@sbek-test.example.com`)
via a one-row CSV import (no separate "new contact" button exists in this
UI). Opened Duplicates — 2 groups shown (Priya Raman x3, Marcus Okafor x2,
the latter a pre-existing seeded near-duplicate). Opened the Priya group's
Merge dialog (radio picker over the 3 records, defaulting to the first as
primary), confirmed. Result: a "Contacts merged." success banner rendered
*inside* the modal's own view (no transient/invisible error — this matches
the DEC-239/w1-c fix already landed, re-confirmed here), the merged
duplicate group updated to show only the two remaining records, and the
directory row count dropped from 33 to 32 (recorded before opening
Duplicates, since switching panels unmounts `DuplicatesView` and clears any
open merge dialog — the row-count check has to happen before the panel
switch, not after).

## CRM-S2 — Source through the pipeline, reuse across events

**Pipeline board (CRM-07):** 5 named stage columns — Identified, Contacted,
Interested, Confirmed, Declined.

**Enroll + move + reload (CRM-07):** enrolled Marcus Okafor
(`marcus.speaker@sbek-test.example.com`) via "+ Enroll" (no score/rationale
fields exist in this build's dialog — bonus per the rubric, not required).
Moved the card Identified -> Contacted -> Interested via the per-card
"Move to" `<select>`. Reloaded the page, reopened the Pipeline tab — the
card was still in the Interested column.

**Card detail + note + stage history (CRM-08):** opened the card, added the
note "Left voicemail 2027-01-15; follow up next week.", saved — the
Activity log showed the note plus 3 timestamped "Moved X -> Y" entries
matching the moves above, each attributed to `sbek-organizer@example.com`
with a real timestamp. Reloaded, reopened the card — note and full stage
history were still present, identical.

**Push to event (CRM-10) — found and fixed a P1 defect:** clicked "Add to
event..." on Marcus Okafor's directory row, targeted "DevFlow Conf 2027",
confirmed — got the in-app "Marcus Okafor was added as an accepted
speaker." confirmation. Navigated to DevFlow Conf 2027's Speakers page:
**Marcus Okafor was absent.** Traced the cause: `pushContactToEvent`
(`src/server/repo/contacts.ts`) inserted the submission directly with
`status: "accepted"`, which bypasses `updateSubmissionStatuses`'s
acceptance planner (`src/server/repo/submissions/status.ts`) entirely —
that planner only fires on a *tracked* pending->accepted transition
(DEC-079) and is what assigns the event's default onboarding tasks
(Hotel/Flight/Finalize talk/Finalize bio/Announce). The Speakers page
(`getOnboardingGrid`) renders `task_assignment` rows, not submissions
directly, so a contact with zero task assignments never appears there at
all. Fixed by creating the submission as `pending` and then driving it
through the same `updateSubmissionStatuses` path triage/bulk-accept use,
reaching the identical final `status: 'accepted'` DEC-156 requires while
also running acceptance planning — still sends no email
(`updateSubmissionStatuses` has no mailer import, DEC-009 invariant #1,
covered by the source-scan test). Re-verified in browser: Marcus Okafor now
appears in DevFlow Conf 2027's Speakers/onboarding grid with name, email,
and company carried over, and 5 onboarding task columns.

**Bulk email (CRM-11):** searched the directory to `speaker@sbek-test.example.com`,
selected Priya Raman + Marcus Okafor via row checkboxes, clicked "Bulk
email (2)". Composed subject "Speak at DevFlow Conf 2027?" and a body using
the offered merge tags `{speaker_name}`/`{event_name}`/`{portal_link}`.
Clicked Preview — the preview list showed 2 per-recipient entries with the
merge tags resolved to real values (no literal `{speaker_name}` visible).
Sent — "Sent 2 emails." confirmation. Checked `/dev/mailbox`: both
recipients present with subject "Speak at DevFlow Conf 2027?", status
"sent", each with its own row (per-recipient history, not one aggregate
row). Comms > History also lists the underlying submissions/sends.
(`{portal_link}` resolved to an absolute `chautauqua.cc` URL under
`wrangler dev` — this is the known DEC-252 origin issue, owned by lane a's
files (`src/routes/api/contacts.ts` lines ~605/~657 per the task
delegation); out of scope here and untouched.)

**Dashboard (CRM-12):** the Contacts directory page itself doubles as the
KPI/analytics surface — "31 Total contacts" / "1 Events" / "0 Returning
speakers" plus a "Top companies" widget (5 companies, each showing a
member count), consistent with the 31 (now 32) rows visible in the
directory below it. Clicking a company chip applies it as a directory
filter (drill-through), per `ContactsApp.tsx`'s `onCompanyClick` handler.

## Files touched (with a regression test per fix)

- `app/src/pages/contacts/csv.ts` — `FULL_NAME_TARGET` pseudo-target,
  `splitFullName`, `toCsv`, `expandFullNameMapping`; `mapImportRow` and
  `suggestMapping` extended to recognize it.
- `app/src/pages/contacts/ImportWizard.tsx` — offers the new mapping
  option and expands it into real firstName/lastName columns before POST.
- `app/src/pages/contacts/csv.test.ts` — new `describe` blocks for
  `splitFullName`, `mapImportRow` with `FULL_NAME_TARGET`,
  `expandFullNameMapping` (including the exact `speakers.csv` shape), and
  `toCsv`; extended `suggestMapping` coverage for a `name` header.
- `src/server/repo/contacts.ts` — `pushContactToEvent` now creates
  `pending` + drives to `accepted` via `updateSubmissionStatuses` instead
  of inserting `status: 'accepted'` directly.
- `test/contacts-add-to-event.test.ts` — rewritten from a fixed-order
  select-queue fake db to a table-aware in-memory fake (same pattern as
  `test/status-bulk-full-match.test.ts`) so it can model the extra
  selects/inserts acceptance planning performs; asserts the submission
  ends at `status: 'accepted'` with `acceptedAt` set, the contact gets one
  `taskAssignment` row per DEC-009 default onboarding task, and the
  mailer-tripwire source scan now also covers
  `src/server/repo/submissions/status.ts` (the newly-reachable planning
  module), still finding no mailer import anywhere on the path.

No other defects found or fixed: `app/src/pages/Contacts.tsx` is a thin
wrapper (`export function ContactsPage() { return <ContactsApp />; }`) with
no logic of its own; `src/routes/api/pipeline.ts` and
`src/server/repo/pipeline.ts` were exercised end to end (enroll/move/note/
stage history) with no defects observed, so nothing there needed a fix.

## Build/test

`npm run build` (`tsc --noEmit` x2 + `vite build`) and `npx vitest run`
both green: 186 test files / 1607 tests passed, including the two new/
rewritten test files above.

OPEN ITEMS: 0
RESULT: PASS
