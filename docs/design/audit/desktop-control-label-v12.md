# Desktop + modal control-label ledger (DEC-976 wave-130 amendment, task w5-o)

Instrument: `test/desktop-control-label.scan.test.ts`. Companion to
`test/frame-control-label.scan.test.ts` (phone, `width:390px`+`height:844`
population only) -- this ledger grades everything else the pack draws: the
75+ frames at `width:1600px` and the ~26 modal cards at 440-640px width.
Measured on branch `v12m-w5-o`, main `1885bfff` ("scribe wave 7").

This document names the residue; it does not close it. It is a snapshot of
the offender list, exclusion tables and their reasons at the moment this
ledger was built, kept in sync with the test file's own exported
`DESKTOP_LABEL_CEILING` constant.

## Method

1. **Population**: every `*.dc.html` file under `docs/design`, enumerated via
   `readdirSync` (never a hand-listed file list, DEC-808). A frame's
   container line is the pack's desktop/modal card signature --
   `background:#F4F1E8` + `border-radius:6px` + `box-shadow:0 18px 44px` --
   disjoint from the phone frame's own `border-radius:20px` signature
   (measured: 104 desktop/modal container lines vs 53 phone container
   lines, zero overlap; every desktop/modal frame resolves a preceding
   `font-size:19px` title with zero throws). A frame's extent runs to the
   next such label, or EOF.

2. **Extraction**, two label kinds inside each frame's extent:
   - **CONTROL FACE** -- an `<a>`, `<span>`, or `<button>` whose inline
     style carries `border-radius` AND `padding` AND either
     `border:1px solid #(BAB6A6|CFC7B7|1B1D17)` or `background:#4E5C31`.
   - **TERTIARY LINK** -- an `<a>` with `font-weight:(600|700|800)` and no
     `border` and no `background`.

   Both drop labels under 2 chars after trim, and any label containing
   `{{`.

3. **Badge exclusion**: the pack's own frame-size badges (`1600`, `1800`,
   `Modal`, `560`, ...) are a `<span>` carrying `letter-spacing:0.1em` AND
   `padding:5px 10px` AND `background:#(1B1D17|4E5C31)` -- a shape that
   would otherwise also satisfy CONTROL FACE, so badges are tested and
   dropped *before* face/tertiary classification. The scan asserts this
   predicate is live (badge-drop count > 0 on the real pack) so it can
   never silently stop matching.

4. **Match**: `labelIsMatched`/`normalizeSource` imported from
   `test/frame-source-corpus.ts` (task v12m-w5-n) -- the one shared,
   boundary-anchored, comment/entity-aware corpus. Every non-test
   `.ts`/`.tsx`/`.css` file under `app/src/**` and `src/**`, excluding the
   decision registry (`src/decisions-data/**`, `src/decisions.ts` -- its own
   prose quotes frame labels verbatim and must never satisfy the ledger it
   rules on, DEC-976 wave-129 amendment (c)).

5. **Ratchet**: `DESKTOP_LABEL_CEILING = 57`, hand-measured on this branch
   by forcing the const to `-1` and reading the printed offender list --
   never an expression naming the measured set. Two-sided: one `it` fails
   above the ceiling, a companion `it` fails below it (a stale ceiling
   licenses stagnation).

## FIXTURE exclusions (13)

The pack's own mock content wearing control geometry -- not a UI word the
app renders. Each entry is independently asserted against the pack by exact
`file:line:label` so a re-cut of the pack rots this list loudly.

