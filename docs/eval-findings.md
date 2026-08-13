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

## P0 — CLOSED (probe-2 verified end-to-end 2026-08-13)

Reviewer lockout FIXED and externally verified: sbek-reviewer login → /admin/review
renders → scorecard reached through the UI → rating inputs live. Regression test
guards the closed-plan envelope shape (test/review-queue-shape.test.ts). Swarm has
since refactored into a shared closed/open envelope shaper — test covers it.
Residue (small, filed under Review): shell still fires one non-fatal 403 organizer
overview fetch right after reviewer login — make the shell skip it for reviewers.

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

**Review** (probe-2 CLOSED: honest sort DEC-737, criterion labels DEC-723 —
weight-math proven, reviewer identity DEC-736 incl. anonymized case, blended SCORE
column w/ ▸ Reviews): **NEW P2 — ▸ Reviews disclosure NOT plan-scoped: plan-2 row
"Reviews (2)" expands to 3 entries incl. another plan's evaluation (cross-plan leak +
count mismatch); scope the disclosure query by planId** · header "Export results CSV"
ignores current sort params (diverges from in-table Download CSV — carry sort/dir) ·
shell fires one non-fatal 403 organizer-overview fetch after reviewer login (skip for
non-organizers) · anonymity ratchet counts evaluations submitted BEFORE anonymization
was enabled (guard should count only under-anonymity evals) · reviewer NAMES on
progress rows (seed reviewer contacts since landed — verify names now render) ·
title-row summary "3 plans · 1 with evaluations in" (string absent from bundle) ·
plan rows lack mock subtitle ("All tracks · 3 reviews each") + "N of M" counts ·
remind link renders disabled "Remind the 0 not started" at N=0 — hide instead
(affordance rule) · plan
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

**Account** (DEC-740 CLOSED by probe 2 — designed 404s, NO-ACCOUNT block,
"Sign in to <event>", password placeholder + minlength 12 all verified): remaining —
‹ Back link statically underlined; mock wants plain at rest, underline on hover.

**Public/Portal (desktop)** (P1 pending-submissions CLOSED by probe 2 —
/portal/submissions renders both submissions w/ status links; headshot placeholders
also verified fine): portal session detail polish — Accepted badge jammed inline
against back link (needs own row/separator) · code·format·track line MISSING track +
spans concatenate w/o separator into date line · date renders raw ISO
("2027-05-12, 09:00" vs mock "Tue 12 May, 10:00 · Room 2A") · Slides card lacks
version/size/"with the organisers" meta + Replace/Upload buttons · drop
not-in-mock Participants + full-Answers sections · header: drop "Welcome to the
speaker portal!…" tagline (displaces identity on subpages; mock = wordmark +
identity only) · pending status label "UNDER REVIEW" — mock vocabulary check ·
admin-404 links run together ("Go to Overview Submissions ›" — separate them) ·
public form track checkboxes centered above labels, should be inline.

**Grader P3s** (two-track-selectors CLOSED by probe 2): label New-event Timezone ·
explicit CFP publish affordance · close-before-open validation loud at the field.

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

## SPK grader additions (2026-08-13, prod — 3/3 scenarios PASS, defects below)

- **P2 orphaned task**: New Task with "Assign to all accepted speakers" UNCHECKED
  creates a permanently unassigned task with no recovery UI — either require an
  assignee or provide an assign-later surface.
- **P2 task assignment misses portal-linked rows**: with assign-to-all CHECKED, the
  "Has account" roster row (Marcus) did NOT receive the new tasks while his duplicate
  non-account row did — assignment keys on the wrong record.
- **P2 headshot uploads invisible in Content**: portal-uploaded headshots show
  0 total under Content files/Headshots, and the Contacts record shows the image with
  NO filename/uploader/timestamp metadata.
- **P2 Comms audit trail**: a fully-failed 13-recipient send left NO history entry
  ("0 total") — failed/attempted sends must still be auditable.
- **P3 add-to-event Title field**: the modal's Title is actually a placeholder SESSION
  title, not job title — silently creates a spurious session. Label it for what it
  does or drop it (ties to existing Contacts add-to-event item).

## CNT grader additions (2026-08-13, prod — 3/3 scenarios PASS, defects below)

- **P3 Session format dropped on create**: New-submission dialog discards the selected
  Session format (created session has none), and NO surface — detail view or detail
  Edit — exposes a format field to fix it afterward.
- **P3 attribution by raw email**: file comments + session history show
  "sbek-organizer@example.com" instead of the display name; history entries date-only,
  no time.
- Seed/coherence notes: two accepted sessions share the title "Taming 40-Minute CI"
  (SES-001 seeded vs SES-031 grader-created) — later graders matching by title hit
  both · duplicate seeded "Confirm participation" task · Priya has two contact
  records · file-request kinds limited to Presentation/Poster/Handout (no
  headshot/image kind).
