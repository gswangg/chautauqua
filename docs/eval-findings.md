# MANDATE — desktop-polish oscillation (compacted 2026-08-13; full history in docs/mandates/findings-archive-2026-08-12.md)

**This file lists ONLY open items, priority-ordered.** Closed items were pruned so
nothing here is stale — if a commit fixes an item, it comes OFF this list at the next
external verification pass. External fidelity probes run every ~45 min against a
snapshot; their dispositions update this file. Trust this file over memory.

**Standing rules** (unchanged): desktop-first — ALL mobile work deferred (see queue at
bottom) · convergence = DESKTOP-DONE, verification-only exit wave, desktop measures
only · mobile is additive reflow (media-blocks/phone-classes only; a mobile wave that
changes a desktop pixel has failed; scan-lock) · tests: workers targeted, trains run
fast tier (pure domain + scans, <60s), full suite ONLY at exit, maxWorkers 2 (now in
vitest.config.ts — keep) · every fix needs a test; where a test contradicts the v4
design copy, THE TEST IS WRONG · affordance grammar: conditional-and-quiet; controls
render only when their action is possible; primaries never float in their own band —
title row or form footer; section actions are links on the section rule · one shared
vocabulary + scan-lock beats per-page fixes (dialogs=ModalFrame, buttons, send
reporting, page measure).

## P0 — DO FIRST, ALONE

**REVIEWER ROLE LOCKED OUT (4th cycle).** The shell fetches organizer-only
`/api/v1/events/:id/overview` for every role → 403 for reviewers → crash card with
dead-end recovery on every /admin route. FIX: shell requests badge/overview data only
for organizer; reviewers get a role-appropriate shell landing on their queue. One
conditional. Verify by logging in as sbek-reviewer and reaching a scorecard.

## Cross-cutting sweeps (each closes a class)

A. **Page-measure audit, all admin routes**: submission detail, session detail, plan
   editor, form builder all clamp left/narrow. One shared container token; render-
   sweep asserts width per route.
B. **customFields/Labels UI surface** (blocks Contacts): no column/drawer-row/merge-row
   exists anywhere. Build the surface, then Contacts items below unblock.
C. **Verify-then-close list** (commits claim these landed — external probe confirms,
   then delete the line): Comms Body-width + URL-state tabs (DEC-710) · content file
   version delete (DEC-713) · form-builder row anatomy rebuild (DEC-715) · Review
   landing grammar rebuild (DEC-706/707/708) · Contacts DirectoryRail two-column
   (DEC-710/711) · assign-by-track preview/confirm · data-loss trio (comment-loss
   across versions, headshot-upload-discards-bio, CSV bio overwrite) · stale nav
   badges (refetch on route change/mutation).

## Per-surface open items (desktop)

