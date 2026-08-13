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

## GATE-3 EARLY REDS (fleet re-audit vs v6 in progress; snapshot 9b78f61e; full
## dispositions + prune when all 6 pair reports land — DO NOT prune other sections yet)

**P1-BROKEN · Reviewer queue "Score this" CTA illegible.** `a.chq-review-queue-score-action.chq-btn.chq-btn-primary` computes `color: rgb(27,29,23)` on olive `rgb(78,92,49)` — 2.40:1. A queue-scoped anchor color rule overrides the primary token (the same `.chq-btn-primary` on the scorecard is correct cream `rgb(247,249,240)`). One CSS line; add a computed-style render test for anchor-primaries inside the queue scope. This is the reviewer's single primary action.

**P1 · Plan editor + New plan are 820 (`.chq-measure`); v6 frames 03/05/06 are table class** — criteria rule spans 1376px (l=112→r=1488 at 1600). Move `/admin/review/plans/:id` and `/plans/new` to `.chq-measure-table`, give the editor title bar (`‹ Review` / name / Duplicate·Save) full-bleed chrome-bar treatment per frames. Fixes the criteria-row cramping (guidance inputs clip mid-word) in the same stroke.

**P1 · CFP builder page shrink-wraps its children.** `.chq-forms-page` is a centered flex column; `header.chq-forms-header` measures 275.5px wide (declared 820 max) so the rule + Preview/Save jam mid-page, and `.chq-forms-content` shrinks to 617px vs frame's 756. Stretch children to the measure instead of center-shrinking. (Gate-2's "builder 820-aligned header" fix REGRESSED into this.)

**P1 · CFP form missing the `Track` field** (frame 04: 8 fields incl. Track — 3 options/Single choice/REQUIRED; app: 10 fields, no Track, plus unframed Job title/Company/Speaker bio; order drift Abstract 3rd vs 2nd). Ties to the user's single-track-radios decision — public form should offer track as single-choice.

**P1 · Needs-triage preset renders "Columns: 0" and drops the FORMAT column** — the gate-2 empty-`columns:[]` root cause now surfaces as user-visible broken copy. Frame: `Columns: Format` + populated FORMAT column.

