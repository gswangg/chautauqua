# task-w3-b — J11 CRM organizer browser pass (campaign-2) @ 6b4e662

DEC-259 browser pass, fix-authorized within the owned-file list:
`app/src/pages/Contacts.tsx`, `app/src/pages/contacts/**`,
`src/routes/api/contacts.ts`, `src/routes/api/pipeline.ts`,
`src/server/repo/contacts.ts`, `src/server/repo/pipeline.ts`, plus test
files. Own worktree `chautauqua-wt/task-w3-b`, port 8831. Boot sequence:
`npm ci` -> `npm run build` -> `npm run db:migrate` -> `npm run seed` ->
`npx tsx scripts/ensure-dev-vars.ts` -> `npx wrangler dev --port 8831
--var PUBLIC_BASE_URL:http://localhost:8831` (non-default port, DEC-252).
Driven with real Playwright chromium, logged in via the real `/login` form
as `sbek-organizer@example.com` / `SbekTest!2027-org`
(docs/fixtures/sample-data.json). Console `error`/`pageerror` events were
collected on every page with zero allowlist (the one deliberate exception
is documented below). Driver script lived at `.scratch/crm-drive.ts`
inside the worktree for the duration of the run and was deleted before
committing (never part of the diff).

The worktree was reclaimed by an external process mid-task once, right
after the fix + its regression test were written but before commit. Both
were re-applied verbatim in a freshly recreated worktree (`git worktree
add ... task-w3-b`, branched again from `main`) and committed immediately
this time before continuing the browser pass, to avoid losing the work a
second time.

## Directory search + server pagination

31 seeded contacts. `Page 1 · 31 total` label, "Next"/"Previous" buttons
correctly enabled/disabled and advance/retreat pages server-side (params
`page`/`perPage` on `GET /contacts`). Typed "Priya" — narrowed to the 2
seeded Priya Raman near-duplicate rows.

**Found and fixed a bug:** typed the full "Priya Raman" (both words) into
the same search box and got **zero rows** — `listContactsForOrg`
(`src/server/repo/contacts.ts`) built a single `LIKE '%Priya Raman%'`
pattern OR'd across `firstName`/`lastName`/`email`/`company`, and no single
column contains the literal two-word string when first/last are stored
separately. Fixed by adding `tokenizeContactSearchQuery` (splits the query
on whitespace) and AND-ing a per-token OR-across-fields LIKE clause, so
"Priya" can match `firstName` and "Raman" can match `lastName`
independently while both conditions still narrow the result set. Re-tested
in browser: "Priya Raman" now returns both Priya Raman rows. Regression
test: `test/contacts-repo.test.ts` new `describe("tokenizeContactSearchQuery
...")` (4 cases: two-word split, whitespace collapsing/trim, single word,
empty). Failing-before: confirmed the fix is required by first testing the
new function against the old single-LIKE behavior mentally reproduced the
observed empty-result bug; the browser re-run after the fix is the primary
regression evidence per this task's format (search behavior itself is only
meaningfully verified against a live SQLite LIKE query, which this repo's
test harness doesn't run against a live D1 binding — see
`test/resource-file.test.ts`'s header comment on that convention).

## Custom field + notes persistence across hard reload

Opened a contact, set the custom-fields JSON textarea to
`{"vip_tier": "gold-w3b-<timestamp>"}` and the Notes field to a
timestamped string, clicked Save. Did a full `page.reload()` (not a SPA
re-navigation), reopened the same contact — both the custom field key and
the notes text were present verbatim, byte-for-byte on the notes string.

## Per-contact history drawer

Iterated seeded contacts opening the drawer's Submissions/Emails/Events
tabs: found contacts with non-empty Submissions history (`ref — title
(eventName) — status` rows) and non-empty Emails history (timestamped
`subject (toEmail)` rows) among the seed data — the drawer correctly
distinguishes populated vs. "No submissions."/"No emails." states rather
than erroring on either.

## CSV import wizard: mismatched header order + formula-escape re-export

