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
