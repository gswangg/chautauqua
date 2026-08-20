# Frame control-label audit (v12 mobile campaign)

**The test is the source of truth. This file is a snapshot** taken while
writing `test/frame-control-label.scan.test.ts` (DEC-976/DEC-967 wave-128,
task w3-j; wave-129 amendment closed by task w4-l). If this document and the
test ever disagree, the test is right — re-run it, don't edit this file to
match a stale belief.

```
npx vitest run test/frame-control-label.scan.test.ts
```

## What this measures

Every v12 `.dc.html` phone frame (`width:390px`/`height:844`) draws three
kinds of control label: words in its docked footer, `<a min-height:44px>`
anchor text, and (DEC-976 wave-129 amendment) `<span>` text carrying a
painted control face outside any footer — `min-height:4[468]px` AND
`border-radius` AND (`border:1px` OR `background:#4E5C31`). A bare
`<span min-height:44px>` chip with no painted face stays out of the
population; that is the 283-hit data-chip noise wave-128 measured and
rejected.

This audit asks whether the app's own source (`app/src/**`, `src/**` minus
`src/decisions-data/**` and `src/decisions.ts`, comments stripped, HTML
entities decoded, non-test files only) contains that exact word, **boundary-
anchored** — preceded by start-of-blob/whitespace/`> " ' \` { ( , :` and
followed by end-of-blob/whitespace/`< " ' \` } ) ( ; , . ! ? {` — somewhere
in a normalized file. The decision registry (`src/decisions-data/**`,
`src/decisions.ts`) is excluded from the match corpus: its `DEC_NNN`
constants are English sentences that quote frame labels verbatim, and a
ruling's own prose satisfying the ledger it rules on is DEC-967's "a ledger a
comment can satisfy is not a ledger," one level out.