**P2 · Submission detail FORM ANSWERS omits "Accessibility needs"** (frame renders it with value "None"; the app's own CFP form defines the field — render omission).

**P2 · Plan status pills bare text** — frame 00: OPEN NOW = olive-filled pill, OPENS N = outlined pill, CLOSED = bare text; app renders all as bare text.

**P2 · Scorecard OVERALL missing the reconciliation line** — frame 01: "A plain average of 5, 4, 4 would be 4.33" between "Averaged by weight · not editable" and the value. This line IS the answer to the weighted-vs-plain confusion; do NOT touch the math (DEC: weighted blend is correct).

**P2 · Distribute preview + who-reviews-what anatomy** — frame 03: cap row `CAP PER REVIEWER [8] talks each` + summary "18 talks · 36 reviews needed at 2 each · 4 reviewers"; preview is a 3-col table (name | track | `6 → 8 talks`, `unchanged · wrong track`) + "Assign these N" + leftover line. App: one flat line, cap input shows clipped "No", no summary, no leftover line.

**Pair-1 reds (01-overview FAIL 4 MAJOR · 06-agenda FAIL 4 MAJOR):**

**P1 · Overview headline row wraps at exactly the 820 cap** — h1 505.2 + gap 28 + "Export submissions" 148.5 + 9 + "New submission" 129.3 = 820.0, so the h1 breaks to two lines and buttons drop below. Frame label is just "Export" (74px) and the row fits at 747. Rename the button "Export" AND make the headline row resilient (title truncates/actions never wrap under).

**P1 · Agenda clash card struck through in select mode** — armed, the dark clash card lightens #1B1D17→#3F4237 and slot-button cell rules paint OVER its text (three 1px lines strike title/ref/speaker). Keep the resting card (which is now exactly the v6 dark card) fully opaque and above the armed lattice; z-order + keep resting bg when armed. This is the user-filed clash-visibility complaint still alive in its last form.

**P1 · Agenda row structure** — frame is 30-min rows, uniform 44px pitch, one rule per boundary, rule #EDE9DD; app renders 15-min sub-rows with a rule at EVERY 15-min line (double rules, uneven 24.0/32.6 sub-rows, 56.6px effective pitch, +29% grid height). Keep 15-min placement resolution but draw rules only at 30-min boundaries with uniform pitch. (Confirms gate-2's corrected 44px measurement.)

**P1 · Gutter time grammar** — 24-hour like frame ("13:00"), not meridiem-stripped "1:00"; align aria strings to the same grammar (currently three grammars on one surface).

**P2 · Agenda summary placement** — "N unplaced · N conflicts · N% placed" sits 16px right of the "Agenda" title (frame x=166), not inside head-actions at x=915 stacked over the buttons.

**P2 · Overview §03 artifact meta** — row line must be "Speaker · slides v3, 14 MB · re-uploaded yesterday" (template joins only speaker+file+'re-uploaded'; no size/relative-time — and seed degrades it to bare name; ties to the SEED re-upload item below).

**P2 · Overview quiet-block table discipline** — Public-pages row breaks the 200px/600px two-column grid (284.3/515.7, value 12px vs 14px); copy should be the frame's summary ("17 sessions live, with speakers and schedule"), not a route enumeration. §04 clash tails must not break mid-ref/mid-name (no-wrap the "— Name · REF" tail); §04 meta prints duration twice ("Keynote (45 min) · 45 min") and Title-Cases format vs frame "lightning talk, 10 min".

**P2 · Overview/agenda shared polish:** `.chq-overview-section-action` add font-family (same Arial class as `.chq-pill`); modal native date inputs vs frame's text "11 May 2028" (one date-input DEC for app+public); modal head rule #1B1D17 not #D3CFC0; "NEXT FREE SLOT" caption is sentence-case grey in frame; "VENUE · OPTIONAL"→"VENUE"; spell small numbers ("Remind all three"); tray card anatomy (flat 1px border no accent stripe, "· 10 min" duration, "Unscheduled" + right-count); tray footer hint is ONE line "Click a session, then click a time slot · drag back to unschedule"-style, not 3 lines; gutter 63px not 80; clash caption vocab per v6 agenda card "ROOM DOUBLE-BOOKED"; clash cells need a hover/visible disclosure (4/144 armed cells silent); nav badges "9 LATE"/"1 CLASH" are unframed chrome — DEC needed: keep (functional win) or drop (fidelity); header event-name title-case untracked per frame.

**Pair-3 reds (04-speakers FAIL 3 MAJOR · 05-content FAIL 8 MAJOR):**

**P1 · `.chq-pill` renders in Arial** — `app/src/styles.css` `.chq-pill` declares no `font-family` and buttons don't inherit; worklist tabs, library type chips, deliverable chips, Overdue-only toggle all compute Arial while neighbors are Figtree. One declaration (`font-family: inherit` on the pill or a global `button { font: inherit }` consistent with scan-lock); add computed-font render test.

**P1 · 05-content structural batch (one wave, shared anatomy):** (a) content-status band must be FULL-BLEED with 1px ink rule above + hairline below, 79px tall, carrying Approve + "Download all" (app: inset to column, 40px, no rules, actions hoisted to title row); (b) 2px ink header rule on BOTH content tables (worklist + files library) — same missing-heavy-rule class as speakers matrix; (c) decision buttons INVERTED — `Ask for changes` is the filled olive primary, `Send note only` the outline; helper sentence goes BELOW the pair; (d) kill the extra `Worklist / Files / Refresh` band on every content view — frame puts "All files" + "Refresh" as title-row buttons; (e) two-column headings (`Deliverables` / `Notes on the presentation`) must top-align within 4px, each ruled across its column; (f) worklist SESSION subtitle = "REF · Tue 10:00, Room 2A" (slot/room data exists on detail); (g) dropzone = single-line dashed box "Drop a file to upload for the speaker" + uppercase type list right, ~50px — not the 180px wrapped-sentence box with native file input; (h) files library columns = FILE / SESSION / VERSION / SIZE / Download only (fold uploader+date into FILE subline; drop select-all/KIND/UPLOADED cols + `Download ZIP (0)` button).

**P1 · Speakers matrix header typography + rule** — task column headers are sentence-case ink ~15px (frame "Confirm participation"), NOT uppercase-muted 11px; only the second line ("DUE 1 APR · REQUIRED") is uppercase-muted. Heavy 2px ink rule under the header row (app has 1px hairline). First col header reads `SPEAKER · PARTICIPATION`.

**P1 · Per-speaker detail page: participation + task status as PILLS, not plain text** (turn-diet surface — pills are what sbek reads); page carries two tables so it takes `.chq-measure-table` 1440, and SLOT/ROOM must use the app's own "Thu 13 May 10:00–10:45" grammar, not raw ISO.

**P2 · speakers matrix polish batch:** All-tasks select sizes to longest option (242 vs 86px); toolbar controls 44px vs frame 33px; unframed Edit/Remove links in column headers; upload cells show "File" inline right of pill (not truncated filename second line); row pitch uniform ~107 (rows wrap when "Send portal invite" overflows — show invite link ONLY on NOT-INVITED rows per frame, which also fixes the identity-stack finding); "· has account" lowercase; "Showing 1—6" em dash; skip-copy "EMAILED" not "REMINDED".

**P2 · content polish batch:** LATEST FILE = per-kind summary ("Slides v3 · recording v1"); library VERSION bold accent caps; search placeholder fits; headshots don't sort atop library; version rows "NEWEST" right-aligned + no per-version Delete; notes placeholder "Write a note — sent with the decision, and kept on the thread"; deliverable chips per KIND ("Slides · 3 versions") not per upload-group; one time convention.

**SEED · no RE-UPLOADED row demoable** — header claims "1 re-uploaded" but zero rows render it; seed a genuine re-upload chain (also unblocks CNT turn-diet demo).

(Verified fixed at gate-3, hands off: accept-primary pair+caption, save-view modal, drag handles on builder rows, review segment fill olive+equal spans, scorecard measure, recusal placement, RANK-led results 1dp, recused-envelope closed-plan queue — regression test passed live. Pair-3 verified fixed: participation-pill 4-state (guard test in speakers-css.test.ts), add-speaker E2E 201, menu focus/arrows/escape, DEC-920 filename links on detail, DEC-990 one-page-two-views with /e/…/gallery as Grid URL.)

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

**Overview — GATE-2: FAIL, narrow** (report fidelity-gate2/01-overview/
report.md; measure/modal/public-row/date-anatomy/overflow all CLOSED):
NEW ROOT CAUSES — **define `--chq-sunk`** (token never defined; secondary
buttons resolve transparent across overview + submissions detail; one line
closes a cross-section item) · **section buttons render in ARIAL** (no
font-family, overview.css:246; same class on agenda no-room btn) · stat-band
bold inconsistency · §04 clash ref wraps mid-token (nowrap) · VENUE label/
placeholder duplication · "JORDAN A." header grammar.
Remaining: public-row copy to count-grammar ("17 sessions live, with speakers
and schedule") · §03 artifact meta · drop month + zero-pad in §04 times ·
" in <room>" suffix · event-name title-case · "Next free slot" 13px sentence ·
modal (near-black rule, 21.5 title, #3F4237 placeholders, human dates) ·
"Export" · spelled small numbers · metrics/spacing batch (59/35/76/72).

**Submissions — GATE-2: PASS w/ reservations ✓** (report
fidelity-gate2/02-submissions/report.md): remaining — FORM ANSWERS add
Notes-for-reviewers + Accessibility, label "Format" · review rows LIGHTER
(one-line "Name 4.0 date" + comment; keep plan label; rubric detail behind
disclosure) · builder field set (add Track + Accessibility, drop
Job-title/Company/Bio) + "1,200 characters" + strip protocol + SETTINGS DEC ·
modal extra TRACKS/SESSION-FORMAT + drop unframed "· OPTIONAL" suffixes ·
global count under filter · TRACK/SENT/FORMAT labels · filter controls at chip
height · view-tab × · triage preset ships columns:[] (fix the client preset) ·
Add-a-question back to green link (regressed) · builder locked rows: grey only
Delete, not field names · bulk-bar Delete… DEC · speaker rail history line ·
‹ glyph.

**Review — GATE-2: FAIL, much improved** (same report): NEW TOP ITEMS —
scorecard has NO MEASURE (full-bleed 1740px; extend the 820 card measure to the
scorecard) · selected rating fill OLIVE not ink + five EQUAL-width segments
across the measure · recusal below the comment (not above ratings) · one
criterion renders a sunk band its sibling lacks · aria-pressed on scored
segments · "7 of 18 done" counter + scoped progress bar/name · 1dp everywhere.
STILL-OPEN: criteria drag handles ×3 editors · distribute anatomy (3-col
Name|Track|6→8, caps NOTHING-IS-SAVED right, "Assign these N"/Discard, leftover
summary line) · WHO-REVIEWS-WHAT control row below rule + "N talks · N reviews
needed at N each · N reviewers" + "No cap" clip · status pills = real pills
(now bare caps text) · US dates → "2 Mar – 20 Mar" · hyphen→middot sweep · dup
results headings/orphan CSV/pagination · "COMMENT TO THE COMMITTEE" ·
recusal inline checkbox · extras audit (Reset password/Anonymize/Delete
plan/kbd tip) · landing remind + track subtitles · footer "· Sign out" · queue
meta audience level + Change-your-score secondary.
**SEED (top leverage): maxEvaluations on plans 0002-0004 · spread evaluation
scores (31 rows collapse to 4 values — rank-order arbitrary) · second reviewer
on plan 0003 · a recusal for the reviewer (RECUSED row never exercised) ·
RESTORE seed_saved_view_0001 (concurrent agent deleted it).**
(Gate-2 closures: segmented buttons, OVERALL, weights, PII clamp, RANK table,
queue anatomy, compact hub, locked read-only, criteria headers.)

**Speakers — GATE-2: FAIL, REGRESSION** (report fidelity-gate2/04-speakers/
report.md): **P1-adjacent — CONFIRMED participation pill INVISIBLE on all 9
seeded rows** (trigger reset speakers.css:216 background:none/padding:0/
font:inherit after the DEC-730 modifiers; 3rd collision on this rule). FIX
SHAPE MANDATED: reduce the reset to appearance+cursor (or :where()-scope) +
computed-style render test for ALL FOUR states. ALSO REGRESSED: column header
lost its second axis — restore "SPEAKER · PARTICIPATION". FIXED this gate:
Any-participation dropdown, Add-speaker modal E2E, date grammar, filename link,
accent invite, menuitemradio. STILL-OPEN batch: reopen caption ·
KIND outlined-chip selected · DELIVERABLE KIND styling/default · task headers
title-case · menu header line + tinted current + NOW treatment · menu
focus/arrows/outside-click · has-account plain text · identity stacking ·
invite link NOT-INVITED-only · EMAILED copy · en dash · import Close + file
input · SEED SFO dates.
**P2 — DELETE ROUND-TRIP DOESN'T CLOSE**: session delete leaves task_assignment
orphans (DEC-921 ownership) → contact delete 409s AND orphans permanently
inflate roster stats. DEC-886 prose contradicts implementation. Resolve the
cascade or offer assignment cleanup on contact delete.

**Content — GATE-2: FAIL, narrow** (same report; staggered rows, role leak,
"You", version_no, DEC-881, header rebuild, default tab, library structure all
CLOSED): NEW — duplicate H1 "Content" + dead pill-row chrome above every
detail/library view (~200px; one H1 per page) · **version chain not unique per
deliverable** (SES-005 shows two v1 roots as one "2 versions" chain — chain per
deliverable kind, restore REPLACED tag) · heading alignment + heavy rules ·
"v2 · Latest" wrap. STILL-OPEN: decision buttons inverted + helper below · one
time convention (relative) · library trim columns/ZIP(0)/placeholder/headshot
sort · per-version Delete DEC · changes_requested→pending path · styled drop
zone w/ frame copy (mp4 half done) · SEED: one re-uploaded PENDING row so the
signature state can demo.

**Agenda (desktop) — GATE-2: FAIL, narrow** (same report; tray eviction,
ring contrast 4.29:1, hover labels, N-way merge, title-row head, %-placed all
CLOSED): TOP — **replace the armed clash-card opacity with a quieted-ink
token** (opacity .55 lets the ink outlines strike the card text; 3.56:1 AA
fail — the one AA failure left) · **lighten the armed lattice** (2px solid ink
×144 doubles at shared edges; inset/lighter ring) · ONE time grammar (24h
gutter incl. afternoon, align aria + toasts) · hover label on CLASH cells
(140/144) · "N MIN FREE" = the slot gap, not end-of-day · Arial no-room button
(--chq-sunk/font fix pair) · empty-row pitch 44pt (corrected from gate-1) +
gutter 63 + head→tabs 36 · tray/placed card anatomy (flat tray border, no
accent/track line, "· N min", right-aligned count; placed keeps accent, drops
track line) · click/keyboard unschedule (placed-click = move only) · caption
vocabulary DEC (surface-dependent strings are CORRECT — agenda generalizes
N-way, overview uses TWO-SESSIONS string; document, don't unify blindly) ·
no-room toast copy · tray footer copy + unframed ⋮⋮.

**Comms — GATE-2: FAIL improved** (report fidelity-gate2/07-comms/report.md;
DEC-883 both halves + DEC-912 + Templates chrome + stale-sends + overlap all
CLOSED; send-honesty EXONERATED — DevSinkMailer locally, DEC-923 verified):
**NEW P1 — ICS slot self-contradiction**: one screen shows SCHEDULED on every
row AND "No slot yet" preview AND "11 of 11 have no slot" AND raw-DB-id error
AND enabled Send — unify the slot predicate (DEC-912 flag vs ICS resolver),
disable send on block, human refs in errors · **P1 {feedback} circular gate**:
chip offered on step 2, server rejects without includeFeedback which lives on
step 3 — accept pre-toggle or auto-enable + restore the named-fields banner
(regressed to silent) · make the merged block reachable on the natural path ·
BODY textarea (byte-identical 3rd look) · send confirm dialog · history: widen
the identifying column, stop repeating subject/timestamp ×N · Recent-Sends
Open/timestamps/template col · templates purpose-copy + editor polish batch.

**USER (drawer action row): "Delete this contact" shows the BROWSER-DEFAULT
blue-gray focus ring** — .chq-btn-tertiary has no focus-visible treatment, so
the UA outline shows (off-palette). Give tertiary buttons the design-system
focus ring (olive, like inputs/status cells); sweep other tertiary/link-button
classes for the same gap. Also: the drawer action row mixes THREE button
treatments side by side (primary/secondary/tertiary-with-ring) — check frame
intent for the row.

**Contacts — GATE-2: FAIL barely-moved — PLANNER: the modal/drawer BROKEN
batch was never scheduled; schedule it FIRST with Account** (report same):
UNCHANGED BROKEN ×4: new-contact modal form grammar · headshot raw file input
past viewport + indigo square · import × (506px centered button) ·
duplicates-tab wrapping. FIXED: DEC-868 rules row functional (chrome residue:
one bordered strip, eyebrow leader, no-wrap, text-link save) · pipeline
drag-and-drop (drop/fix MOVE-TO selects). Remaining majors: rail reasons +
Keep both · merge 6 identity rows + composition · pipeline header ·
add-to-event cards + option DEC + selected-state · drawer pipeline entry ·
import step-2 screen + samples + dup footer + REQUIRED marker + org→Company
auto-map (silent data loss) · bulk-email names + terminal Send + MESSAGE ·
ACROSS-YOUR-EVENTS table · SEED fit/rationales/staleness · "1 events".

**Settings — GATE-2: FAIL improved** (report fidelity-gate2/09-settings/
report.md; editor/pills/scroll-spy/count/seeds/recipe/eyebrow CLOSED):
TOP — **embed-row wrap at 1440, THIRD GATE** (pin the row grid; add a width
test) · builder field toggles = native fieldset again (make the 6 FIELDS SHOWN
pills; the fieldset defect relocated) · **THE STRUCTURAL TRIO** (one change,
~7 panels): 3-col definition grid (label ‖ value @455 ‖ right hint) ·
read-views show the frames' LISTS · section actions right-aligned ON the
eyebrow. Rest: Edit-the-form links the question builder · portal Change edits
welcome/pills/tasks · styled resource picker · un-overlap Copy buttons +
Preview · middle col = where-pasted + caption placement · date grammar + hints
+ label-drift pairs · CFP orphan row + balanced open/close (show one) ·
markdown rendered view · SEED: display names, per-track scopes, NOT PUBLISHED
page, accessibility-needs question · submission-delete DISCOVERABILITY (path
exists via list bulk bar — add detail-page action).

**Account — GATE-2: FAIL UNCHANGED — ZERO commits touched auth files since
gate-1; PLANNER: schedule this section FIRST this round** (report
fidelity-gate2/11-account/report.md): PRIORITY — route /e/<bad-slug> through
the designed 404 card (publicNotFound() call sites; note the undesigned page
already carries the frame-correct 28px/15px type — reuse it) · put frame 02's
520 content-hugging card ON /admin/* (currently on public; admin renders bare
820 w/ jammed links + code sentence) · cards hug content (viewport-stretch
leaves 206-526pt dead) · titles 36→28px · demo block per its OWN signed mandate
wording: three SMALL LINKS in card vocabulary (not 44px buttons) · underline on
hover only · ‹ Back up-left of indented title · metrics (padding 35, column
450, inputs 48, card 640) · NEW PASSWORD AGAIN + you@example.com placeholder ·
h1+main semantics · designed-404 body 15px/24.5.

**Home — GATE-2: strict FAIL, no regression** (same report): drop the extra
stacked Speakers action (one centred action/row) · shell body → --chq-paper ·
API docs 12px · main/footer landmarks · published-row meta qualifier · section
head 4pt · (CORRECTION: bare session counts are frame-legal; gate-1 premise too
strict).

**USER-TEST FINDING (prod, real submit): EVERY CFP form field is marked
required** — bio, company, job title, notes-for-reviewers AND both custom
questions ("Key takeaway", one more). Frames mark several "· OPTIONAL";
DEC-909's grammar exists but the SEEDED FORM CONFIG requires all. Fix the seed
form field configs (required only: title, abstract, name, email, track, format)
+ assert via test. This also inflates grader/judge friction on the first public
flow.

**PENDING v6 HANDOFF (user designing now): Speakers page gains a List/Grid view
toggle; the standalone Gallery page + nav item GO AWAY. IMPLEMENTATION CONTRACT
when the handoff lands: /e/<slug>/gallery MUST keep resolving (grader probes the
path; embed builder lists the surface; EMB-12/13 grade the grid) — it becomes
the Grid-view URL of the Speakers page (toggle links to it; or 302 to
/speakers?view=grid, either is fine as long as the photo-grid renders there).
Grid cards stay CAPTIONED (headshot + name + title + company per EMB-12);
headshots-only strip is dropped (nothing grades it). Do NOT build against this
until the v6 frames arrive.**

**Public/Portal — GATE-2: FAIL improved — PLANNER: SCHEDULE THIS BATCH NEXT
(user-priority: "the public pages look quite bad" — these are the judge's
logged-out first impression). DECIDED (user, 2026-08-13): public submit form
goes SINGLE-SELECT track radios per the v5 frames; keep the many-to-many model
underneath; reseed the two 2-track sessions single; format = radio cards,
audience = 3-pill segment per frame.** (same report; DEC-884 casing+tagline,
3-up grid, hatched fallback, day-pill state, back-links, DEC-862 chrome halves,
counters/helpers all CLOSED; claim contract HOLDS): TOP — sessions SEARCH ROW
(compact ~240px inline input at the pill-row head, no button — DEC-835 never
reached this page) + ONE pill row · session-row anatomy (time+room left gutter,
drop abstract/▶, caps meta DEC-919) · portal-home ISO date (one-line formatter)
· overlap indicator (seed's real double-booking unflagged) · CFP-closed page
needs links · confirmation meta card + edit-until + spam + submit-another +
browse · **submit-form control DEC — decide this round** (multi-track model vs
frame radios; checkboxes/selects/two-name/DESCRIPTION/accessibility/1-col all
hang on it) · .ics footer CTA · date restated ×3 per row · portal header on
body grid · task vocab → TO DO/DONE everywhere · NEW: speaker tiles landscape
~262×152 · sessions rail CALL FOR PAPERS block · meta separator concatenation ·
submit-page single title. Minor tail in report.

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

## DESIGN PACK v6 LANDED (2026-08-13, vendored to docs/design/ — SUPERSEDES v5;
frames redrawn at 1600. READ THE README's "Widths" section — it is now the
page-width AUTHORITY and SUPERSEDES every prior width filing incl. DEC-877's
820-everywhere reading):

**THE WIDTH SYSTEM (four container classes; class belongs to the CONTENT):**
- READING 820 centred: Overview, session detail, CFP form + confirmations,
  login, **CFP form builder, Comms template editor** (editors are reading class
  — you compose one thing).
- READING + RAIL: Settings = 820 content centred ON THE PAGE, rail hangs in the
  LEFT MARGIN — exact spec `grid-template-columns: minmax(196px,1fr)
  minmax(0,820px) minmax(0,1fr)`, rail justify-self:end (do NOT centre
  rail+content as one block). Public sessions = 1180 centred pair (820 + 34 +
  300 rail — its rail is content).
- TABLE 1440 centred: Submissions list, Contacts directory + pipeline board,
  Content worklist + files, Review plans + results, Comms compose, **Speakers
  matrix** (matrix min-width 1060, board 1000 — they are NOT canvases; the
  canvas test is "can the column COUNT grow").
- CANVAS uncapped: agenda grid ONLY.
- **Submission detail = 1180** (the route the prior pass missed).
- CHROME ALWAYS FULL BLEED: header/toolbar/section rules run edge to edge;
  only content is constrained.

**Other v6 changes:** Speakers = ONE page w/ List/Grid toggle beside search;
Grid links to /e/:slug/gallery (URL must keep resolving; gallery nav link
dropped) — supersedes the pending-v6 note · **Merge rebuilt**: column heads
name BOTH records ("Keeping · Marcus Okafor · added 14 Mar" / "Discarding ·
Marcus O. · added 2 Aug"), combine rules in a block above the actions, primary
names its target, "Swap which is kept" beside it · **Merge fields = one
"Insert a field ▾" dropdown** (open state lists token + sample value) —
supersedes the six-chip row · markup repairs baked in (three void
declarations, 16000px frame, doubled cap injection).

Fidelity frames: design-frames-v6 READY (90 frames, manifest, zero clip; hero
frames renamed ·1600; 01-overview--03 = the 1800px width exemplar;
10--08/09 = the split speakers List/Grid views). NOTE: the nine Settings
sub-screens are 390px PHONE frames in v6 (desktop-width in v5) — under the
desktop-only rule they leave desktop scope; desktop Settings is judged from
frame 00 + 01 + the width-system spec. Prior width-related open items must be
RE-READ against the class table before working them.

## GATE-2 SBEK: 91.5% (coverage 93.4). SPK RECOVERED 75→89.1 (turn-diet works).
NEW FLAG: CNT 73.9 (was 88.6) — PURE TURN-BUDGET (coverage 74%; CNT-09/10/11
cannot_judge, S3 truncated before session-edit/history/speaker-profile steps).
**TURN-DIET THE CONTENT PATHS**: session title/abstract edit + revision history
+ speaker bio/headshot must be reachable in FEW clicks from the content detail
(direct edit affordances, no intermediate screens). ABS 98.1 · CRM 100 · AIA
100 held · EMB 95.7 (EMB-15 saved-embeds partial — spec items already filed).
CNT-08 reminder "14 failures" = honest reserved-domain mailer on prod
(environment, not defect — real inboxes deliver).

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
