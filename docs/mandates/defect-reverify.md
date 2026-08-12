# Defect re-verification — redesigned build (local, http://127.0.0.1:8899)

Re-verified against the current local snapshot (event `devflow-conf-2027`). Original
defects were found on the pre-redesign production build (`eval-defects.md`); this build
has been through ~38 waves of redesign + hardening since. Verdicts: FIXED / STILL-OPEN /
PARTIALLY-FIXED / CANNOT-VERIFY.

Methodology: EMB public-widgets and both Wave-1 P1s were verified directly (Playwright +
curl). Wave-1 P2 review/CRM findings, Wave-2 ABS/AIA, and Wave-2 SPK/CNT were each verified
by a separate parallel agent driving the same local build with Playwright; SPK-S1-D3 (CSV
import bio overwrite) was independently re-confirmed directly after the agent reported
CANNOT-VERIFY on it.

## EMB area — public widgets (verified directly)

| # | Defect | Severity | Verdict | Evidence |
|---|---|---|---|---|
| EMB-1 | No Format shown on any public surface (session card/detail, agenda detail) | Rubric-required (EMB-08) | STILL-OPEN | Session detail (`/e/devflow-conf-2027/sessions/seed_submission_0025`) and agenda session detail show track/time/room/speaker/description but no Format field; confirmed absent from the embed `.json` payload too (no `format` key in any item). |
| EMB-2 | Gallery cards omit job title/company | Rubric-required (EMB-12) | STILL-OPEN | `/e/devflow-conf-2027/gallery` explicitly states "Headshots only, no session details" and shows only headshot+name for all 9 speakers; `/speakers` directory shows title/company correctly for comparison. |
| EMB-3 | Agenda time gutter renders empty | Rubric-required (EMB-06) | STILL-OPEN | Screenshot of `/e/devflow-conf-2027/agenda`: the left ~70px column is blank on every row; times only appear inline inside each session block. |
| EMB-4 | Agenda blocks overflow rows, clip speaker line / itinerary checkbox | Likely-fixed-verify | STILL-OPEN | Screenshot confirms text still clipped mid-line (e.g. "Alex Delgado (Software Eng...)" cut off) on both `/agenda` and `/schedule`; on `/schedule` the "Add to itinerary" checkbox is clipped out of view for 3 of 4 visible blocks. |
| EMB-5 | `day` filter ignored on sessions embed | Functional bug | STILL-OPEN | `curl .../embed/devflow-conf-2027/sessions.json?day=2027-05-12` still returns `"total": 9` (all sessions, unfiltered), identical to unfiltered response. |
| EMB-6 | `fields=` ignored by `.json` format | Functional bug | STILL-OPEN | `curl .../sessions.json?fields=track,time,room,speaker` still returns full objects including `description`, `id`, `ref`, `icsSequence`, etc. — field selection has no effect. |
| EMB-7 | Track filter links inside chromeless embed point at full-chrome public pages | Functional bug | STILL-OPEN | `/embed/devflow-conf-2027/sessions` track-filter and session-title links all point to `/e/devflow-conf-2027/...` (full chrome), not `/embed/...` — would still break out of an iframe. |
| EMB-8 | "Copy snippet" gives no confirmation | Trivial/P3-ish | STILL-OPEN | Clicked "Copy snippet" in the admin embed builder (`/admin/settings`); button label unchanged, no toast, no `[role=status]`/`[aria-live]` element appeared anywhere on the page. |
| EMB-9 | Landing page "Public sessions" points at wrong (empty) event | Demo-data hygiene, not a code bug | FIXED | Root `/` link now points at `/e/devflow-conf-2027/sessions` (the populated event), not `forward-summit-2028`. |

## CFP/CRM P1s (verified directly)

| ID | Severity | Verdict | Evidence |
|---|---|---|---|
| P1 — speaker can't see own submission | P1 | FIXED | Logged in as speaker (sbek-speaker@example.com), submitted the public CFP form using that exact login email. New submission (SES-031) appeared immediately in `/portal` "My submissions" alongside existing ones. Checked Contacts directory afterward: only ONE contact exists for sbek-speaker@example.com (Priya Raman) — no duplicate contact was created. Both parts of the original two-part fix appear in place. |
| P1 — "Sent 0 emails." reporting | P1 | PARTIALLY-FIXED / CANNOT-FULLY-VERIFY | Sent a 3-recipient batch via Comms compose wizard to `@example-speakers.test` addresses (reserved-ish domain): result screen said "Sent 3 emails." and Comms > History now shows a **per-recipient row with an individual status** ("sent") for each send, including a prior send to the reserved `example.com` speaker address — this per-recipient status breakdown did not exist before. However, on this local snapshot the dev mailbox intercepts and "delivers" everything, so no send actually fails locally — I could not trigger/observe the "N undeliverable — reserved test domain" copy the fix calls for, since there's nothing local that produces a failure to report. Reporting infrastructure (per-recipient status) is visibly improved; the specific undeliverable-domain copy is unverified. |

