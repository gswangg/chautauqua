# Phone dock membership audit (DEC-976, wave-19 task w19-c)

Companion to `test/phone-dock-ledger.scan.test.ts`. Every prior label ledger
(`test/frame-control-label.scan.test.ts`) asks "does the app render this
WORD somewhere in its source?" -- a question a single stray fragment can
satisfy without the control it names ever having been built (`Add someone`
was satisfied by an unrelated empty-column link reading "Add someone to
Identified ›"). This ledger asks the stronger question: does the app render
EVERY word of a given dock band, in the SAME file that also declares the
dock geometry to the shell?

## Derivation

1. **Population** -- every `*.dc.html` file's phone frame (`width:390px` +
   `height:844`), enumerated by the same grammar
   `test/frame-control-label.scan.test.ts` uses. Inside each frame's extent,
   the docked-footer signature `flex-shrink:0; border-top:1px solid
   #1B1D17` (a deliberate superset of that ledger's own
   `background:#EFEBDF`-qualified signature) locates a band; the balanced
   `<div`/`</div>` walk from that signature's enclosing `<div` finds the
   band's full extent. **41 of the 53 phone frames carry such a band.**

2. **Discriminator** -- a band whose body contains the literal
   `list="{{ tabs }}"` is the shell tab bar (the bottom-of-shell navigation
   every top-level page mounts), not a page-local action dock. **7 of the
   41 are shell tab bars; the remaining 34 are action docks**, this
   ledger's graded population.

3. **Claim** -- an action dock is claimed when some single non-test file
   under `app/src/**` or `src/**` both (a) declares a docked band (the
   `chq-phone-dock` / `data-chq-phone-dock` tokens, or -- for a `.css` file
   -- a rule inside a `max-width: 700px` block carrying
   `position: sticky|fixed` + `bottom: 0` + `border-top`) and (b) renders,
   normalized and boundary-anchored, every one of that band's drawn labels.
   Unlike the word-anywhere-in-corpus ledger, the match here is scoped to
   ONE candidate file for every label in a band -- a dock whose geometry is
   declared in a CSS file and whose copy is rendered in a separate `.tsx`
   file is a real membership gap, not a pass.

## Exclusions

**FIXTURE** (a band's own mock content wearing control geometry, not a real
UI word) -- ported from `test/frame-control-label.scan.test.ts`'s own
table, re-verified against this ledger's own extraction:

| file | line | label | reason |
|---|---|---|---|
| Chautauqua Agenda.dc.html | 193 | Docs That Answer Back | the Agenda frame's own mock session-title fixture |
| Chautauqua Agenda.dc.html | 194 | DFC-033 · lightning talk, 10 min | the Agenda frame's own mock session-code/format fixture |
| Chautauqua Contacts.dc.html | 434 | Email Priya | mock quick-action fixture naming a fictional contact |
| Chautauqua Public and Portal.dc.html | 464 | Priya Raman · Latticework Systems | mock speaker-identity fixture |

**COMPOSED** (the app assembles the label from parts at render time, or the
divergence is BLESSED by a recorded ruling) -- also ported from the same
table:

| file | line | label | reason |
|---|---|---|---|
| Chautauqua Public and Portal.dc.html | 493 | Mark the release signed | `tasksPageDockPrimary` (src/routes/portal/tasks/views.tsx:411) |
| Chautauqua Public and Portal.dc.html | 494 | Later | BLESSED DEVIATIONS.md §6, DEC-967 wave-106 |
| Chautauqua Public and Portal.dc.html | 588 | Upload slides | `taskActionLabel(t)` (src/routes/portal/index.tsx:128-132) |
| Chautauqua Review.dc.html | 666 | Save the plan | BLESSED DEVIATIONS.md §3, DEC-745 wave-98 |

These four exclusions each fully clear one dock band's requirement
(`Portal · Your tasks`), or reduce another to a single remaining label the
app does render alongside a `data-chq-phone-dock` declaration in the same
file (`Portal · Your session`'s `Edit`, `Public/Portal`'s speaker-identity
card's `Profile`, `Plan editor · 390`'s `Cancel` in `PlanEditor.tsx`) --
those three bands are CLAIMED and do not appear in the offender list below.

## Ratchet

`PHONE_DOCK_UNCLAIMED_CEILING`, measured on this branch by forcing the
constant to `-1` and reading the printed offender list: **13**.

## Current offenders (measured, by owning cluster)

| cluster | frame | band | unclaimed labels | note |
|---|---|---|---|---|
| Account | Change password · 390 | Account.dc.html:172 | Change it, Cancel | dock geometry lives in `src/routes/auth.css.ts`; the copy renders in `src/routes/account.tsx` -- two files, no single file claims both. |
| Agenda | Agenda (placing dock) | Agenda.dc.html:189 | Placing · tap a free slot, Cancel, Unscheduled, Auto-schedule | placing-mode dock band; FIXTURE rows 193/194 already excluded from this same band. |
| Contacts | Pipeline · 390 | Contacts.dc.html:473 | Add someone, Filter | drained in parallel by v12m-w19-a this wave. |
| Content | Content · selecting | Content.dc.html:278 | Approve 2, Approving sends nothing · the speaker sees it in their portal | `Approve 2`'s composed-count form is already excluded in the label ledger at a different line (Content.dc.html:279 there is a duplicate desktop occurrence); the phone dock's own copy at this line is ungraded there and unclaimed here. |
| Home | Event hub · phone | Home.dc.html:171 | Running on, Chautauqua, API docs | public marketing footer, 3 frames. |
| Home | Between cycles · phone | Home.dc.html:259 | Running on, Chautauqua, API docs | same footer, second state. |
| Home | Fresh deploy · phone | Home.dc.html:317 | Running on, Chautauqua | same footer, third state (no descriptive line). |
| Public/Portal | Public agenda | Public and Portal.dc.html:400 | Download .ics, Speakers | public agenda dock. |
| Public/Portal | Portal · Hotel stay form | Public and Portal.dc.html:518 | Send this in, Save draft | form-submit dock. |
| Public/Portal | Portal · Edit your session | Public and Portal.dc.html:667 | Save changes, Cancel, Title and abstract show on the public pages · co-presenters do not | session-edit dock. |
| Public/Portal | My schedule · /schedule | Public and Portal.dc.html:884 | Download .ics, All sessions | public itinerary dock. |
| Public/Portal | Portal · co-presenter rejected | Public and Portal.dc.html:1360 | Save changes, Cancel, Title and abstract show on the public pages · co-presenters do not | duplicate of the session-edit dock in a different state. |
| Public/Portal | Portal · Resources | Public and Portal.dc.html:1580 | Questions? Reply to any of our emails. | resources footer note. |

Settings' `Settings · Event` dock (`Save`/`Cancel`) is already CLAIMED at
this sha and does not appear above; v12m-w19-b's "Settings edit view" work
this wave targets a different gap (not this ledger's population).

Two sibling lanes this wave (v12m-w19-a Contacts Pipeline, v12m-w19-b
Settings edit view) drain some of the offenders above in parallel; the
merge train re-measures the integrated tree and lowers
`PHONE_DOCK_UNCLAIMED_CEILING` accordingly, once, as a merge-train act.