| File:Line | Label | Reason |
|---|---|---|
| Chautauqua Contacts.dc.html:392 | `Merge into Marcus Okafor` | Duplicates/merge frame's own mock merge-suggestion fixture naming a fictional contact. |
| Chautauqua Speakers.dc.html:352 | `Email Priya` | Speaker-detail frame's own mock quick-action fixture naming a fictional speaker. |
| Chautauqua Speakers.dc.html:353 | `Remind Priya` | Speaker-detail frame's own mock quick-action fixture naming a fictional speaker. |
| Chautauqua Speakers.dc.html:365 | `Taming 40-Minute CI: Incremental Builds at Monorepo Scale` | Speaker-detail frame's own mock talk-title fixture. |
| Chautauqua Agenda.dc.html:67 | `Wed 13 May` | Agenda desktop day-grid frame's own mock header fixture (fixed illustrative dates), not the live composed day pill (`formatDayLabel`, see the phone-frame twin at `app/src/pages/agenda/PhoneAgenda.tsx`). |
| Chautauqua Agenda.dc.html:68 | `Thu 14 May` | Same fixture pair as above. |
| Chautauqua Public and Portal.dc.html:1255 | `Platform &amp; Infra` | CFP-error frame's own mock track-name fixture illustrating a track pill. |
| Chautauqua Public and Portal.dc.html:1256 | `Developer Experience` | CFP-error frame's own mock track-name fixture illustrating a track pill. |
| Chautauqua Settings.dc.html:1384 | `Open Sam's row` | Invite-rejected frame's own mock row-reference fixture naming a fictional invitee. |
| Chautauqua Overview.dc.html:150 | `Move DFC-047 to 11:30` | Overview conflict-panel's own mock two-sessions-in-one-room fixture (fictional session ref DFC-047, Priya Raman/Ruth Adeyemi), not the real composed suggestion (`` `Move ${laterInfo.ref} to ${clockHMM(slot.startMin)}` ``, `src/server/repo/overview/scheduling.ts:192`). |
| Chautauqua Overview.dc.html:514 | `Remind this task` | "States · hover, pending, drag" panel's own illustrative button-state swatches -- documentation of a palette, not a real screen's control. |
| Chautauqua Overview.dc.html:520 | `Archive this event` | Same illustrative States panel as above. |
| Chautauqua Submissions.dc.html:325 | `Dana Whitmore` | Submission-detail frame's own mock submitter-name fixture. |

## COMPOSED exclusions (28 rows; some fewer distinct entries share one composing citation)

The app assembles the label from parts at render time (a shared component +
prop, a template literal, a counter function, including COMPOSED-from-data
over a shared label vocabulary plus a live count/name), so the literal frame
string never appears verbatim in source even though the rendered DOM is
correct.

| File:Line | Label | Composing expression |
|---|---|---|
| Comms.dc.html:144 | `Send 23 emails` | `` `Send ${countOf(previewPlan.willSend, 'email')}` `` (`ComposeWizard.tsx:135`) |
| Comms.dc.html:409 | `Declined · 11` | `{STATUS_LABELS[status]}{count}` (`ComposeWizard.tsx:902-909`) |
| Comms.dc.html:410 | `Waitlisted · 4` | `{STATUS_LABELS[status]}{count}` (`ComposeWizard.tsx:902-909`) |
| Comms.dc.html:418 | `Select all 23 accepted` | `` `Select all ${total} ${STATUS_LABELS[statusFilter[0]].toLowerCase()}` `` (`ComposeWizard.tsx:970-971`) |
| Comms.dc.html:791 | `Send to the 20 who have a slot` | `Send to the {scheduledCount} who have a slot` (`ComposeWizard.tsx:1436`) |
| Comms.dc.html:793 | `Place all three first` | `` `Place all ${spellCount(icsUnscheduledIds.length)} first` `` (`ComposeWizard.tsx:1443`) |
| Contacts.dc.html:68 | `Duplicates · 6` | `` `${label} · ${duplicateTotal}` `` (`ContactsApp.tsx:423`) |
| Contacts.dc.html:69 | `Segments · 5` | `` `${label} · ${segments.length}` `` (`ContactsApp.tsx:424`) |
| Contacts.dc.html:302 | `Import 214 rows` | `Import {countOf(dataRows.length, 'row')}` (`ImportWizard.tsx:665`) |
| Contacts.dc.html:572 | `Send 2 emails` | `Send {countOf(contactIds.length, 'email')}` (`BulkEmailModal.tsx:273`) |
| Contacts.dc.html:710 | `Import 214 rows` | `` `Import ${countOf(plan ? plan.rows.length - skipLines.size : 0, 'row')}` `` (`ImportWizard.tsx:189`) |
| Contacts.dc.html:750/751/752/754 | `Identified · 7`/`Contacted · 5`/`Interested · 4`/`Declined · 2` | `{PIPELINE_STAGE_LABELS[stage]}` + `{entries.filter(...).length}` (`PipelineBoard.tsx:310-313`) |
| Contacts.dc.html:799 | `Import the 205 good rows` | `Import the {countOf(allDataRows.length - badRows.length, 'good row', 'good rows')}` (`ImportWizard.tsx:620`) |
| Contacts.dc.html:800 | `Download the 9 rows` | `Download the {countOf(badRows.length, 'row')}` (`ImportWizard.tsx:626`) |
| Content.dc.html:141 | `Recording · 1 version` | `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}` (`DeliverableDetail.tsx:543`) |
| Content.dc.html:306/307/308 | `Slides · 22`/`Video · 4`/`Other · 5` | `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}` (`FilesLibrary.tsx:266`) |
| Overview.dc.html:75 | `Remind all three` | `Remind all {spellCount(...)}` (`Overview.tsx:329`) |
| Overview.dc.html:118 | `All 5 · 2 re-uploaded` | `All {payload.contentApproval.total} · {payload.contentApproval.reuploadedCount} re-uploaded` (`Overview.tsx:439`) |
| Review.dc.html:97 | `Remind laggards (5)` | `Remind laggards ({laggards.length})` (`ProgressPanel.tsx:235`) |
| Review.dc.html:98 | `Remind the 4 not started` | `Remind the {notStarted.length} not started` (`ProgressPanel.tsx:244`) |
| Review.dc.html:400 | `Show all 18` | `` `Show all ${totalRows}` `` (`ReviewerQueue.tsx:414`) |
| Review.dc.html:565 | `Assign these 22` | `Assign these {distributePreview.totalAssigned}` (`PlanEditor.tsx:2386`) |
| Submissions.dc.html:638 | `All 47` | `` allTotal !== null ? `All ${allTotal}` : 'All' `` (`FilterBar.tsx:106`) |

