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

**REVIEWER STILL LOCKED OUT (5th cycle) — ROOT CAUSE CHANGED, old fix landed.**
External probe (2026-08-13, snapshot e254eca): the role-conditional shell IS in —
reviewer login works, /admin redirects to /admin/review, nav is role-appropriate,
organizer routes show a polite guard. BUT /admin/review crashes deterministically
(3 fresh sessions): "Cannot read properties of undefined (reading 'length')". NEW
cause: the landing fetches every plan's queue; for closed plans
(`GET /api/v1/review/plans/:id/queue` with `open:false`) the response OMITS the
`recused` key (open plans include `"recused":[]`), and the landing renders
`recused.length`. Since the reviewer's only nav link points here, it's functionally
the same lockout. Everything downstream WORKS by direct URL (queue, scorecard,
scoring end-to-end verified 200). FIX: make the queue endpoint always include
`recused: []` (preferred — the omission is the bug) and add a regression test that
asserts the closed-plan queue shape. Verify: sbek-reviewer login → /admin/review
renders → reach a scorecard through the UI.

## Cross-cutting sweeps (each closes a class)

A. **Page-measure audit, all admin routes**: submission detail, session detail, plan
   editor, form builder all clamp left/narrow. One shared container token; render-
   sweep asserts width per route.
B. **customFields/Labels UI surface** (partially landed): directory table Labels
   COLUMN now exists (DEC-712, probe-verified chips). Still missing: Labels row in the
   contact DRAWER and in the MERGE view. Seed only ever derives the single label
   "Speaker" — add label variety so multi-chip rendering is exercised.
