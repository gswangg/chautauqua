# Manual verification checklist

Target: http://localhost:8890
Run: runs/2026-08-17T00-28-29

These rubric items could not be verified automatically (or only half-verified).
For each item: perform the check, then record the result in `manual-results.json`
and run `pnpm run finalize -- --run runs/2026-08-17T00-28-29` to fold it into the final score.

## Abstract Management (Review Depth & Disposition)

### ABS-07 (weight 2) — With anonymization enabled on a round, the reviewer's view hides author and co-author identity while the organizer's view of the same submission shows it.

- Pass when: A per-round anonymization/blind setting exists (ABS-S2 step 4) and the blinded reviewer view of 'Taming 40-Minute CI' contains none of 'Priya Raman', 'Marcus Okafor', or 'Latticework Systems', while the organizer view (ABS-S3 step 10) shows them; author names leaking anywhere in the reviewer view fails.
- How to verify: Cross-reviewer isolation needs a second simultaneous account: invite a second reviewer you control to the same round, assign them 'Taming 40-Minute CI', log in as them in a separate browser, and confirm they cannot see Sam Whitfield's scores or comments before submitting their own.
- Auto-judge said: pass — A per-plan anonymization setting exists ('Hide speaker names from reviewers — Reviewers see the abstract and track only', visible in the plan editor images 16-18) and the agent checked it for Initial Review (S2 turn 15). On the reviewer side the agent scanned the full blinded review page for 'Taming 40-Minute CI' and recorded that no author name, co-author name or company appeared, with explicit UI text 'The speaker's name and company are hidden while this plan is anonymised' (turn 10-11). The organizer view of the same submission shows 'Priya Raman · Latticework Systems · Principal Engineer' and Marcus Okafor in the participants/results rows (images 33, 28). Confidence is medium only because the blinded reviewer screenshot (007) was not attached for direct inspection; the transcript observation is explicit.

### ABS-09 (weight 1) — Organizer can select reviewers with outstanding reviews and send them a bulk reminder from the progress or reviewer view.

