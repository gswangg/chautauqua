# MANDATE — desktop-polish oscillation (compacted 2026-08-13; full history in docs/mandates/findings-archive-2026-08-12.md)

**This file lists ONLY open items, priority-ordered.** Closed items were pruned so
nothing here is stale — if a commit fixes an item, it comes OFF this list at the next
external verification pass. External fidelity probes run every ~45 min against a
snapshot; their dispositions update this file. Trust this file over memory.

**Standing rules** (unchanged): desktop-first — ALL mobile work deferred (see queue at
bottom) · convergence = DESKTOP-DONE, verification-only exit wave, desktop measures
only · FIDELITY VERIFICATION IS DESKTOP-ONLY until the desktop gate passes. Frame
classification: phone frames are the ≈390pt-wide captures (<800px at @2x) —
NARROW FRAMES ABOVE THAT (880-1280px modals/drawers/panels) ARE DESKTOP frames
and stay in scope; phone frames (v5, full-scroll) are held for the mobile round —
phone findings filed before the gate go to the mobile queue, not the open items · mobile is additive reflow (media-blocks/phone-classes only; a mobile wave that
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

A. **Page-measure — probe-4: MOSTLY CLOSED (DEC-808)**: submission detail
   (1018+320=1372) and plan editor now full-width; builder + Settings clamp to a
   deliberate --chq-measure:820px with a scan test. REMAINING DECISION: the v5
   mock renders the BUILDER field list across the full content width — mock is
   authority, exempt the builder from the measure (Settings reading-column clamp:
   verify against the 09-settings mock before changing).
B. **customFields/Labels UI surface** (mostly landed — probe 2: directory column AND
   drawer chips w/ label variety verified): remaining — Labels row in the MERGE view
   renders raw lowercase custom-field keys; apply the server-side formatting there
   (detail under Contacts).
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

**Overview** (DEC-735 class split CLOSED — §02 inline AND §04 stacked both verified;
room-named suggestions CLOSED): (probe-4 CLOSED: DEC-806 /admin redirect + highlight, reviewer redirect intact ·
DEC-807 quiet event-switcher) · kill dangling "· ·" on triage rows ("Marcus Okafor
· · SES-002 · waiting 120 days" — empty track slot between separators; drop empty
segments) · New-event modal → root ModalFrame portal + own typography (ALL-CAPS is
inherited), styled dates, labels STARTS/ENDS/TIME ZONE/VENUE · Public pages as
single summary row · resolve "· min ·" (derive from format or drop) · Review-row
copy shape ("N of M plans in · wave X complete").

**Submissions** (probe 2 CLOSED: AWAITING TRIAGE banner · content-approval moved out
of Decision panel · History under own header): (probe-4 CLOSED: review rows name linked contacts · History label numeral rhythm ·
earlier: Prev/Next "N of 31" landed DEC-761) ·
builder rows CLOSED
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

**Review — GATE-1 FLEET: FAIL (full report fidelity-gate1/03-review/report.md)**:
MAJOR: scorecard ratings must be 1-5 SEGMENTED BUTTONS w/ selected fill (now bare
number inputs — the section's defining control) · add OVERALL block ("Averaged by
weight · not editable" + computed blend) · add "Save draft" beside "Submit and
next" · show "Weight N · NN%" per criterion on the scorecard · scorecard: short
ABSTRACT + "Read the full submission" link — STOP dumping full answers + SPEAKER
EMAIL (PII vs anonymization; abstract currently duplicated) · criteria table:
CRITERION/GUIDANCE/WEIGHT headers + drag handles · distribute preview to frame
anatomy (3-col table Name|Track|6→8 talks incl. "unchanged · wrong track" rows,
bold headline, caps NOTHING-IS-SAVED right-aligned, "Assign these N"/Discard, ONE
leftover line) · WHO-REVIEWS-WHAT: control row under the rule + "N talks · N
reviews needed at N each · N reviewers" summary + "talks each" suffix · locked
plan: criteria as read-only TEXT rows, lock card BELOW, header "Open · N of M
reviews in" · results: RANK column first (drop REF/# EVALUATIONS per frame),
Accept/Decline side-by-side · reviewer queue rows to frame anatomy (REF
left/status right, meta w/ audience level, FULL-WIDTH action button) + footer
"Scores stay hidden from other reviewers · Sign out" + recused INLINE ·
new-plan onboarding sentence ("Three to start with…") · landing progress panel:
restore "Remind the N not started" + per-reviewer track subtitles ·
**SEED: set maxEvaluationsPerSubmission on plans (highest-leverage: restores
Reviews-per-talk field, "· N reviews each" subtitles, distribute summary)** ·
DECIDE: unscoped reviewer hub has NO frame and is the landing — redirect to the
scoped queue when one active plan (frame-faithful screen first).
MINOR batch: date grammar "2 Mar – 20 Mar" · status pills (OPEN NOW solid/OPENS
outlined) · progress wording ("18 of 18 submitted", "Not started") · caps meta
right-aligned on rules · REF no-wrap · one-decimal scores · weight cell "50%"
only · middot/em-dash not hyphen · cap input width ("No cap" clips to "No") ·
results duplicate headings/orphan CSV strip/pagination · new-plan header row +
empty guidance placeholders · Add criterion as green link · copy drift (Submit
and next · Discard · COMMENT TO THE COMMITTEE · Assign these N · eyebrow keeps
round when rounds>1) · recusal as inline checkbox · audit extra elements vs DECs
(Reset password, Anonymize, Delete plan, kbd tip).
(Probe-5 closures stand: scoped-queue header block, weighted-score header+caption,
cap+shortfall mechanics, reviewer nav highlight, names, DEC-763 batch.)

**Speakers** (probe-5 CLOSED: DEC-830 participation MENU — real menu, 4 states +
Send portal invite, persistence + role DB-verified, DEC-730 shapes all four
correct; deviation from frame is REASONED + documented in DEC-830 (Invited kept
as a separate no-send state because invited is portal-read-only/not-public —
accept the deviation, do not "fix") · DEC-827 importer link w/ live event context
· "Any task status" relabel · earlier DEC-730/em-dash/badges batch):
**Add-speaker breakage FIXED via manual-qa a2f85f83 (probe-5 found DEC-810's
guard made the form 100% non-functional — form now sends sessionTitle + renders
field-level errors); next probe re-verifies end-to-end.**
Residual (cosmetic, gate-checkable): menu lacks per-item consequence captions +
NOW badge + identity header + olive emphasis on the action · participation filter
is 4 toggle pills (DEC-789) not the frame's "Any participation ▾" select —
functional; check mock intent at gate · inline Send-portal-invite gated on
!hasAccount (superset of Not-invited rule — fine) · DEC-826 effective date:
visible on portal pending rows; organizer grid still prints raw date pre-breach
(surface it there too) · horizontal scroll contained to grid wrapper · New-task
modal: styled date · headers "DUE 10 APR · REQUIRED" + year for far dates.

**Content — GATE-1 FLEET: FAIL (full report fidelity-gate1/05-content/report.md)**:
BROKEN: worklist row separators STAGGERED — td's carry display:flex
(content.css L58/69/84) → per-column borders at different y + misaligned
baselines on all rows; wrap cell contents in divs · "(unknown)" author-role
leaks on every speaker note (files-comments.ts:204) — hide unknown role.
MAJOR: organizer's own notes labeled "You · relative-time" (now raw email +
"(organizer)" + absolute timestamp) · detail version list: newest row shows its
version_no (now "Latest" w/o number) + REPLACED/changes-requested annotations ·
style the drop zone (native Choose-File shows) + ADD .mp4 to accept (Recording
deliverable currently un-uploadable) · "N re-uploaded" semantics wrong (counts
changes_requested; no row can show RE-UPLOADED) — adopt frame vocabulary NOT
REVIEWED/RE-UPLOADED or count real re-uploads · detail header rebuild: left back
link above title, session title as H1 w/ "‹ Content" breadcrumb, subtitle
"Speaker · CODE · slot, Room", CONTENT STATUS sunk band w/ when/by-whom,
DELIVERABLES section rule · worklist default tab = "Needs a decision"
(DEFAULT_WORKLIST_TAB ContentApp.tsx:42).
MINOR: decision buttons — Ask-for-changes primary, helper below · relative
timestamps everywhere · library header (breadcrumb + H1 Files + stat on header
row) · library VERSION column = file's version; trim columns to frame; size col
width · search left of chips · hide zero-count kind chips · headshot rows sort ·
notes heading copy + rule + textarea placeholder · per-version Delete vs frame
(DEC) · add a changes_requested→pending revert affordance (no UI path exists).
(Probe closures stand: DEC-773 unified library, Download-all, version chaining,
chips/counts, note paths.)

**Agenda (desktop) — GATE-1 FLEET: FAIL (full report
chautauqua-research/fidelity-gate1/06-agenda/report.md)**:
**BROKEN — arming EVICTS the Unscheduled tray**: on the common path the no-room
button becomes the sidebar grid item (.chq-agenda-layout 1fr/268px) and the tray
reflows below the grid at y≈1548, off-screen (DayGrid.tsx:397-405 emits it as a
grid sibling). Build DEC-794's actual full-width strip BELOW the grid, column 1;
tray stays pinned. THE top agenda item.
MAJOR: armed ring 1.80:1 over the quieted clash card — use a light-on-ink ring to
clear 3:1 · add :hover feedback to armed cells (frame language: explicit "Place
here · N MIN FREE") · quieted clash card is struck through by cell rules while
armed — keep card text legible (raise card text above rules or mask rules under
the card) · 3-way same-room overlap: extend the DEC-742 merge to N sessions (one
card, one caption; current: 3 staggered truncated lanes + caption ×3) · page
head to frame layout: summary + Auto-schedule + Publish on the title row
right-aligned (kill the ~170px stacked chrome band).
MINOR batch: summary add "· N% placed", bold only the conflict count · clash
caption "ROOM DOUBLE-BOOKED" · tray cards: add "· N min" duration, drop track
line + olive accent, right-align the count numeral · keyboard/click unschedule
path (invert of DEC-570) · armed-bar min-height 38→39 drift (pin it) · time
labels "9:00" not "9:00am" · row pitch toward frame ~68px/30min · move "Add a
room or track" off the toolbar (not in frame — into Settings link placement per
earlier item) · no-room toast copy.
(Probe-4 closures stand: geometry-on-arm columns, place-anyway, toasts, DEC-724,
DEC-853, accessible-name verb split, auto-schedule durations.)

**Comms** (probe-4 CLOSED: DEC-792 vocabulary — Content Reminder preflights clean
w/ per-recipient values · DEC-793 chip row + cursor insert + hint + NAMED
preflight errors · DEC-796 rendered history, zero raw tokens; earlier: DEC-751 +
history CTA + DEC-710): (probe-5: subject fixed — "Reminder: onboarding tasks due {due_date}") · preflight banner needs role="alert" + name ALL missing
fields per recipient (only first named) · template-selected mode silently ignores
textarea edits (bogus tokens no-op — either respect edits or lock the textarea) ·
history shows no body anywhere (list projection drops bodyText — add body to the
expanded batch view) · SEED: give the 23-recipient batch VARIED subjects so
per-recipient rendering is evidenced · per-recipient SCHEDULED/NO-SLOT tags +
"N have no slot" advisory in Preview (mock caption) · Recent sends minor:
template-label column + per-row Open link.

**Contacts** (probe-4: P1 main path CLOSED — event default proven w/ planted 2028
event · roster advisory verbatim, keyed to selected event · born-overdue killed by
DEC-801's single pure rule (7-day grace, all 4 surfaces read it: badge/cell/
filter/email cannot disagree) · role named in confirmation · session consequence
labeled pre-submit · DEC-802 merge truth (keeper values render, plain — no strike
on never-present, real drops still struck) · discard column headed by record name ·
merge impact line present · DEC-800 named duplicate reasons incl. "Same name,
different company" · duplicate hint at creation (debounced check + advisory) ·
contact delete in drawer w/ honest 409 merge-instead guidance DEC-758):