## Wave 1 — Review + CRM findings (P2s)

| Defect | Severity | Verdict | Evidence |
|---|---|---|---|
| Reviewer comments not surfaced anywhere in organizer UI | P2 | STILL-OPEN | Reviewer submitted a scorecard on SES-031 with a free-text comment (confirmed persisted). Organizer submission detail page has no reviews/comments section at all; plan Results page shows only averages/per-criterion scores/recommendation tally — comment text appears nowhere. |
| Progress counts wrong (e.g. "Assigned 1 / Completed 8") | P2 | FIXED | Progress page now shows internally-consistent counts for all 4 reviewers (e.g. "8 of 13", "10 of 13") — completed never exceeds assigned. |
| Organizer opening a reviewer-scorecard route renders empty `<main>` | P2 | STILL-OPEN | Organizer navigated to a reviewer scorecard URL; page loads full nav/header but `<main>` has zero content — no error, no redirect, no "not authorized" state. Same soft-404 as before. |
| Scorecard prints "Speakers:" label with no value when plan not anonymised | P2 | FIXED | With anonymize-toggle OFF on the plan, reviewer's scorecard now shows "Speakers: Priya Raman" — actual name renders correctly. |
| Assign-by-submission requires raw internal id, rejects human ref | P2 | STILL-OPEN | "One submission" assignment mode is still a plain text box (placeholder "Submission id", no autocomplete/picker); typing "SES-001" produces error "Invalid reviewer assignment." |
| First click on reviewer "Remove" no-ops, second click works | P2 | FIXED | Removing a reviewer assignment worked on the first click; row count dropped immediately and removal persisted after reload. |
| Reviewers see "New event…" in event switcher | P2 | STILL-OPEN | Logged in as reviewer: header event-switcher still lists "New event…" as a selectable option alongside the actual event. |
| Status vocabulary differs by surface (Pending vs Under review) | P2 | STILL-OPEN | Same submission (SES-031): organizer view shows "Pending", speaker portal shows "Under review." |
| No manual "New contact" control in Contacts | P2 | STILL-OPEN | Directory/Duplicates/Segments/Pipeline tabs all checked — only "Import CSV" exists, no create-contact button anywhere. |
| Custom fields are untyped key/value pairs | P2 | STILL-OPEN | Contact detail "Custom fields" section is still a free-text Key + Value input pair with no type/dropdown selector. |
| Merge collapses one pair per invocation (3-way group needs two passes) | P2 | CANNOT-VERIFY | Current seed data only contains 2-person duplicate pairs (Priya Raman x2, Marcus Okafor x2) — no natural 3+ duplicate cluster exists locally to test against; not forced per task instructions. |
| Changing directory search clears checkbox selection | P2 | FIXED | Selected 3 contacts ("3 selected"), typed into search box — selection and counter both persisted through the search-driven re-render. |

## Wave 2 — ABS + AIA

