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

**Overview — GATE-1 FLEET: FAIL (report fidelity-gate1/01-overview/report.md;
palette/type/nav/section-pattern verified pixel-faithful — divergences are
surgical)**:
**GLOBAL #1 — THE MEASURE**: frame's content column is 820px CENTERED at 1240
(210px gutters; header bar full-bleed is CORRECT and matches). Build's .chq-main
has no max-width → sections 43-67% wider than designed on EVERY page. This
resolves sweep-A definitively: DEC-808's 820 token was frame-true; adopt
820-centered for single-column pages (Overview, builder — and ALIGN the builder
HEADER row to the same measure; settings ok), keep two-col pages to their
frames' geometry. Highest-leverage fix in the app.
MAJOR: New-event modal STARTS/ENDS side-by-side (243.5px each, 16.5 gap; not
stacked full-width rows) · Public-pages row = ONE summary sentence in the value
column (not six link chips) · §04 left column "Tue 12, 10:00 / Room 2A" grammar
(now raw ISO date, no time).
MINOR structure: §04 overflow summary below the list ("3 more unplaced · all
need 120 minutes"); "4 more overdue" should follow the same convention (summary
below, not nav-link above) · §03 meta carries artifact ("slides v1, 8 MB · 2
days ago") · §04 no-slot meta carries format/duration · distinct suggested
times per row (all propose 9:00; drop " in <room>" suffix per frame).
MINOR type/case: header event name title-case regular (not uppercase tracked) ·
"Next free slot…" sentence-case 13px muted · NO SLOT YET 13px · modal head rule
near-black 1px · modal title ~21.5px · placeholder #3F4237 (not browser gray) ·
labels #3F4237 · spell small numbers ("Four things…", "Remind all three").
MINOR controls: secondary buttons get their #EFEBDF fill on overview (token
exists, unused here) · modal actions 46px tall (match input height) + widths ·
human-formatted date inputs ("11 May 2028") · drop required asterisks · "Export"
label (not "Export submissions") · row button metrics (gap 9.5, Accept 80w,
headline buttons 37h) · spacing rhythm batch (header 59.5h, gap 34.5, stat band
76, row pitch 72) · nav badges + caret vs frame (caret already filed; badges =
DEC decision, likely keep).
(Earlier closures stand: DEC-735/779, room-named suggestions.)

**Submissions — GATE-1 FLEET: FAIL (list near-pixel PASS; full report
fidelity-gate1/02-submissions/report.md)**:
MAJOR (detail, frame 02 structural): restore ACCEPT primary + Decline|Waitlist
pair + "Deciding sends nothing. Notify from Comms." caption (status segmented
demoted the triage action) · drop NN—numbering, adopt frame sections
(ABSTRACT → curated FORM ANSWERS → REVIEWS; rail DECISION/SPEAKER/HISTORY) ·
implement REAL history entries (submitted / confirmation sent / review in /
opened-by — now empty behind SHOW) · curate FORM ANSWERS to Format/Audience/
Notes-for-reviewers/Accessibility (raw dump duplicates title+abstract, omits the
two frame fields) · review rows lighter per frame + LABEL the weighted blend's
plan/weights (scores 4.80/4.33 are CORRECT weighted math across different plans
— explainability gap, do NOT change the math) · em-dash spacing in section
tokens.
MAJOR (builder, frame 04): content 820px under a full-width header at 1440 —
align header row to the content measure (Preview/Save float over dead space) ·
disabled Edit/Delete/drag render identical to enabled — grey them · drag
reorder inert — implement or drop handles · field list: add Track +
Accessibility needs w/ frame captions, drop Job title/Company/Speaker-bio,
"N options" description lines.
MAJOR (save-view, frame 07): "Share it with the other organisers" CHECKBOX
unimplemented — sharing silently forced on; build the opt-in.
BROKEN: Agenda nav badge route-dependent (1 CLASH on list vs 3 on detail/forms,
deterministic — unify the clash count source).
MINOR batch: filter-row track select + Columns picker at chip height (26px
pills) · header labels TRACK/SENT/FORMAT · "19 Feb" date grammar · global count
when filtered · saved-view × affordance · triage view stored config (Columns:
Format) · detail ref line "CODE · N of M" + Previous/Next text + speaker
history line + ABSTRACT label · TRACKS/FORMAT/PARTICIPANTS/META extras (DEC:
where does detail editing live) · new-submission modal: remove extra
TRACKS/SESSION-FORMAT (or DEC) + kill off-system fieldset treatment + center ·
save-view width/centering · builder Add-a-question link + "1,200" formatting +
strip protocol + SETTINGS section DEC.
(Earlier closures stand: DEC-715 anatomy, Prev/Next DEC-761, triage banner,
history header, reviewer names.)

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