(probe-5 CLOSED: fabrication fallback GONE server-side DEC-810 — sessionTitle
required on all eventId paths, 0 fabricated rows · dup-hint link fixed
(openContact drawer opens) · DEC-834 merge header disambiguation for identical
names · DEC-823 seed ships 3 duplicate pairs w/ named reasons · DEC-821 pipeline
fit behavior: migration + dialog fields + within-column ranking + activity write,
no mailer)
**Merge disambiguation case bug**: namesCollide compares raw names
case-SENSITIVELY (MergePage.tsx:129) while headers render CSS-uppercased —
"PARKER anders" vs "Parker Anders" shows two identical PARKER ANDERS columns; use
the detector's normalizedName.
Residue: effective (grace) deadline invisible until breached — surface it before
overdue (e.g. tooltip/inline "counts from assignment: due 20 Aug") ·
participant.invite_status written 'none' on add-to-event (write the real state) ·
no row-level or bulk delete (drawer-only is fine if mock agrees — check at gate) ·
drawer read-only reorder · import step panels/CTA · pipeline fit PRESENTATION vs
frame (dialog lacks "writes a move to the activity feed · no email is sent"
footer + helper texts; Stage/Fit as selects not pill rows; title "Enroll a
contact" vs "Add to the pipeline"; Fit pill neutral cream not olive — frame wants
scorecard-family olive).

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
public form track checkboxes centered above labels, should be inline · search button STILL 11.1px high
(probe-4 re-measured; root cause PINNED: button centers against the 66px
label+input wrapper — align to the input box; 11px = half the label height) ·
DEC-777 residue: portal SUBPAGE headers drop identity entirely (restore name) ·
portal detail TRACK: template already renders detail.trackName
(portal/index.tsx:404) but the portal query returns it NULL — fix the data fetch,
not the template.