| Defect | Severity | Verdict | Evidence |
|---|---|---|---|
| ABS-S2-D1 — "Assign by track" silently assigns ALL submissions in the track | P1 | STILL-OPEN | Track "AI Engineering" has 13 submissions. Used plan Assign form (scope="One track") → picked AI Engineering → Assign: no preview/count/confirm dialog fired (confirmed via `page.on('dialog')` listener, none triggered); new reviewer immediately showed "0 of 13" — all 13 assigned in one shot, no bounding/picker within track scope. Unbounded fan-out unchanged from original. |
| ABS-S1-D1 — speakers cannot self-add co-authors | P2 | STILL-OPEN | No co-author control on public submit form, portal submission detail, or portal edit view. Admin "Add co-presenter" still assigns Role="speaker" (no distinct co-author label). Added Bailey Kowalski as co-presenter on an accepted+content-approved session; their public speaker page still shows "Sessions (1)" — the added co-presentation never surfaces publicly. |
| ABS-S2-D2 — "Remind laggards" reports "sent to 0 reviewer(s)" | P2 | FIXED | "Remind laggards (2)" produced "Reminder sent to 2 reviewer(s)." — matches the laggard badge count exactly. Reproduced twice, same result both times. |
| ABS-S3-D1 — reopening a submitted review shows a blank scorecard | P2 | FIXED | Submitted scorecard (4/5, Recommendation=Approve, comment) on SES-025; reloading the URL shows all fields correctly pre-populated and "You already rated this submission... Update rating" state. |
| ABS-S3-D2 — results-table sort indicator inverted | P2 | FIXED | Clicking "AVERAGE" column header once shows ▲ with true ascending order (0.00→4.33); clicking again shows ▼ with true descending order (4.33→0.00). Indicator now matches actual sort direction both ways. |
| AIA-S1-D1 / SPK-S1-D2 — agenda grid exposes zero interactive targets to a11y tree | P1 | STILL-OPEN | `/admin/agenda` a11y snapshot: only 16 interactive nodes total (nav, event switcher, sign-out, Auto-schedule, Publish, 3 day tabs) — every session card and the entire grid collapse into a single plain `text:` node with zero role/tabindex/href. 40-press keyboard Tab walk never reaches a card or grid cell, just loops through the same 16 elements. Searched DOM for "Place at" text at desktop (1600×1000) and mobile (390×844) viewports: 0 matches at either size — the claimed accessible per-item "Place at HH:MM" placement pattern does not exist in this build. Unchanged reproduction of the original WCAG 2.1.1 failure. |
| AIA-S2-D1 — publish reports raw placed-count as if all public, no breakdown | P2 | STILL-OPEN | Publish message is a flat "Schedule live — 5 sessions public." with no placed/public/held-back breakdown. Forced a content-approval gate by reverting one placed session to "changes_requested" and re-publishing: message stayed "...5 sessions public" (unchanged/wrong) while the actual public agenda rendered only 4 sessions (the gated one silently dropped, its room column collapsing to "TBD"). Same honesty gap as originally reported. |

## Wave 2 — SPK + CNT

| Defect | Severity | Verdict | Evidence |
|---|---|---|---|
| SPK-S3-D1 — bulk email recipient multi-select silently caps at 4 | P1 | FIXED | Comms compose selected 11/11 submissions; Contacts bulk-email selected 25/25 contacts (individual clicks and select-all) — no cap observed in either place. |
| SPK-S1-D1 — "New task" button on Admin > Speakers does nothing | P2 | FIXED | Click now opens a full modal (Kind/Task/Description/Due date/Required/Assign-to-all) with a working Create button. |
| SPK-S1-D2 / AIA-S1-D1 — agenda grid has no accessible click targets for placing sessions | P2/CRITICAL | STILL-OPEN | Same underlying defect as AIA-S1-D1 above, confirmed independently: a11y snapshot of `/admin/agenda` shows the grid + session cards collapse to plain text nodes; unscheduled cards expose only a drag-handle icon, no "Place at HH:MM" control. UI literally instructs "Drag to a slot" — no keyboard-operable alternative exists. |
| SPK-S1-D3 — CSV import silently overwrites existing contact fields (bio) with no warning | P2 | STILL-OPEN | Confirmed directly: re-imported Priya Raman's own email via CSV paste with `bio=REVERIFY-BIO-OVERWRITE-TEST-VALUE`; the column-mapping step auto-mapped `bio→bio` with no warning; import result was a flat "Created 0, updated 1, skipped 0." with no field-conflict prompt; contact detail's bio textarea afterward held the new value, confirming silent overwrite. |
| SPK-S2-D1 — headshot upload in portal discards unsaved bio edits | P2 | STILL-OPEN | In `/portal/profile`, typed unsaved bio text then uploaded a new headshot — headshot updated but bio field silently reverted to the last-saved server value. |
| CNT-D4 — headshot upload with unsaved bio silently closes dialog and discards text (admin side) | P2 | STILL-OPEN | In the admin contact drawer, typed unsaved bio then set a headshot file input — the entire drawer closed/reset; reopening showed bio still blank (never saved). Worse manifestation than SPK-S2-D1 (full panel close vs. field revert), same family. |
| CNT-D1 — Files library "versions and comments" action is dead | P1 | FIXED | "Open X versions and comments" in admin Content > Files now navigates to a full submission detail view showing v1/v2 downloads and real threaded comment history — no longer a dead click. |
| CNT-D2 — speaker's file comment disappears after uploading a new version | P2 | STILL-OPEN | As speaker, commented on a deliverable, then uploaded a new version. Speaker UI showed "No comments yet." Cross-checked via the now-working CNT-D1 admin panel: comment is genuinely gone server-side too (only the 2 original seeded comments remained) — confirmed real data loss, not just a display bug. |
| CNT-D3 — no version-history UI in the speaker portal | P2 | STILL-OPEN | After uploading a new file version, portal shows only the latest version with a "Replace file" button — no way to view or list v1 from the portal. |
| CNT-D5 — bulk "Download ZIP" gives zero feedback | P2 | STILL-OPEN | Selected all files and clicked "Download ZIP (3)" — a valid ZIP does download (1426 bytes), but no toast/dialog/spinner/button-state change appears in-page; only the browser's silent native download fires. |
| CNT-D6 — quick "New submission" modal lacks Track/Format, Edit can't add them later | P2 | STILL-OPEN | Quick-create modal only has Title/Description/Speaker email/First/Last name. New submission's Edit view exposes only Title/Abstract; Tracks section shows "No tracks assigned" with no control to add one — Track/Format only ever populate via the full public CFP form. |