**Speakers — GATE-1 FLEET: FAIL (report fidelity-gate1/04-speakers/report.md)**:
BROKEN: `.chq-participation-menu-trigger { border: none }` (speakers.css:211)
strips the pill from 3 of 4 participation states (only filled Confirmed
survives) — scope the reset; one line, restores DEC-730 vocabulary.
MAJOR: participation filter → ONE "Any participation ▾" dropdown (frame +
design README:291; DEC-789's four pills overridden by design authority; returns
SKIPS copy inline right) · Add speaker → centered ~740px MODAL in the section's
chq-form-row language (now a full-bleed inline panel displacing the page) ·
task-response modal date "sent 2 Apr" grammar (raw US locale now).
MINOR: reopen caption below button w/ frame copy · KIND selected = outlined
chip not solid primary · DELIVERABLE KIND select undesigned (+ default
mismatch) · "SPEAKER · PARTICIPATION" header · task column headers title-case
body-size · menu: panel header (name + company · portal state), tinted current
+ NOW, accent-green action · menu a11y (focus, arrows, outside-click,
aria-checked) · "has account" plain lowercase (no chip, no dangling ·) ·
identity column stacked · inline Send-portal-invite ONLY on NOT-INVITED rows ·
copy EMAILED + en dash · SEED: response text-fields get "SFO" for date-labelled
fields (seed.ts:1569) · import wizard green Close.
(Probe-5 closures stand: DEC-830 semantics, DEC-827, Add-speaker function,
DEC-730 grid family + ring.)

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

**Comms — GATE-1 FLEET: FAIL (report fidelity-gate1/07-comms/report.md)**:
BROKEN: "Include reviewer feedback" ALWAYS 400s (plan select only revealed BY
the failing click — reorder: reveal select, fetch after choice) AND the merged
REVIEWER FEEDBACK blockquote never renders for any plan (frame centerpiece —
implement) · History expanded rows: email overlaps status text · compose Recent
Sends stale after send · template editor BODY textarea fixed ~185px (full-width
~290 per frame) · **send-honesty watch: reserved-domain send returned
{"sent":1} success — earlier builds reported the failure; verify mailer failure
detection** · no confirm on "Send N emails" (DEC).
MAJOR: header subtitle "N sent in 7 days · last <t>" · recipient rows carry
"· <ref>" · UNGATE SCHEDULED/NO-SLOT tags from the calendar checkbox (frame
shows always; footnote correct once shown) · Recent Sends per-row Open ·
Templates page to frame: breadcrumb + H1 + New-template top-right, list w/
descriptions + Last-used meta, Duplicate, "Use in a send" (path into compose).
MINOR batch in report (tab pill, sublabels, step-4 badge, card title, checked
default, timestamps/template-name column, seed template body sign-off +
paragraphs, nav overflow at 1240, editor preselect/header/NAME input/token
parity, History header count + search width + miss copy + de-noise).
(Probe closures stand: DEC-792/793/796/751 + history CTA.)

**Contacts — GATE-1 FLEET: FAIL (report fidelity-gate1/08-contacts/report.md;
headline items — full ranked list there)**:
BROKEN: new-contact modal unstyled (no chq-form-row) · drawer headshot row raw
file input overflowing panel · import × centered · dup-tab row wrapping.
MAJOR: DEC-868 rules row to frame grammar (MATCHING ALL OF, inline chip groups,
Add a rule, N-of-M counter, Save-as-segment in row; drop the permanent
FIELD/OPERATOR/VALUE form) · rail duplicates reason line + Keep both · merge
view renders the 6 identity rows ALWAYS (strike only dropped) + header/footer
composition · pipeline page header + DRAG-AND-DROP (Move-to selects pre-select
current stage) · add-to-event option set/selected-state/event-cards (v5 frame:
Speaker/Reviewer/Guest — fold into the role DEC) · contact-scoped
add-to-pipeline from drawer · import wizard stepwise w/ sample values + dup
footer + visible required batch-title · bulk email subtitle + terminal Send
primary + MESSAGE · drawer ACROSS YOUR EVENTS as event→status table.
**PRODUCT GAP DEC: no submission/session delete route — every import/add
permanently pollutes (fleet left 5+ test sessions; judges will too). Decide:
delete route w/ guard, or archive.**
SEED: rated Fit entries + rationales for the pipeline board.
MINOR batch in report.
(Closures stand: DEC-823 pairs w/ reasons · dup hint + fixed link · DEC-802
truth · dismissal persistence · 409 guidance · DEC-800 · DEC-821 mechanics.)