- Pass when: A reminder/nudge action is available against the lagging reviewer (Sam at 0 of 2 complete), and triggering it reports success (confirmation toast, sent status, or log entry).
- How to verify: Check the sam.reviewer@sbek-test.example.com inbox (or the clone's outbound-mail log if it exposes one) and confirm a reminder email arrived referencing the pending reviews.
- Auto-judge said: pass — The progress view exposes bulk nudge actions targeting outstanding reviewers: 'Remind laggards (1)' and 'Remind the 1 not started' (image 22). Triggering it produced a success toast 'Sent: 1. Skipped: 0. Remaining: 0.' (image 23) and a Comms History entry 'Reminder: Initial Review review queue — 1 sent' at 16 Aug 20:48 (image 25). After the reviews completed the control correctly reads 'Remind laggards (0)' (image 37).

### ABS-13 (weight 2) — Review scores and statuses can be exported to a downloadable file (CSV/XLSX) from the results or reports area.

- Pass when: An export/download control exists for review results and triggering it initiates a download or reports success without error.
- How to verify: Trigger the export yourself, open the downloaded file, and verify it contains one row per submission with title, per-criterion or aggregate scores, recommendation, and review status matching the on-screen results table (Taming 40-Minute CI with Originality 4 / Relevance 2 / Accept; Your AI Pair Programmer with 5 / 5 / Accept).
- Auto-judge said: pass — Export controls exist in the review area: 'Download CSV' on the plan results page (images 28, 38) and 'Export results CSV' on the Review plans index (image 20), plus 'Export CSV' in Comms history. The agent triggered the results Download CSV link (pointing at /api/v1/plans/{id}/results?format=csv&round=1); the click produced no error and did not navigate away, consistent with a Content-Disposition download. Gap named: no in-app confirmation toast or filename was rendered and the downloaded file's contents could not be inspected, so only the UI-observable half is verified.

### ABS-14 (weight 1) — If the clone claims AI-assisted triage, an AI evaluator produces a first-pass numeric score with written reasoning on a submission, and a human override persists distinguishably.

- Pass when: An AI evaluation feature exists and yields a numeric score plus rationale text attributed to the AI on 'Taming 40-Minute CI'; the results view distinguishes AI from human scores; an admin override to a different value persists after reload. Judge this item only if the clone claims AI review anywhere in its UI or marketing; otherwise score as not applicable per the agent's recorded observation of absence.
- How to verify: Read the AI-generated rationale and confirm it is substantive and specific to the abstract's actual content (mentions CI/builds/monorepo concepts) rather than generic boilerplate reusable on any submission.
- Auto-judge said: not_found — Nothing in any captured surface claims or provides AI-assisted triage: the plan editor (criteria, weights, rating scale, anonymization) has no AI evaluator option, the reviewer queue and scoring form contain only human criteria, and the results table's reviews expander attributes every score to a human reviewer ('Sam Whitfield ... Initial Review · Round 1') with no AI-vs-human distinction or AI rationale text. Per the rubric, absent an AI claim the item is not applicable; no AI feature was found. Note the agent did not record an explicit dedicated search, so a hidden AI feature cannot be fully excluded.

## Call for Papers

### CFP-04 (weight 2) — The portal enforces the configured submission window: once the close date is in the past, the public portal blocks new submissions with a closed state

- Pass when: After the organizer sets the close date to a past date, the logged-out portal shows a closed/'submissions closed' state with no way to start or submit a new proposal
- How to verify: (agent could not reach this — verify by hand: Screenshot of the close-date setting saved with a past date; logged-out screenshot of the portal in its closed state (contrast with the open-portal screenshot from CFP-S1))
- Auto-judge said: cannot_judge — Neither scenario ever set the close date to a past date (CFP-S1 saved the fixture close date and then hit the 70-turn limit; CFP-S4 also hit the turn limit before the close-the-CFP step). There is no screenshot or observation of the logged-out portal in a closed state, so the enforcement of a past close date is untested rather than absent.

### CFP-08 (weight 1) — Submitting a proposal triggers an automated confirmation email to the submitter referencing the submission

- Pass when: A confirmation email arrives at the submitter's address within a few minutes of submitting, referencing the event and the submitted title; if the clone exposes an in-app email log/outbox, a logged message with correct recipient and title also passes
- How to verify: Submit a proposal using an inbox you can inspect (e.g. re-run the CFP-S2 submission with a real mailbox address, or use the clone's email log/outbox page if it has one). Within a few minutes, verify an email arrived that names the event and the submitted talk title. Capture a screenshot of the message showing recipient, subject, and title. Also note whether the CFP-S2 confirmation screen claimed an email was sent.


### CFP-13 (weight 2) — Decision statuses propagate to the submitter: the speaker's own dashboard reflects Accepted/Rejected for the corresponding proposals

- Pass when: Signed in as Priya Raman after decisions were recorded, her dashboard shows the CI talk as Accepted and the AI talk as Rejected (or unambiguous equivalents of those statuses)
- How to verify: (agent could not reach this — verify by hand: Screenshot of the speaker dashboard with both status labels visible; recorded exact status wording)
- Auto-judge said: cannot_judge — The only speaker-dashboard evidence (CFP-S2) predates the accept/reject decisions and shows both proposals as 'UNDER REVIEW'. CFP-S4 hit the 70-turn limit before signing back in as Priya Raman, so no post-decision speaker view was captured. Propagation is untested, not shown absent.

### CFP-14 (weight 2) — The platform can send (or queue) acceptance and rejection notification emails to decided submitters, with the UI confirming dispatch

- Pass when: A notify/send-decisions action exists, accepts or provides accept/reject templates (merge-field support like {speaker_name}/{talk_title} is a plus, inferred), and after triggering it the UI reports the messages as sent/queued for the correct recipient sets; NOT auto-verified: actual delivery and body personalization
- How to verify: After decisions are recorded, trigger the decision notifications with submitter addresses that use a real, inspectable inbox. Verify one acceptance email and one rejection email arrive, each naming the correct talk title (and speaker name if templates support merge fields). Screenshot both messages.
- Auto-judge said: pass — Judging only the UI-observable half: a Comms compose wizard (Recipients → Template → Preview → Send) exists, offers 'Acceptance Notification' and 'Decline Notification' templates, filters recipients by decision status, and after sending reports 'SEND COMPLETE — 1 of 1 speakers were emailed' with template, subject line and 'Sent: Just now, by you'. The history log lists both dispatches ('Your talk has been accepted to DevFlow Conf 2027' and 'Update on your submission to DevFlow Conf 2027', 1 sent each). Actual delivery/body personalization is not auto-verified by design.

### CFP-16 (weight 2) — Submission editing locks after the CFP close date: the speaker can no longer modify a submission once the call is closed

- Pass when: With the close date in the past, the speaker's submission opens read-only, hides its edit affordance, or shows an editing-closed message — and no edit can be saved
- How to verify: (agent could not reach this — verify by hand: Speaker-side screenshot of the locked/read-only submission (or editing-closed message), taken after the close date was moved to the past — contrast with the successful edit in CFP-S2)
- Auto-judge said: cannot_judge — The close date was never moved into the past during either run (both organizer scenarios hit the turn limit first), so the speaker-side lock could not be tested. The only speaker edit evidence is from the open-CFP state, where editing worked and the page said 'You can change this until the form closes on Thu 29 Apr 2027'.

### CFP-18 (weight 2) — Event data is scoped per event: submissions, sessions and speakers belonging to one event do not appear inside another event

- Pass when: The second event's submissions/abstracts area is empty (or contains only its own records) rather than showing the first event's submissions. Cross-event leakage of records is a fail
- How to verify: Only if the agent could not create a second event but the app does support multiple events: create two events by hand, add a submission to one, and confirm it is not visible from the other.
- Auto-judge said: cannot_judge — Because the second event was never successfully created (CFP-S1 ended at the New event modal with a validation error), no second-event submissions/abstracts area was ever visited, so cross-event scoping could not be observed either way.

## Content Management & Speaker Deliverables

### CNT-08 (weight 2) — Organizer can trigger bulk reminder emails to speakers with outstanding tasks and receives a send confirmation.

- Pass when: A bulk reminder action is available from the dashboard for incomplete/outstanding tasks (with or without a template picker) and the UI confirms the send (toast, dialog, or sent count). Actual delivery is verified manually.
- How to verify: Check the inboxes for the fixture speaker addresses (Priya Raman and Marcus Okafor at sbek-test.example.com) or, if those are not real mailboxes, the clone's outbound-mail log / mail-catcher. Confirm each speaker with outstanding tasks received a reminder naming the outstanding task ("Upload Final Headshot (print quality)" and, for Marcus, "Upload Session Presentation") and its due date.
- Auto-judge said: pass — UI-observable half is satisfied: the deliverables dashboard exposes "Remind all outstanding" (plus per-speaker "Remind X" and "Remind this task" actions and a "skips anyone reminded in the last hour" note). Invoking it opened a "Review reminders" dialog listing 15 recipients with a draft template, and after sending the UI showed a "Sent to 15 contacts" confirmation toast. Actual delivery is out of scope. Confidence medium because the dialog/toast screenshots are described in the transcript but not attached.

### CNT-14 (weight 2) — Organizer can multi-select sessions/files and generate a bulk download (ZIP) of latest file versions, with grouping options if offered.

- Pass when: The UI supports selecting multiple sessions/files and starting an export, and confirms generation (queued/generating/ready state or download start). Grouping options and file deselection are positive evidence but optional. ZIP contents are verified manually.
- How to verify: Trigger the same export as an organizer, download the resulting ZIP (via the ready link or the email notification if the clone sends one), and verify it contains only the LATEST version of slides.pdf (the second upload), is organized according to the chosen grouping (e.g. one folder per session), and excludes any file deselected in the dialog.
- Auto-judge said: partial — A bulk ZIP export affordance exists in the files library ("Download all 23 (.zip)" alongside type filters Slides·18 / Poster·1 / Headshot·4 that can narrow the set), which is positive evidence for the UI half. But no multi-select controls (per-row checkboxes) are visible in the captured library, the export was never invoked, and no grouping dialog or generation/queued/ready confirmation was observed — the organizer scenario ended at the turn limit before this step.

## Public & Embeddable Widgets

### EMB-11 (weight 1) — The personal schedule persists across a full page reload, and an export/add-to-calendar affordance is offered for the selection

- Pass when: After a browser reload the previously added sessions are still marked/present in the personal view (via localStorage or an account); an export/iCal/add-to-calendar control exists and reports success when activated — the downloaded file's correctness is the manual half
- How to verify: In a normal browser, add 2 sessions to the personal schedule, trigger the export/add-to-calendar action, and download the .ics (or open the calendar link). Import it into a calendar app and confirm both sessions appear with the correct titles, dates (event days 2027-05-12..14), start/end times, and rooms/locations. Also revisit the widget the next day (or in a new tab of the same profile) to confirm longer-term persistence.
- Auto-judge said: pass — UI-observable half satisfied: after a fresh navigation/reload back to /e/devflow-conf-2027/schedule the page still showed '2 saved in this browser · no account needed' with both sessions intact (localStorage-backed, explicitly labelled 'no account needed'), and a 'Download .ics' export affordance is present in the 'Take it with you' panel with a per-selection URL (/schedule.ics?ids=seed_submission_0010,seed_submission_0001) that also appears on session detail pages. No in-app confirmation toast appears on click (expected for a direct file download); the downloaded file's correctness is the manual half and was not judged.

### EMB-15 (weight 3) — An organizer-side embed area lets the organizer generate a per-widget embeddable snippet or feed URL, with configuration such as output format, branding/colors, content filters, and field selection, and lists saved embeds with a retrievable code snippet

- Pass when: The agent finds an embeds/widgets/share area, sees widget-type choices covering most of the five, configures and saves an embed, and retrieves a generated snippet or feed URL via a Get Code / copy / share affordance — the snippet text must be captured, not merely asserted to exist. Full credit needs multiple output formats (styled HTML script, basic HTML, JSON/XML, iCal) plus filter/field/branding options, and a saved-embed list with per-embed management (naming, enable/disable). Partial credit if an embed area exists but yields only a plain share URL with no configuration, or offers configuration but no retrievable snippet. This item is the primary evidence that the widgets are genuinely embeddable; the snippet actually rendering inside a third-party page is the manual half.

- How to verify: Copy the generated styled-HTML snippet into a blank .html file on a different origin (e.g. a local file or codepen), open it, and confirm the widget renders with live event data, reflects any configured colors/filters/hidden fields, and remains interactive (search/detail). If JSON/XML/iCal formats are offered, fetch each endpoint and confirm the JSON/XML contains session/speaker data and the iCal imports the approved sessions into a calendar app. Also confirm the embed renders for a visitor who is NOT signed in to the organizer account.
- Auto-judge said: pass — Observable half is strongly satisfied. Admin > Settings > Public pages contains a 'Saved embeds' list (2 on · 2 off) with per-embed name, stable URL (/embed/e/<id>), a type/format/filter/field summary line ('Sessions · iframe · AI Engineering · 6 fields', 'Sessions · json · Limit 20 · 4 fields'), ON/OFF state and Edit / Get code / Turn on-off / Delete actions. The builder offers Surface = Sessions, Speakers, Agenda, Schedule, Gallery (all five widgets), Format = iframe/element/link/json/xml, filters (Track, Session format, Room, Day, Search, Limit), field-selection chips and an accent-colour branding field. The agent named and saved 'QA Test Sessions Widget', which appeared in the list as ON, and 'Get code' revealed the snippet captured verbatim in a screenshot and observation: <iframe src="http://localhost:8890/embed/e/kzbabxpphvqtn5ylvvla" ...>. Navigating that URL rendered a working chromeless Sessions widget filtered to Platform & Infra with the configured field set. Only shortfall vs full reference parity: no explicit iCal option in the generic builder (ICS is exposed separately under Your data / the schedule page) and no custom CSS.

### EMB-16 (weight 3) — Widget data is consistent across surfaces and with the organizer-side source — the same session shows identical title, date/time, room, and track everywhere it appears, and matches the organizer's record without republishing

- Pass when: The consistency samples show no mismatches: one session's title/date/time/room/track identical across at least two widgets (EMB-S1), one speaker's name/title/company identical between speakers list and gallery (EMB-S1), and one session's attendee-facing rendering matching its organizer-side record (EMB-S3). Tolerance: a leftover 'UPDATED: ' title prefix from area 04's edit test (whose final revert step may have failed) is NOT a mismatch, provided the prefixed title is identical across surfaces. This point-in-time consistency is the auto half; propagation of organizer edits to an already-placed embed without republishing is the manual half
- How to verify: As the organizer, edit one session's title (or room) in the admin, then reload the attendee-facing widget or the placed embed — using any manual cache-refresh control the clone offers — and confirm the edit appears without regenerating, re-saving, or re-embedding the widget. If the clone documents an auto-refresh interval (SessionBoard's is ~60 min), optionally re-check after that interval to confirm the change also propagates with no manual refresh.
- Auto-judge said: pass — Point-in-time consistency checks show no field mismatches. Session 'Six Minutes, Not Forty: A Monorepo CI Caching Retrospective' renders identically (Thu 13 May, 9:30 / 9:30-10:00, Main Stage, Priya Raman · Principal Engineer, Latticework Systems, Platform & Infra, Talk 30 min) on the sessions list, the agenda grid, the agenda session detail and the speaker's session sublist. Speaker Priya Raman shows the same name/title/company on the speakers list and gallery detail. The organizer record for SES-011 (admin submission page: 'Observability Anti-Patterns We Finally Fixed', Platform & Infra, Lightning Talk 10 min, Wed 12 May 14:00–14:45, Room 2A, Harper Zabala) matches the public session page field-for-field, including abstract text. Only nit: the gallery card omits job title (an omission of a field, not a differing value); propagation of edits to a placed embed is the manual half.

## Speaker CRM (Cross-Event Speaker Database)

### CRM-11 (weight 1) — Bulk email can be composed to multiple selected contacts from the directory, ideally with template/merge-tag personalization and a preview, and the send is confirmed or logged in-app.

- Pass when: AUTO half — selecting 2+ contacts reveals a communicate/send-email action; a composer accepts subject and body; the send completes with an in-app success state or an entry in a sent-history log. Merge-tag resolution shown in a preview and campaign/per-recipient history rows are stronger evidence. The judge cannot verify real delivery from browser evidence alone.
- How to verify: Add a mailbox you control (e.g. a mailinator-style address) as a contact before the bulk send, include it in the recipient selection, then check that inbox: confirm the email arrived, the subject matches "Speak at DevFlow Conf 2027?", and any merge tags resolved to the contact's actual first name rather than rendering literally (no visible "{{first_name}}").
- Auto-judge said: cannot_judge — There are hints that bulk email exists — row checkboxes with the hint 'Tick rows to email contacts in bulk' and an 'Email' button on the contact drawer — but both scenarios hit the turn limit before a composer was opened. No evidence of a composer, subject/body entry, merge-tag preview, send confirmation or sent-history log was captured, so the UI-observable half cannot be assessed.

## Speaker Management

### SPK-03 (weight 2) — Speakers can be bulk-imported from a CSV file

- Pass when: An import control accepts the speakers.csv fixture (with or without a column-mapping step) and the roster afterward contains the CSV speakers. The fixture CSV repeats the two manually added speakers (Priya, Marcus) plus one new person (Dana Kowalski): Dana appearing as a new record is the pass signal, and merging or skipping the two existing rows by email (dedupe) is acceptable and must not be penalized; duplicate rows for Priya/Marcus are also acceptable for this item.
- How to verify: (agent could not reach this — verify by hand: Screenshots of the import flow and the roster before/after showing the new Dana Kowalski row; agent observation if no import control exists (fail).)
- Auto-judge said: cannot_judge — An import path clearly exists in the UI: the Add-speaker dialog contains a link "Import speakers from a CSV" (/admin/contacts?import=1&eventId=...) and the Contacts page shows an "Import CSV" button. However the SPK-S1 run reached its turn limit before the speakers.csv fixture was ever uploaded, and no roster screenshot shows Dana Kowalski. The capability was therefore never exercised — insufficient evidence to score the import outcome.

### SPK-06 (weight 2) — Organizer can send a speaker a portal invitation or onboarding email

- Pass when: An explicit invite/welcome-email control exists (per-speaker or bulk), reports success when triggered, and ideally logs the send in a communications or activity history. Email delivery itself is not agent-verifiable.
- How to verify: Re-run the invite against a speaker whose email is a real inbox you control. Confirm an invitation email arrives containing a portal link, and that the link opens the speaker portal (or a password-set page leading to it).
- Auto-judge said: pass — Explicit per-speaker controls exist on the speaker record ("Email Priya", "Remind Priya") and bulk controls on the roster ("Remind all outstanding", per-row "Remind …"). A bulk send using the pre-built "Speaker Portal Invitation" template reported "SEND COMPLETE — 29 of 33 speakers were emailed" and was recorded in the Comms history (16 Aug 21:02, template Speaker Portal Invitation, 29 sent · 4 skipped) with per-recipient SENT rows.

### SPK-07 (weight 3) — Each speaker gets a personalized portal scoped to only their own content

- Pass when: Logging in as Priya lands on a speaker-facing view (distinct from the organizer admin) that identifies her and lists her own tasks/sessions/profile, with no other speaker's name, tasks, or data visible anywhere in the portal. Any speaker-scoped access mechanism passes (invite link, magic link, or password login), but the agent can only exercise password sign-in/sign-up; if the clone's only portal access is a link delivered by email, the agent cannot reach the portal and this item falls to the manual half.
- How to verify: Only needed if the agent could not reach the portal because access requires an emailed link: re-run the portal invite for a speaker whose email is a real inbox you control, follow the emailed link, and confirm it opens a speaker-scoped portal identifying that speaker, with no other speaker's name, tasks, or data visible anywhere.
- Auto-judge said: pass — Password sign-in as sbek-speaker@example.com landed on /portal, a distinct speaker-facing UI headed "5 things to do" with "PRIYA RAMAN" in the header and footer "Priya Raman · Latticework Systems", listing only her tasks, submissions, session and profile. The agent explicitly re-checked scoping across dashboard, submissions, session detail, profile and tasks and found no Marcus/Dana data — Marcus appears only as legitimate co-presenter on Priya's own shared session.

### SPK-10 (weight 2) — Organizer can see and download a speaker-uploaded deliverable with metadata

- Pass when: The headshot file Priya uploaded via her portal profile edit is listed organizer-side (on her record or a files area) with its filename plus uploader and/or timestamp, and a download/view control responds without error. File content integrity is not agent-verifiable.
- How to verify: As the organizer, download the uploaded file and open it locally; confirm it is a valid image matching the headshot.png fixture rather than a corrupted or empty file.
- Auto-judge said: partial — The headshot is visible organizer-side on Priya's record with a working "Download" control that responded without error, and a separate Files table on the record lists a task attachment (onboarding-deliverable.pdf, 430 B) with a download link. However, the headshot entry shows no filename, uploader or timestamp metadata — the agent explicitly recorded that only a bare Download link exists — so the metadata half of the criterion is unmet.

### SPK-13 (weight 2) — Organizer can send a general bulk email (e.g. a welcome/announcement to all speakers) to a selected or filtered speaker group and the send is logged (deliverables-reminder emails to speakers with outstanding tasks are owned by content-management's CNT-08)

- Pass when: A compose flow lets the organizer choose recipients from the speaker list (filter or multi-select), accepts the fixture welcome subject ("Welcome to DevFlow Conf 2027 speakers") and a body, reports a successful send (or schedule), and a communications history records the message with recipients and timestamp. Inbox delivery is not agent-verifiable.
- How to verify: Include a speaker whose email is a real inbox you control in the recipient group, resend, and confirm the email arrives with the composed subject ("Welcome to DevFlow Conf 2027 speakers") and body.
- Auto-judge said: pass — The Comms compose wizard has four steps (Recipients → Template → Preview → Send). Recipients are chosen from filterable speaker/submission lists with checkboxes (32 selected, filters Pending/Accepted/Declined etc.). The compose step carries the fixture subject "Welcome to DevFlow Conf 2027 speakers" plus a body; the send step reported "SEND COMPLETE — 29 of 33 speakers were emailed" with a skipped list and reasons; the History tab logs the send at 16 Aug 21:02 with subject, template and "29 sent · 4 skipped", expandable to per-recipient SENT rows with "Show what was sent".

### SPK-16 (weight 1) — Automated reminder emails go to speakers with incomplete tasks based on due dates

- Pass when: Without any organizer manually sending a message, a speaker with an incomplete task due soon (or overdue) receives a reminder email referencing the task and its due date within the expected reminder window; the automated send also appears in the communications history if the clone has one.
- How to verify: Create or edit a speaker so their email is a real inbox you control. Assign them a task due within 24-48 hours (or set the due date in the past) and leave it incomplete. Wait through the reminder cycle (up to 24 hours past the due date). Confirm a reminder email arrives referencing the task name and due date, and check the app's communications history for the automated send. Note: in SessionBoard, after an organizer extends a deadline the speaker may keep seeing (and reminders may keep referencing) the original due date while late work is still accepted - do not penalize a clone for either behavior.