---

## Summary

**41 defects re-verified** (all P1/P2 from `eval-defects.md`, plus the trivial P3
"Copy snippet" check and the demo-data-hygiene item, checked in passing).

| Verdict | Count |
|---|---|
| FIXED | 12 |
| STILL-OPEN | 27 |
| PARTIALLY-FIXED | 1 |
| CANNOT-VERIFY | 1 |

### FIXED (12)
EMB-9 (landing page points at populated event) · P1 portal submission visibility ·
Review progress counts · Scorecard "Speakers:" label (non-anonymised) · Reviewer
"Remove" double-click · Directory search clearing selection · ABS-S2-D2 (remind
laggards) · ABS-S3-D1 (reopened scorecard blank) · ABS-S3-D2 (sort indicator
inverted) · SPK-S3-D1 (bulk email 4-recipient cap) · SPK-S1-D1 ("New task" button) ·
CNT-D1 (Files versions/comments panel)

### STILL-OPEN (27)
EMB-1 (no Format anywhere) · EMB-2 (gallery omits title/company) · EMB-3 (empty time
gutter) · EMB-4 (agenda/schedule block clipping) · EMB-5 (day filter ignored on
sessions embed) · EMB-6 (fields= ignored in .json) · EMB-7 (embed links break
chrome) · EMB-8 (copy snippet no confirmation) · Reviewer comments not surfaced ·
Organizer→reviewer-scorecard route renders blank `<main>` · Assign-by-submission
raw-id text box · Reviewers see "New event…" · Status vocabulary mismatch
(Pending/Under review) · No manual "New contact" control · Untyped custom fields ·
**P1 ABS-S2-D1** (assign-by-track unbounded fan-out) · ABS-S1-D1 (no speaker
self-add co-author) · **P1 AIA-S1-D1 / P2-CRITICAL SPK-S1-D2** (agenda a11y: zero
interactive targets, no "Place at HH:MM" pattern exists) · AIA-S2-D1 (publish count
vs public count dishonesty) · SPK-S1-D3 (CSV import silently overwrites bio,
confirmed directly) · SPK-S2-D1 (portal headshot upload discards unsaved bio) ·
CNT-D4 (admin headshot upload discards unsaved bio, worse: closes whole drawer) ·
CNT-D2 (speaker file comment lost across versions — confirmed real server-side data
loss, not just display) · CNT-D3 (no version-history UI in portal) · CNT-D5 (bulk
ZIP download gives no feedback) · CNT-D6 (quick New-submission modal lacks
Track/Format, uneditable later)

### PARTIALLY-FIXED (1)
"Sent 0 emails." reporting — per-recipient status now shown in Comms History
(previously absent); local dev-mailbox sends always succeed so the specific
"N undeliverable — reserved test domain" copy could not be triggered/observed
locally. Reporting infra is visibly improved; the exact fix copy is unverified.

### CANNOT-VERIFY (1)
CRM merge collapses one pair per invocation — no natural 3+-way duplicate cluster
exists in current seed data to test against; not forced.