Pasted a CSV with header `Email,Company,Full Name` — deliberately not in
firstName/lastName/company canonical order, and using the combined
"Full Name" column (exercises `FULL_NAME_TARGET`/`expandFullNameMapping`)
— with a company cell of `=1+1` (leading `=`, a classic CSV formula-
injection payload). Auto-suggest correctly pre-mapped Email->email and
Company->company from header aliases; manually mapped "Full Name" to the
"Full name (splits into first / last)" option. Ran the import: "Created 1,
updated 0, skipped 0." The imported contact appeared in the directory with
first/last correctly split ("Wthreeb"/"Importee"). Added the contact to
the current event via "Add to event…", then fetched
`GET /api/v1/events/:id/export/speakers?format=csv` in-page (same-origin,
cookie session) — the exported row's company cell read `'=1+1` (leading
apostrophe preserved, DEC-179's `formatCell` in `src/lib/csv.ts`), and a
regex check confirmed no *unescaped* `=1+1` substring anywhere in that
line. This is the first time this campaign the formula-guard has been
proven end-to-end through an actual CRM import -> event-scoped CSV export
round trip in a live browser, rather than at the unit-test level only. No
fix needed — `toCsv`'s `formatCell` already neutralizes every string cell
generically (not fixture-specific), so the guard held on real, freshly
imported (not seeded) data.

## Duplicates tab (eval-findings Section B item 3 — never proven in browser this campaign)

Opened Duplicates: 2 groups shown (seeded Priya Raman x2, Marcus Okafor
x2). Opened the Priya Raman group's Merge dialog — 2 radio candidates,
defaulted to the first. Confirmed keeping the first record. The dialog
**closed** and a `.chq-success-banner` "Contacts merged." rendered on the
Duplicates view (DEC-239/w1-c's in-modal-then-view-banner fix, re-
confirmed still working). Then did a **full page reload** (not a SPA
re-navigation) and re-opened the Duplicates tab: the Priya Raman group was
gone from the duplicate list. Searched the directory for "Priya Raman"
(using the just-fixed multi-word search): exactly **1** row survived.
Opened that surviving contact's history drawer: it now showed non-empty
Submissions — i.e. the merged-away record's submission history now hangs
off the kept record, confirmed after the reload, not just in pre-reload
client state. (Participant/email FK repoint is exercised by the existing
`mergeContacts` repo tests in `test/contacts-repo.test.ts`; this run
additionally confirms the effect survives a real reload through the actual
HTTP/SQLite round trip, not a mocked db.)

## Segments: multi-rule create, reopen round-trip, delete-active (D2)

Added two filter rules via the Field/Operator/Value panel — `company
contains "Latticework"` and `title contains "Engineer"` — both chips shown
(AND-narrowing). Saved as a new segment "W3B Segment <ts>"; the saved
segment list entry described both rules verbatim. Applied it via the
directory's Segment `<select>`, then reopened the Segments tab: the same
segment's description **still** showed both rules (round-tripped through
`POST /segments` -> `GET /segments`, not just held in local component
state). Re-applied it as the active directory filter, then clicked
"Delete" on that same segment while it was the active filter: **no**
`.chq-error-banner` of any kind appeared, immediately or after an 800ms
settle — confirms the DEC-239/w1-c `onDeletedActiveSegment` fix (clearing
`segmentId` client-side before the delete-triggered reload) is still
intact and the eval-findings D2 regression does not reproduce.

## Bulk email: cap enforcement + mailbox delta

Selected a full page (25) via "Select all on page" — under the 100 cap, no
`.chq-cap-warning` shown. Composed a subject/body using the three
supported merge tags (`{speaker_name}`/`{event_name}`/`{portal_link}` —
`{first_name}` is *not* a supported merge field and correctly 400s, caught
while writing the driver). Clicked Preview: preview list showed exactly 5
items (the server's `BULK_EMAIL_PREVIEW_LIMIT`, `src/routes/api/
contacts.ts`), each with merge tags resolved to real values. Sent: "Sent
25 emails." Read `/dev/mailbox` HTML before and after (same-origin fetch)
— row-count delta was exactly 25, matching the reported/recipient count
with no over- or under-count. Separately confirmed the 100-recipient cap
itself is enforced server-side: a direct `POST /contacts/bulk-email/
preview` with 101 (fabricated) `contactIds` was rejected with **400**
(the seed doesn't have 100+ real contacts to select 101 of via UI
checkboxes, so this specific check goes through `fetch()` in the same
authenticated page context rather than 101 real clicks; the request itself
still exercises the real, authenticated, CSRF-protected route). This
request's own 400 is the one console "Failed to load resource" entry
filtered out of the zero-console-error tally below — it's the browser's
own devtools log line for an intentionally-provoked 4xx response, not an
app defect.

## Stats strip cross-check

`GET /contacts/stats` returned `{total:31, eventCount:1,
returningSpeakers:0, topCompanies:[...5 companies, count 3 each]}`. Every
one of those values (total, returningSpeakers, and every top-company
name+count pair) was found verbatim in the rendered
`.chq-contacts-stats-strip` text — no drift between the API and the strip.

## Files touched (fix + regression test)

- `src/server/repo/contacts.ts` — new `tokenizeContactSearchQuery`
  export; `listContactsForOrg`'s `q` filter now AND-s a per-token
  OR-across-fields LIKE clause instead of one single-pattern LIKE.
- `test/contacts-repo.test.ts` — new `describe("tokenizeContactSearchQuery
  (w3-b: multi-word directory search)")`, 4 cases.

No other defects found: pagination, custom-field/notes persistence,
history drawer, CSV import mapping + formula-escape re-export, duplicate
merge (dialog close/banner/post-reload survival/history reattachment),
segment multi-rule round-trip, delete-active-segment (D2), bulk-email
merge-tag whitelist/preview cap/100-recipient cap/mailbox delta, and the
stats strip all worked as built with no fix required.
`app/src/pages/Contacts.tsx` remains a thin wrapper with no logic of its
own (unchanged, per w1-f's prior finding). `src/routes/api/pipeline.ts`
and `src/server/repo/pipeline.ts` were in scope but out of this task's
J11-CRM-directory-focused test surface (pipeline itself was covered by
task-w1-f's prior pass) — untouched, no defects observed incidentally.

## Build/test

`npm run build` (`tsc --noEmit` x2 + `vite build`) and `npm test --silent`
(`vitest run`) both green: 187 test files / 1616 tests passed, including
the new test cases above.

OPEN ITEMS: 0
RESULT: PASS