**Settings — GATE-1 FLEET: FAIL, worst section (report
fidelity-gate1/09-settings/report.md)**:
BROKEN: tracks/rooms edit = unstyled HTML (bullets, input/Delete collisions,
raw purple color input) · CFP "Tracks offered" native fieldset + orphaned
status line · saved-embed rows WRAP at 1440 (actions land under wrong columns) ·
"Reviewers 6" = people−organizers (counts speakers).
STRUCTURAL ×6 panels: 3-col definition grid (label ‖ value ‖ right hint) not
stacked rows · read views show the frame's LISTS (URLs+Embed code, roster,
resources, export pills — not summaries behind Change) · section actions
right-aligned ON the eyebrow line · rail active state + scroll-spy.
MAJOR: CFP Edit-the-form must reach the QUESTION BUILDER · portal Change must
edit welcome note + pills + tasks (not just resources) · embed builder: FIELDS
SHOWN pills, EDITING·NAME + CHROMELESS eyebrows, two-col grid, Preview, un-
overlap Copy buttons, Edit loads the embed's OWN URL · recipe caption full +
middle column = where-pasted · New-embed row caption · date grammar + hints ·
resource file picker styled · markdown RENDERED view in Settings · People names
+ per-track scope + aligned columns · per-row Edit tracks/rooms.
**SEED: add 2 saved embeds · 2 API tokens · room capacities (900/220/220/60) ·
one NOT PUBLISHED page · person display names · per-track reviewer scopes** —
six frame elements currently unrepresentable.
MINOR batch in report. FAITHFUL: rail inventory, read two-col tracks/rooms, CFP
link/badge, embeds wording batch (N on·M off etc.), export pills all live.

**Account — GATE-1 FLEET: FAIL (report fidelity-gate1/11-account/report.md;
login/password geometry near-exact)**: MAJOR — /e/<bad-slug> renders an
UNDESIGNED second 404 (route through the designed card) · admin-404 links jammed
into one phrase (chevron + gap on both) · demo-account block UNFRAMED — KEEP
(judge path) but DEC it + design-bless the styling. MINOR: email placeholder
"you@example.com" · "NEW PASSWORD AGAIN" label · headings ~30/26px per frame ·
‹ Back up-left of indented heading, underline on hover only (same for NO-ACCOUNT
links) · card padding/inputs metrics (35pt/450/48) · cards hug content height ·
semantics (h1/landmarks/label-for) · drop unframed code-type sentence on admin
404.

**Home — GATE-1 FLEET: PASS ✓** (layout ~1pt-exact; composed hero grammar;
footer verbatim). MINOR: event-row meta → "Three tracks · five formats" grammar
(session count is the kept-off-rows shape the notes forbid) · API docs 12px ·
footer/main landmarks. LATER: seeded pass for between-cycles + fresh-deploy
states.

**Public/Portal — GATE-1 FLEET: FAIL all four subsections; claim-URL security
PASSES (report fidelity-gate1/10-public-portal/report.md — full ranked list of
7 BROKEN / 17 MAJOR / 11 MINOR there; headline items):
BROKEN: portal wordmark lowercases the EVENT name (theme.ts:294 transform on
branding.eventName) · raw ISO on portal home hero line · profile back-link
mislabelled · REMOVE the portal tagline entirely (frame has none; it shares the
header line with identity) · speakers grid 7-col at 1440 (frame 3-up; fix
minmax) + gallery packing · headshot fallback = empty div (frame: hatched
placeholder) · agenda ?day= pills lack active state.
MAJOR: sessions search = compact inline box beside pills, no submit button ·
session rows title/speaker/meta/Save only (drop abstract + ▶) · meta as
letterspaced caps text not pills · one filter idiom everywhere · .ics footer
CTA · overlap indicators · empty-day heading under my-picks ·
**submit-form control types DEC: frames = single-track radios/format cards/
audience segment; data model = multi-track (seed has 2-track sessions) —
reconcile deliberately** · submit form missing char counter/ACCESSIBILITY
NEEDS/helpers/OPTIONAL suffixes/ABSTRACT label/single NAME/two-col layout ·
confirmation chrome: SUBMITTED · <ref> eyebrow, echo email, card meta, PRIMARY
buttons per frames 12-15, fresh-state extras, closed-CFP "Browse the sessions ›"
· systemic date grammar · one back-link string · header on body grid.
MINOR batch in report (pluralization, empty-.ics guard, task vocab TO DO/DONE,
slides Replace row, bullets, spacing).
(Closures stand: DEC-098 three states · detail badge/meta incl. TRACK ·
pending-submissions · submit footer row · itinerary + .ics validity.)

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

## GATE-1 SBEK: 90.1% — TARGET HIT. ONE REGRESSION FLAG (SPK 75%, was 86)

Evidence-driven, not functional: 8 partials/0 fails; both SPK scenarios died at
70 turns. FIX BEFORE GATE 2: (1) **TURN-DIET the Speakers grid paths** — the #1
eval lever, now worth a measured −11: fewer clicks to invite/task/file evidence,
direct links, larger targets (grid cells are 27px), consider a per-speaker
detail row the agent can read in one snapshot; (2) task-cell upload shows a
generic "File" label — show the FILENAME (grader needed it for evidence);
(3) DEC-880's pill-visibility fix must hold (invisible pills at gate SHA burned
agent turns). AIA + EMB hit 100% — protect them (regression tests on facets,
feeds, durations, placement). CNT coverage 71% / CFP 81.6% — same turn-diet
treatment on their scenario paths.

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