C. **Verify-then-close list** (commits claim these landed — external probe confirms,
   then delete the line): data-loss trio REMAINDER (headshot-upload-discards-bio,
   CSV bio overwrite).
   CLOSED by probe 2026-08-13 (snapshot e254eca): Contacts DirectoryRail DEC-710/711
   (real two-column, rail sections per mock) · stale nav badges (mutation updated
   badge immediately, correct across navs + reload) · form-builder row anatomy DEC-715
   (all 7 sub-points verified in DOM) · Review landing grammar DEC-706/707/708
   (5 of 7 sub-points; residue moved to Review section) · assign-by-track
   preview/confirm (zero non-GET before confirm) · Comms Body-width + URL-state tabs
   DEC-710 (Subject=Body=1372px; ?tab= survives reload + direct nav) · History count
   ("3 total" matches rows) · content file-version delete DEC-713 (DELETE 200,
   survives reload, audit comment) · comment-loss across versions (persists through
   upload/delete/reload — NEW small item: comment version TAGS renumber after a
   version delete; store-vs-display drift, no content loss) · content file-input
   styling (.chq-file styles verified applied).

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
its header, reviews as name + computed score + comment · builder rows CLOSED
(probe-verified all 7 anatomy points); residue: kind copy "Dropdown"→"Single choice",
"Session format"→"Format", captions on format/audience rows, drop duplicate
Public-link inside Settings, align field set to mock (Track + Accessibility needs
missing; Job title/Company/Speaker bio extra) · builder page WIDTH still clamps
(720px in 1372px container — sweep A) · save-view: share opt-in checkbox (static
"Shared with every organiser" text is NOT the mock's unchecked checkbox), subtitle
names actual state ("Pending · AI Engineering · newest first" not "a track filter."),
"Close" text not "×", label "NAME IT" · new-submission modal: Create it/Cancel
bottom-LEFT per mock (now bottom-right), drop extra TRACKS/SESSION FORMAT/LAST NAME
fields, "SPEAKER EMAIL" label (not "(OPTIONAL)") ·
DECLINE QUEUE no-wrap · "Columns: <state>" label · bulk bar → 3 actions · drop META
section · ANSWERS = curated subset · quick-add combined name field · co-presenter
search row layout.

**Review** (landing grammar mostly CLOSED — probe-verified; remaining): reviewer
NAMES on progress rows — code already renders `name ?? email` but seed reviewers
have `name:null`, so SEED FIX: give reviewer.b/c/d real names · title-row summary
"3 plans · 1 with evaluations in" (string absent from bundle) · plan rows lack mock
subtitle ("All tracks · 3 reviews each") + "N of M" counts · remind link renders
disabled "Remind the 0 not started" at N=0 — hide instead (affordance rule) · plan
editor v4 shell PARTIAL (criterion rows/Add-criterion/scale caption/locked-state all
landed): still — title-row Duplicate + Save (not page-bottom Save/Delete), remove
legacy fields the mock omits (NAME/INSTRUCTIONS/ROUNDS/track-filter checkboxes/
Anonymize/dropdown-kind criterion), reviewer section → "WHO REVIEWS WHAT" grammar
(names, "6 talks", "Assign a reviewer", recusal footnote; account-admin out),
new-plan page: Cancel/"Create the plan" on title row + "Nothing is sent to reviewers
until you open it" + don't show "NAME IS REQUIRED." before input · results: ONE
blended SCORE column (per-criterion detail behind ▸ Reviews) — probe confirms still
dense multi-column.

**Speakers**: overdue cells = shared control shape, ink-outlined bold caps, mock's
"OVERDUE" label · hover ring all three states · footer caption "Click any status to
mark it complete or pending" · **BUG: response modal renders completed answers as
em-dashes (4/4 fields)** · horizontal scroll contained to grid wrapper · New-task
modal: Kind = Upload/Form/Acknowledge, drop Description + assign-all, styled date ·
remove desktop Import CSV button · headers "DUE 10 APR · REQUIRED".

**Content**: session detail rebuild — shared version list + ONE scoped note thread,
"Send note only", Download all · "Unknown (unknown)" is the COMMENT AUTHOR on speaker
replies (authorName/authorRole "unknown" — attribution bug in comment write path;
version-uploader attribution is correct) · comment version tags renumber after a
version delete (display should keep original version refs) · library: count/size
stat, pill chips not select, Download all, drop Deliverables/Headshots tabs · hide
Approve on approved rows · worklist header "N need a decision · M re-uploaded" + mock
pill chips WITH counts (now "30 submissions · All view", chips uncounted) · relative
dates in LATEST FILE · SEED: worklist too sparse (28/30 rows "No files yet").

**Agenda (desktop)**: conflict cell — content hidden behind inner scroll; size to
content or designed reveal; decide lane-split vs mock full-width card in a DEC · TBD
column conditional + "No room yet" · focus → Cancel/first cell on placing entry ·
verify a 3rd-placement round-trip persists.

**Comms** (DEC-710 + history count CLOSED by probe): per-recipient SCHEDULED/NO-SLOT
tags + "N have no slot" advisory in Preview · persistent Recent sends under Compose
(STILL-OPEN — exists only inside History tab) · bordered "See the recipients" CTA on
batch rows · SEED: one ~23-recipient batch + 4 more templates.

**Contacts** (DirectoryRail, Labels column, tab chips w/ counts, search+Segment
placement, applied-segment, loader values, strikethrough all CLOSED by probe): merge
**BUG MORPHED — differing fields where one side is EMPTY are omitted as rows
entirely** (AcmeCo/Engineer vs empty rendered only the Email row; mock shows value vs
struck "—") — render ALL differing fields incl. value-vs-empty + Labels row · merge
mock gaps: "1 of N pairs" counter, "Not a duplicate" (+ Duplicates-tab "Keep both"),
kept-record column headed by record name (not generic DISCARD radios), footer
specifics ("3 submissions and 1 task move to the kept record") · duplicate DETECTION
drops pairs when companies differ non-empty (probe incidental — decide intended
matching rule in a DEC) · no contact-delete affordance anywhere (drawer has only
Save/Email/Add-to-event) · add-to-event ROLE control (Speaker/Reviewer/Guest) + drop
hardcoded sentence + unclip Title · drawer = read-only record view (history + action
bar exist; reorder page around them) · import: real step panels or CTA above fold ·
pipeline: card captions ("Added N days ago", "No reply · N days" bold past 30,
declined reason).

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