**Grader P3s** (two-track-selectors CLOSED by probe 2): label New-event Timezone ·
explicit CFP publish affordance · close-before-open validation loud at the field.

## DESIGN PACK v5 LANDED (2026-08-13, vendored to docs/design/ — AUTHORITATIVE,
supersedes v4 for Contacts/Public-Portal/Review/Settings/Speakers; README carries
code-level specs — READ IT). Eight design-backed additions, build per mock:

1. **Saved embeds — probe-5: CORE LANDED** (builder saves full recipe; recipe
   caption matches frame grammar; edit path hydrates + PATCHes; **disabled →
   empty 200 verified ×2 anon w/ matching headers**; ics restored
   surface-conditionally per DEC-289). Remaining (wording/small): quick-save form
   in SavedEmbedsPanel still name+surface hardcoding iframe/{} — drop it or give
   it the recipe (two save paths, different fidelity) · **saved-embed URL
   ignores stored FORMAT — a json embed serves text/html; resolver must honor
   embed.format** · "Save changes" label in edit mode · pills/actions → ON/OFF +
   Turn on/Turn off · "N on · M off" header count · footer caption · Delete
   control in UI (API exists).
2. **Participation status (Speakers, SPK-04 w2) — probe-4: HALF-BUILT WRONG
   SHAPE**: current control CYCLES states on click (Confirmed→Declined, no menu)
   — v5 requires a MENU w/ caret (organizer picks a state; "Send portal invite"
   IS the Not-invited→Invited menu item and the only transition that emails);
   filter chips exist (vocabulary ok); "Any status" select still not relabeled
   "Any task status". Replace cycle-on-click with the menu; identity column
   placement per mock; DEC-730 shapes.