A "no" here does not by itself prove a bug: some labels are fixture noise
(the frame's own mock data) and some are correctly composed at render time
from parts (a shared component, a counter, a template literal, a live
count/name over a shared vocabulary) rather than written as one literal
string, or are already blessed by a recorded user ruling (DEVIATIONS.md §3
or §6). All three are excluded, by name, in the test file, each pinned to an
exact `file:line:label` so a pack re-cut breaks the pin loudly rather than
silently widening the exclusion.

## Surviving unmatched rows (real gaps), by frame

These are the rows the test's `FOOTER_LABEL_CEILING` (currently `7`) grades.
Each is a literal frame label that is not present, boundary-anchored, in
non-test app source, and is not covered by any exclusion table. All seven are
scheduled to sibling lanes this wave (v12m-w4-m/n/o/p/q/r/s).

| Frame | File:line | Label | Owning surface |
|---|---|---|---|
| Send history · 390 | `Chautauqua Comms.dc.html:350` | "See the recipients" | Comms send-history disclosure — no matching control found |
| Contacts | `Chautauqua Contacts.dc.html:192` | "+ Rule" | Contacts filter-rule add control — no matching control found |
| Overview | `Chautauqua Overview.dc.html:277` | "Place the other six ›" | Overview / home screen — no matching disclosure control found |
| Portal · Hotel stay form | `Chautauqua Public and Portal.dc.html:519` | "Send this in" | Portal form-submit footer action — no matching control found |
| Reviewer scorecard · `/review/plans/:id/submissions/:id` | `Chautauqua Review.dc.html:295` | "Read the full submission" | Reviewer scorecard disclosure — no matching control found |
| Settings · Call for papers | `Chautauqua Settings.dc.html:453` | "Copy link" | Settings CFP-link action — no matching control found |
| Submission detail | `Chautauqua Submissions.dc.html:391` | "Wait" | Submission detail waitlist action — the app renders `Waitlist`, which the boundary-anchored matcher (correctly) does not accept as `Wait` |

## Exclusions applied (not counted as gaps)

### Fixture — the frame's own mock content wearing control geometry

| File:line | Label | Reason |
|---|---|---|
| `Chautauqua Agenda.dc.html:193` | "Docs That Answer Back" | mock session-title fixture |
| `Chautauqua Agenda.dc.html:194` | "DFC-033 · lightning talk, 10 min" | mock session-code/format fixture |
| `Chautauqua Contacts.dc.html:434` | "Email Priya" | mock quick-action naming a fictional contact |
| `Chautauqua Public and Portal.dc.html:464` | "Priya Raman · Latticework Systems" | mock speaker-identity fixture |

### Composed (including composed-from-data and blessed) — the app assembles the label from parts, or the divergence is already blessed

| File:line | Label | Composing expression / blessing |
|---|---|---|
| `Chautauqua Public and Portal.dc.html:478/507/533/565/1563` | "‹ Your portal" | `PortalBackLink`'s `&lsaquo; {portalBackLinkLabel(props.to)}` (`src/routes/portal/shared.tsx`) |
| `Chautauqua Public and Portal.dc.html:602/1306` | "‹ Your session" | same `PortalBackLink` composition |
| `Chautauqua Contacts.dc.html:524` | "‹ Duplicates" | `MergePage.tsx`'s phone-hidden prefix span |
| `Chautauqua Submissions.dc.html:358` | "‹ Triage" | `.chq-detail-back-short` (`app/src/pages/submissions/SubmissionDetailPage.tsx`) |
| `Chautauqua Content.dc.html:279` | "Approve 2" | `countOf`-built `Approve {selectedIds.size}` (`app/src/pages/content/SessionList.tsx`) |
| `Chautauqua Content.dc.html:256` | "All 5" | `countOf`-built `All {items.length}` (`app/src/pages/content/ContentApp.tsx`) |
| `Chautauqua Review.dc.html:283/936` | "‹ Wave 2 queue" | scorecard's `&lsaquo; {plan.name} queue` (`app/src/pages/review/Scorecard.tsx`) |
| `Chautauqua Agenda.dc.html:136/137` | "Wed 13" / "Thu 14" | `formatDayLabel(day)` composes the day pill, in `app/src/pages/agenda/PhoneAgenda.tsx` and `app/src/lib/dates.ts` |
| `Chautauqua Agenda.dc.html:142` | "Room 2B" | `roomLabel(room)` composes the room pill, in `app/src/pages/agenda/PhoneAgenda.tsx` |
| `Chautauqua Contacts.dc.html:196` | "Speakers · 41" | `countOf(stats.speakerCount, 'speaker')`, in `app/src/pages/contacts/ContactsApp.tsx` |
| `Chautauqua Contacts.dc.html:454-457` | stage chips ("Contacted · 5" etc.) | `{PIPELINE_STAGE_LABELS[stage]} · {entries.filter(...).length}`, in `app/src/pages/contacts/PipelineBoard.tsx` |
| `Chautauqua Content.dc.html:211/261` | "Approved · 9" | `{TAB_LABELS[t]}{counts[t] !== null ? ' · ' + counts[t] : ''}`, in `app/src/pages/content/SessionList.tsx` |
| `Chautauqua Content.dc.html:345/346` | "Slides · 22" / "Video · 4" | `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}`, in `app/src/pages/content/FilesLibrary.tsx` |
| `Chautauqua Content.dc.html:387` | "Recording · 1 version" | `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}`, in `app/src/pages/content/DeliverableDetail.tsx` |
| `Chautauqua Overview.dc.html:276` | "Move DFC-047 to 11:30" | `` `Move ${laterInfo.ref} to ${clockHMM(slot.startMin)}` ``, in `src/server/repo/overview/scheduling.ts` |
| `Chautauqua Overview.dc.html:215` | "Remind all three" | `Remind all {spellCount(...)}`, in `app/src/pages/overview/Overview.tsx` |
| `Chautauqua Public and Portal.dc.html:379/380` | "Wed 13" / "Thu 14" | `{formatDayShort(day)}`, in `src/routes/public/agenda-controls.tsx` |
| `Chautauqua Public and Portal.dc.html:381` | "My schedule · 4" | `<span id="chq-ics-count">0</span> saved` populated client-side, in `src/routes/public/agenda-rail.tsx` |
| `Chautauqua Public and Portal.dc.html:493` | "Mark the release signed" | DEC-613 wave-128 shared vocabulary: `tasksPageDockPrimary`, in `src/routes/portal/tasks/views.tsx` |
| `Chautauqua Public and Portal.dc.html:588` | "Upload slides" | DEC-613 wave-128 shared vocabulary: `taskActionLabel(t)`, in `src/routes/portal/index.tsx` |
| `Chautauqua Review.dc.html:666` | "Save the plan" | BLESSED — DEVIATIONS.md §3, DEC-745 wave-98 |
| `Chautauqua Public and Portal.dc.html:494` | "Later" | BLESSED — DEVIATIONS.md §6, DEC-967 wave-106 |
| `Chautauqua Submissions.dc.html:151` | "All 47" | `` `All ${allTotal}` ``, in `app/src/pages/submissions/FilterBar.tsx` |

## Not in scope for this ledger

This ledger does not itself close any gap — it names them for a planner to
schedule. Its population now spans footers, `<a min-height:44px>` anchors,
and painted-face `<span>` controls (DEC-976 wave-129 amendment (b)); a wider
population still (any bare `<span min-height:...>` regardless of paint) was
tried during wave-128 measurement and produces mostly data-chip noise, not
real control labels (see the test file's own header comment).