**Overview**: split .chq-overview-row-actions-stacked (§02 triage buttons regressed to
full-width stacks) · New-event modal → root ModalFrame portal + own typography (ALL-
CAPS is inherited), styled dates, labels STARTS/ENDS/TIME ZONE/VENUE · §02 "waiting N
days" clause (kill dangling "· ·") · Public pages as single summary row · resolve
"· min ·" (derive from format or drop) · suggestions: add room name ("Place at 9:00 in
Room 2B") + verify room-distinctness · Review-row copy shape ("N of M plans in · wave
X complete").

**Submissions**: detail structure — Prev/Next + "N of 47", AWAITING TRIAGE banner,
content-approval controls OUT of decision panel (two screens), history entries under
its header, reviews as name + computed score + comment · builder rows LITERALLY per
mock: ONE-line rows (name + caption under, kind, REQUIRED, Edit/Delete inline right),
NO ↑↓ arrows, ONE combined "Speaker name and email · Built in" row, "Abstract", no
LOCKED badges, settings block out of the fields flow, "Public link · url · Copy"
footer · save-view: share opt-in checkbox, subtitle names actual track + sort ·
DECLINE QUEUE no-wrap · "Columns: <state>" label · bulk bar → 3 actions · drop META
section · ANSWERS = curated subset · quick-add combined name field · co-presenter
search row layout.

**Review**: landing grammar (verify DEC-706-8, then): Export results CSV + New plan on
title row, remind as tertiary "Remind the N not started" ON the rule, merged section
headers, NO radios (row-click select), Progress · Results · Edit links, reviewer
NAMES, DONE / N TO GO / NOT STARTED, "3 plans · 1 with evaluations in" · plan editor
to v4 shell: uniform label+guidance+weight rows, one "Add criterion" tertiary,
soft-cap copy, plan-wide scale caption, remove extraneous fields (rounds decorative →
real waves or delete; reviewer account admin out), "Start a new wave" from locked
state + "Changing these would rescore work already done", locked rows as read-only
text · results: ONE blended SCORE column (per-criterion detail behind ▸ Reviews).

**Speakers**: overdue cells = shared control shape, ink-outlined bold caps, mock's
"OVERDUE" label · hover ring all three states · footer caption "Click any status to
mark it complete or pending" · **BUG: response modal renders completed answers as
em-dashes (4/4 fields)** · horizontal scroll contained to grid wrapper · New-task
modal: Kind = Upload/Form/Acknowledge, drop Description + assign-all, styled date ·
remove desktop Import CSV button · headers "DUE 10 APR · REQUIRED".

**Content**: session detail rebuild — shared version list + ONE scoped note thread,
"Send note only", Download all · "Unknown (unknown)" uploader (SES-001 v2) · port
styled file inputs (chq-file class present, styles absent here) · library: count/size
stat, pill chips not select, Download all, drop Deliverables/Headshots tabs · hide
Approve on approved rows · worklist header "N need a decision · M re-uploaded" + mock
pill names · relative dates in LATEST FILE.

**Agenda (desktop)**: conflict cell — content hidden behind inner scroll; size to
content or designed reveal; decide lane-split vs mock full-width card in a DEC · TBD
column conditional + "No room yet" · focus → Cancel/first cell on placing entry ·
verify a 3rd-placement round-trip persists.

**Comms**: (verify DEC-710 first) per-recipient SCHEDULED/NO-SLOT tags + "N have no
slot" advisory in Preview · persistent Recent sends under Compose · bordered "See the
recipients" CTA on batch rows · prod History "0 total" count bug · SEED: one ~23-
recipient batch + 4 more templates.

**Contacts** (after sweep B): verify DirectoryRail two-column, then complete: LABELS
column + drawer row + merge rows; tab chips w/ counts; search + Segment on tab row;
DELETE KPI trio, filter-rules row, #Submissions column · merge: ALL differing fields,
fix loader (Company renders "—" though directory has values), fixed-primary +
per-field keep, pair counter, "Not a duplicate", strikethrough + footer · add-to-event
ROLE control (Speaker/Reviewer/Guest) + drop hardcoded sentence + unclip Title ·
drawer = read-only record view (history + action bar exist; reorder page around them)
· import: real step panels or CTA above fold · pipeline: card captions ("Added N days
ago", "No reply · N days" bold past 30, declined reason) · Duplicates tab "Keep both".

**Settings**: READ-ONLY SUMMARY pattern (THE item — sections as label:value rows w/
"Edit the form"/"Change"/"Replace" drill-ins; forms only on drill) · remove new
desktop drill behavior (static one-document rail) · rail → 7 (Import under Your data)
· re-merge Your data (4 export pills + tokens + RESTORE API-docs link) · Change: enable
or hide (disabled violates affordance rule) · real per-track scope values · People
list = organiser + reviewers · render Markdown in wiki (raw "##" bug) · Tracks-and-
rooms read-only w/ drill-in · Public pages list: Speaker gallery row per mock, pill
states.

**Account**: server not-found.tsx → design copy + FIX its test (same test-was-wrong
rule) · SPA 404: add "Submissions ›" link · login: NO-ACCOUNT block (CSS
.chq-auth-footer* exists unused — write the JSX), "Sign in to <event name>" ·
password: "At least 12 characters" placeholder AND minlength 8→12 · ‹ Back underline.

**Public/Portal (desktop)**: portal session detail rebuild (Accepted badge,
code·format·track, date-room, Abstract, Slides card) · **portal lists ALL the
speaker's submissions — pending/accepted/declined, linked w/ status (P1-class: pending
submissions currently invisible to submitters; also fixes second-submission
unreachability)** · portal header = event + identity (drop welcome sentence) ·
headshot stripe placeholders.

**Grader P3s**: public form has TWO track selectors (dedupe — remove leftover custom
dropdown) · label New-event Timezone · explicit CFP publish affordance · close-before-
open validation loud at the field.

## Mobile queue (NEXT ROUND — not this round's convergence)

Phone agenda: enumerate ALL 22 chq-phone-* classes in the media override + fix
phone-block-visibility.test.ts to assert the override side; N-aware clash caption;
occupied-slot place-anyway. Phone shells: bottom fixed tab bar + inset scroll,
44px targets everywhere, phone landing/content parity (Comms landing content,
Submissions triage cards' verbose fields, Settings subscreens as routes, phone CFP
2-step wizard, phone password fixed footer + Cancel, roster screen, Home footer
media rule). All under the additive-reflow rule.

## ABS grader additions (2026-08-13, prod)

- **Results sort-direction inverted (recurrence, persists)**: header arrow + CSV-link
  direction disagree with actual row order on every click. Ranking correct, label wrong.
- **Criterion labels CROSSED on organizer submission detail**: raw keys map to wrong
  display names ("relevance"=4 is actually Originality; "depth"=2 is actually
  Relevance) — values right, labels wrong, this view only.
- **Anonymity inconsistency**: anonymized round's reviewer shows "Anonymous reviewer"
  TO THE ORGANIZER on submission detail while named on Progress/Assignment — organizer
  should see names consistently (per DEC-596's own rule).
- Reconfirmed: pending submissions invisible speaker-side; co-presenter
  organizer-only w/ generic role label.