3. **Send portal invite (Speakers, SPK-06 w2)** — lives IN that menu ("Send
   portal invite" = the Not invited→Invited transition; emails claim link);
   footer "Only 'Invited' sends anything…"; rows at Not-invited also get an
   inline Send-portal-invite link.
4. **Filter rules (Contacts, CRM-02 w2)** — rules row under the tab row:
   "Matching all of [field][op][value][Remove] … Add a rule · N of M match ·
   Save as a segment"; company-rail click WRITES a rule into this row (one
   mechanism); fields = SEGMENT_STANDARD_FIELDS + custom.<key>.
5. **Pipeline fit score (Contacts)** — enrol dialog gains fit 1-5 (optional) +
   one-line "Why them"; cards show "Fit 5" pill (olive, scorecard family) or
   dashed "Unrated" (must stay visible); NEEDS two nullable columns on
   pipeline_entry (fit_score int, rationale text); fit ranks WITHIN a column,
   never reorders stages; dialog states: adding writes activity, no email sent.
6. **Assignment tooling — probe-5 ESSENTIALLY CLOSED**: cap input (DEC-824) +
   shortfall block naming each unfillable talk w/ reason + "Nothing is saved
   until you confirm" (zero non-GET verified); behavior already gap-fills the
   unassigned pool. Residue: label still "Distribute evenly" (DEC-840 rename
   landed post-snapshot — verify at gate) · out-of-track rows "unchanged · wrong
   track" listing not seen.