## Unmatched residue (57), the current `DESKTOP_LABEL_CEILING`

Real frame/app divergences surviving both normalization and the exclusion
tables above -- not fixture noise, not composed-at-render, not (yet)
verified as COMPOSED. Named here so a planner can schedule them; this lane
does not close any of them.

```
Chautauqua Comms.dc.html:578 -- "Tell the 23 accepted speakers" (frame: Comms · nothing sent yet, kind: face)
Chautauqua Comms.dc.html:627 -- "Acceptance" (frame: Comms · history, kind: face)
Chautauqua Comms.dc.html:629 -- "Reminders" (frame: Comms · history, kind: face)
Chautauqua Contacts.dc.html:359 -- "‹ Duplicates" (frame: Duplicates · merge, kind: tertiary)
Chautauqua Contacts.dc.html:603 -- "Guest" (frame: Add to an event, kind: face)
Chautauqua Contacts.dc.html:661 -- "Add to pipeline" (frame: Add to the pipeline, kind: face)
Chautauqua Contacts.dc.html:760 -- "Add someone to Confirmed ›" (frame: Pipeline · an empty stage, kind: tertiary)
Chautauqua Content.dc.html:66 -- "Approved · 9" (frame: Worklist · 1600, kind: face)
Chautauqua Content.dc.html:67 -- "All accepted sessions · 23" (frame: Worklist · 1600, kind: face)
Chautauqua Content.dc.html:75 -- "Approve 2" (frame: Worklist · 1600, kind: face)
Chautauqua Docs.dc.html:40 -- "API reference ↗" (frame: Docs · an article, kind: tertiary)
Chautauqua Docs.dc.html:108 -- "‹ Setting up a call for papers" (frame: Docs · an article, kind: tertiary)
Chautauqua Docs.dc.html:109 -- "Reviewing submissions ›" (frame: Docs · an article, kind: tertiary)
Chautauqua Docs.dc.html:129 -- "API reference ↗" (frame: Docs · the index, kind: tertiary)
Chautauqua Docs.dc.html:238 -- "API reference ↗" (frame: Docs · the element library, kind: tertiary)
Chautauqua Docs.dc.html:343 -- "‹ The previous article in this group" (frame: Docs · the element library, kind: tertiary)
Chautauqua Docs.dc.html:344 -- "The next one ›" (frame: Docs · the element library, kind: tertiary)
Chautauqua Overview.dc.html:99 -- "All 12 · oldest 6 days" (frame: What needs you today · 1600, kind: tertiary)
Chautauqua Public and Portal.dc.html:86 -- "Show all 9" (frame: Sessions and agenda · 1600, kind: tertiary)
Chautauqua Public and Portal.dc.html:203 -- "Wednesday 13 May ›" (frame: Agenda · 1600, kind: tertiary)
Chautauqua Public and Portal.dc.html:321 -- "Wednesday 13 May ›" (frame: Agenda · a track highlighted, kind: tertiary)
Chautauqua Public and Portal.dc.html:1227 -- "Abstract — 1,412 characters, 212 over the limit" (frame: Submit a talk · rejected on submit, kind: tertiary)
Chautauqua Public and Portal.dc.html:1228 -- "Track — pick one" (frame: Submit a talk · rejected on submit, kind: tertiary)
Chautauqua Public and Portal.dc.html:1229 -- "Email — check the address" (frame: Submit a talk · rejected on submit, kind: tertiary)
Chautauqua Public and Portal.dc.html:1386 -- "‹ Your session" (frame: Portal · Edit your session · desktop, kind: tertiary)
Chautauqua Public and Portal.dc.html:1519 -- "Their session" (frame: Portal preview · /portal/preview, kind: face)
Chautauqua Public and Portal.dc.html:1520 -- "Their files" (frame: Portal preview · /portal/preview, kind: face)
Chautauqua Public and Portal.dc.html:1521 -- "Their notes" (frame: Portal preview · /portal/preview, kind: face)
Chautauqua Public and Portal.dc.html:1543 -- "Browse last year's sessions ›" (frame: CFP not open yet · /submit/:slug, kind: tertiary)
Chautauqua Review.dc.html:190 -- "‹ Wave 2 queue" (frame: Reviewer scorecard · /review/plans/:id/submissions/:id, kind: tertiary)
Chautauqua Review.dc.html:921 -- "Save as draft" (frame: Plan editor · save rejected, kind: face)
Chautauqua Review.dc.html:921 -- "Open the plan" (frame: Plan editor · save rejected, kind: face)
Chautauqua Settings.dc.html:632 -- "‹ Call for papers" (frame: Settings · editing the call for papers, kind: tertiary)
Chautauqua Settings.dc.html:723 -- "‹ Event" (frame: Settings · editing the event, kind: tertiary)
Chautauqua Settings.dc.html:774 -- "Archive this event" (frame: Settings · editing the event, kind: tertiary)
Chautauqua Settings.dc.html:813 -- "‹ Tracks and rooms" (frame: Settings · editing tracks and rooms, kind: tertiary)
Chautauqua Settings.dc.html:894 -- "‹ Speaker portal" (frame: Settings · editing the speaker portal, kind: tertiary)
Chautauqua Settings.dc.html:975 -- "‹ People and roles" (frame: Settings · editing people and roles, kind: tertiary)
Chautauqua Settings.dc.html:1046 -- "‹ Public pages" (frame: Settings · editing one saved embed, kind: tertiary)
Chautauqua Settings.dc.html:1097 -- "Turn this embed off" (frame: Settings · editing one saved embed, kind: tertiary)
Chautauqua Settings.dc.html:1136 -- "‹ Your data" (frame: Settings · editing your data, kind: tertiary)
Chautauqua Settings.dc.html:1195 -- "Everything as JSON" (frame: Settings · editing your data, kind: face)
Chautauqua Settings.dc.html:1201 -- "Revoke every token" (frame: Settings · editing your data, kind: tertiary)
Chautauqua Settings.dc.html:1238 -- "‹ Event" (frame: Settings · save rejected by the server, kind: tertiary)
Chautauqua Settings.dc.html:1260 -- "Archive this event" (frame: Settings · save rejected by the server, kind: tertiary)
Chautauqua Settings.dc.html:1303 -- "Organiser" (frame: Invite someone, kind: face)
Chautauqua Settings.dc.html:1432 -- "Delete it" (frame: Confirm · irreversible, kind: face)
Chautauqua Settings.dc.html:1542 -- "Import all of it" (frame: Import from Sessionboard, kind: face)
Chautauqua Settings.dc.html:1542 -- "Download what we found" (frame: Import from Sessionboard, kind: tertiary)
Chautauqua Speakers.dc.html:347 -- "Edit in the contact record ›" (frame: Speaker detail · /admin/speakers/:contactId, kind: tertiary)
Chautauqua Speakers.dc.html:529 -- "Open your tasks" (frame: Review these reminders, kind: face)
Chautauqua Speakers.dc.html:538 -- "Send these 3" (frame: Review these reminders, kind: face)
Chautauqua Speakers.dc.html:587 -- "Overdue · not saved" (frame: Speakers · a write failed, kind: face)
Chautauqua Speakers.dc.html:625 -- "Still waiting · 3" (frame: One task, every speaker, kind: face)
Chautauqua Speakers.dc.html:690 -- "Answered · 6" (frame: One task · still waiting, kind: face)
Chautauqua Submissions.dc.html:636 -- "Accept queue · 4" (frame: Submissions · triage queue clear, kind: face)
Chautauqua Submissions.dc.html:637 -- "Accepted · 23" (frame: Submissions · triage queue clear, kind: face)
```

Several rows are the same shape as landed field-guide entries -- most
visibly the Settings two-level drill's `‹ <section>` tertiary back link
(wave-131 field guide: `.chq-settings-back` composes `‹ Settings` at both
levels; a same-shaped SummarySection-level gap likely accounts for several
more of these) and the Settings "consequence line" gap (wave-132 field
guide: the ruling asks for one on every edit view, only one exists).
Future lanes should re-derive against the tree before spending effort on
any single row -- this list is a snapshot, not a live query.

## Pre-existing note

`test/frame-control-label.scan.test.ts` (the phone-frame ledger this file
is a sibling to) was independently RED on `main@1885bfff` before this task's
changes (`FOOTER_LABEL_CEILING=7` vs 9 measured offenders) -- unrelated to
this task's scope and left untouched.