7. **Scoped reviewer queue (Review)** — queue headed "Review · ‹plan name›" over
   the count + "‹scope› · closes in N days" beneath; scorecard back link "‹ ‹plan›
   queue"; scorecard eyebrow names plan · track · round.
8. **Password CTA — probe-5: SEMANTICS CLOSED, security assertion HOLDS**
   (fresh → claim link · CRM-known → ZERO /claim/ in raw HTML, token email-only ·
   has-account → no token minted; email_log cross-checked). Ensure the
   no-claim-URL test exists. Chrome residue vs frames 14/15: eyebrow
   "SUBMITTED · ‹ref›" + "That's in. Check your email." + echo the submitted
   address + (b) separate "Already have a password? Log in ›" block + (c)
   primary button "Log in to track it".

Fidelity frames: design-frames-v5 READY (88 frames, manifest.json) — the gate
fleet and all probes use v5 exclusively. NOTE: v4 phone frames were CLIPPED
(fixed 844pt shell, up to ~70% of content discarded) — v5 is full-scroll; any
earlier phone-fidelity judgment made against v4 frames is unreliable and the
mobile round must re-derive from v5. New frames: 04-speakers--05-participation-
open · 08-contacts--12-add-to-the-pipeline · 09-settings--09-settings-saved-
embeds · 10-public-and-portal--14/15 (password-CTA states); assignment tooling
lives INSIDE the plan-editor frames; filter rules inside 08-contacts--00.

## EVAL-COVERAGE CAPABILITY SECTION (probe-3 verified 2026-08-13)

CLOSED by probe 3: click-to-place discoverability (a11y labels intact, no
regression) · DEC-774 facets (Track/Format/Room, URL-addressable, correct
intersection) · DEC-775 XML feeds (/embed/<slug>/*.xml all valid; format select
rewrites URL) · DEC-772 format durations (45/30/10/120 measured) · DEC-773 unified
files library · DEC-782 detail itinerary toggle + date grammar · DEC-776 overdue
predicate · truthful published counts. DEC-785 saved embeds LANDED post-probe —
NEXT PROBE VERIFIES (named list, enable/disable, disabled 404s, Get code).

**REGRESSION (fix with a test): .ics dropped from the embed-builder Format picker**
— DEC-775 replaced ics with xml instead of adding alongside (its own text claims
both). Restore ics to the picker; /embed/<slug>/*.ics should work like .xml.
Feed-format parity test: picker options == live feed suffixes.

Remaining S-tier:
- Default /agenda day pills still #anchors — emit ?day= links on the default view
  too (the parameterized view is fixed).
- Itinerary /schedule: params work (?q=/?trackId=, case-insensitive) but NO search
  box renders — add the input; also honor ?format= like /sessions.
- Weighted-score label CLOSED (probe-4); residue: caption under it still says
  "Mean of submitted reviews · recusals excluded" — update to describe the
  weighted blend.
- CRM KPIs CLOSED (probe-5: "0 returning · 1 events" rendered). Nit: "1 events"
  pluralization.
- Public-pages Agenda/Schedule rows claim "9 published" but those surfaces render
  5 placed blocks — per-surface counts should reflect what each surface shows.
- Per-speaker "Send portal invite" (roster has zero invite affordance; read-only
  pill on submission detail only).
- Public CFP visible "Create an account" CTA on /submit (magic-link copy only).
- Organizer add-co-presenter ROLE picker (row lands as td "speaker"; portal form
  already has PARTICIPANT_ROLE_OPTIONS — reuse).
- Agenda "+ Add room / track" link into Settings.
- **RECONCILE (DEC needed): Speakers Import CSV** — OnboardingGrid.tsx:76 says
  "Import CSV is the Contacts page's job" (DEC-662/746), but SPK-03 (w2) looks for
  it in the speakers area. Cheap resolution honoring both: toolbar LINK into
  Contacts import with the event preselected.
- Copy nit: PLACED grid cards reuse "click to select, then choose a time slot" —
  placed cards should say "click to select, then choose a new slot" (move).

M-tier remaining: SPK-04 speaker workflow status control + roster filter ·
CRM-02 multi-facet rule builder UI. (ABS-06 REMOVED: rubric is an OR of three
mechanisms and our probe-verified assign-by-track preview/confirm satisfies it —
do NOT build caps/auto-distribute.)

**META — click-depth/turn-budget audit** (unchanged, still worth more than several
features): both sbek runs lost more to cannot_judge turn-limit deaths than to
absence; shorten paths on ABS-08/09/10/13, SPK-05/06/14, CNT-10/11/14, CRM-08/11
scenario routes — direct links, fewer intermediate pages.

**SKIP LIST (unchanged — do NOT build)**: ABS-14 AI evaluation (never CLAIM AI in
UI) · nested per-round remodel · participant-level custom fields · per-file share
links + ZIP grouping dialog · separate CRM analytics page · deadline extensions +
contract/COI task kinds.

## Mobile queue (NEXT ROUND — not this round's convergence)

Phone agenda: enumerate ALL 22 chq-phone-* classes in the media override + fix
phone-block-visibility.test.ts to assert the override side; N-aware clash caption;
occupied-slot place-anyway. Phone shells: bottom fixed tab bar + inset scroll,
44px targets everywhere, phone landing/content parity (Comms landing content,
Submissions triage cards' verbose fields, Settings subscreens as routes, phone CFP
2-step wizard, phone password fixed footer + Cancel, roster screen, Home footer
media rule). All under the additive-reflow rule.

## ABS grader additions — ALL CLOSED by probe 2 (sort DEC-737, labels DEC-723,
anonymity DEC-736, pending-submissions) except: co-presenter organizer-only w/
generic role label (still open, ties to Contacts add-to-event role work).

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

## EMB grader additions (2026-08-13, prod — 3/3 PASS; sbek's 72% here = MISSING
capability, not broken behavior — data correctness was flawless)

- **P2 public agenda grid blocks CLIP content**: short sessions (15-min) show only
  time + track chips, title/speakers cut off (anon /e/…/agenda at 1280×800, 9:15 +
  9:30 day-1 blocks). This is the user-reported "overflowing text in calendar grid".
- **P2 "LIVE · 16 PUBLISHED" count wrong**: Settings public-pages rows show 16
  (placed-session count) on all four surfaces incl. Speakers; public reality is 9.
- Missing-capability shortlist (drove sbek's 72% — triage for cheap wins): Sessions
  facets beyond track (format/location) · itinerary widget ignores ?q=/?trackId= ·
  session DETAIL page lacks the Save/itinerary control its list card has ·
  Gallery absent from public-pages list though live · no XML in embed builder;
  /e/<slug>/schedule.ics exists but unreachable from builder · no enable/disable/
  revoke for public surfaces · accent color no-op (--chq-brandable-accent referenced
  once; chrome uses --chq-brand) + accent field rejects "#"-prefixed hex its own
  placeholder shows.
- P3 polish batch: /agenda?day=… drops day navigation (dead end, linked from
  Sessions sidebar) · ISO dates on detail/day headings vs "Wed, May 12" on cards ·
  "Show more" leaves truncated preview above expanded text (first sentence twice) ·
  photo-less speaker cards emit unlabelled links (a11y) · "Add to itinerary" label
  static when checked (/sessions flips Save→Saved) · organizer submission detail
  omits date/time/room for a placed session · no post-download .ics confirmation.

## CRM grader additions (2026-08-13, prod — 2/2 PASS; pipeline = strongest feature,
import dedupe-on-email flawless; add-to-event P1 + wrong-event default merged into
Contacts section above)

- **P2 no duplicate warning at creation**: new contact with identical name+company
  saves silently — surface an inline "possible duplicate" hint at create time (the
  Duplicates tab alone is too late).
- P3 batch: CSV import Review advertises "SKIP THIS ROW" + "0 rows marked to skip"
  but renders NO checkboxes · saving a segment under an existing name creates a
  second identical segment (upsert or reject) + segment Delete has no confirmation ·
  bulk-email body placeholder advertises {first_name} which the validator rejects,
  {portal_link} resolves to a literal example link, "View in Comms history" opens
  the Compose tab · pipeline enrol dialog has no score/rationale fields · custom
  fields are free-form key/value only (no library/type/filterability — capability
  triage) · CRM dashboard is a 3-number KPI strip (capability triage).
- Prod-lag note: prod merge view still shows the OLD Company-"—" bug and has NO
  "Keep both"/"Not a duplicate" controls — those changes are on main, post-deploy.
  Not new work; ships with the gate deploy.

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
