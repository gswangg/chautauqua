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
of Decision panel · History under own header): detail structure remaining — Prev/Next
+ "N of 47" · review rows show reviewer EMAIL though the user links to contact "Sam
Whitfield" — resolve identity via linked contact name, not account email · History
section label detaches from its "02" number prefix (centered; match other sections) ·
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

**Review** (probe-4 NEW: reviewer's own Review nav tab NEVER highlights — link
href "/admin/review/" trailing slash vs pathname "/admin/review"; fix the href,
aria-current follows) (probe-3 CLOSED: DEC-763 plan-scoped disclosures — all 37 swept clean ·
DEC-763 export sort — hrefs byte-identical all 8 states, CSVs match · reviewer
NAMES render · DEC-760 remind hidden at N=0; earlier: DEC-737/723/736 + blended
SCORE): scoped queue vs v5 frame STILL-OPEN (probe-4): needs eyebrow "REVIEW · ‹plan›",
h1 = count ("11 left to score"), scope+closes subtitle, progress bar, row anatomy
SCORED x.x / NOT SCORED + "Score this" action; scorecard back link names the plan
("‹ ‹plan› queue"); scorecard eyebrow plan · track · round · SEED still pending: stagger a SECOND
plan open so multi-plan reviewer experience is visible · shell 403 NARROWED: fires
once during login→redirect only (clean thereafter) — skip the overview fetch for
non-organizers at login · plan-row subtitle truncated: "All tracks" without "· 3
reviews each"; progress rows lack per-reviewer track subtitle + "X of Y" numeric ·
anonymity ratchet counts evaluations submitted BEFORE anonymization was enabled
(guard should count only under-anonymity evals) · title-row summary "3 plans · 1
with evaluations in" (string absent from bundle) · plan
editor v4 shell PARTIAL (criterion rows/Add-criterion/scale caption/locked-state all
landed): still — title-row Duplicate + Save (not page-bottom Save/Delete), remove
legacy fields the mock omits (NAME/INSTRUCTIONS/ROUNDS/track-filter checkboxes/
Anonymize/dropdown-kind criterion), reviewer section → "WHO REVIEWS WHAT" grammar
(names, "6 talks", "Assign a reviewer", recusal footnote; account-admin out),
new-plan page: Cancel/"Create the plan" on title row + "Nothing is sent to reviewers
until you open it" + don't show "NAME IS REQUIRED." before input · results: ONE
blended SCORE column (per-criterion detail behind ▸ Reviews) — probe confirms still
dense multi-column.

**Speakers** (DEC-730 control family + hover ring + footer caption + em-dash modal
all CLOSED by probe 2): overdue label copy — render mock's "OVERDUE", not "N DAYS
LATE" (control anatomy is right, word is wrong) · (probe-3: DEC-776 badge consistency CLOSED — badge=stat=rendered cells) · horizontal scroll contained to grid wrapper · New-task
modal: Kind = Upload/Form/Acknowledge, drop Description + assign-all, styled date ·
remove desktop Import CSV button · headers "DUE 10 APR · REQUIRED".

**Content** (probe 2 CLOSED: Approve hidden on approved rows · worklist header copy ·
library pill chips counted, no select · Download all truthful): session detail
rebuild — shared version list + ONE scoped note thread, "Send note only", Download
all · "Unknown (unknown)" is the COMMENT AUTHOR on speaker replies (attribution bug
in comment write path; version-uploader attribution is correct) · comment version
tags renumber after a version delete (keep original version refs) · (probe-3: DEC-773 CLOSED — one unified list, tabs gone, "11 files · 4.9 KB" stat,
counted chips incl. Headshot·3) · worklist chips: counted + mock
set/order ("Needs a decision · N" FIRST, "Approved · N", "All accepted sessions ·
N") · relative dates in LATEST FILE · SEED: worklist too sparse (28/30 "No files
yet").

**Agenda (desktop)** (probe-3 CLOSED: occupied-slot place-anyway — PUT 200,
persists · clash-card content legible while armed · DEC-759 cards don't scroll ·
DEC-779 dot-joins): **NEW — placing-mode slot targets INVISIBLE over the clash
card**: slot buttons are transparent with a 1px dashed border in rgb(27,29,23) —
EXACTLY the clash card's background (1:1 contrast) — and empty text; "will clash
with N" exists only in aria-label; non-clash cells have NO visible affordance and
no hover change. Fix: dashed border on-ink over ink (paper color) + a hover state
on all cells + consider visible micro-copy on clash targets · **layout shift on
arm/disarm STILL-OPEN (measured)**: armed bar pushes grid +58.8px; the "No room
yet" 5th column shrinks room columns 251→200.8px (−150px displacement). Keep
geometry stable: overlay/reserve the banner; only add the no-room column for a
roomless armed session or overlay it · card titles CLAMP at 2 lines (no scroll,
but long titles truncate — decide vs mock) · place-anyway lands with NO
confirm/toast — add the mock's feedback if any · **P2: invited-placeholder sessions ("Invited: Priya
Raman") are invisible to double-booking detection** despite displaying speaker names
— auto-schedule stacked them over the speakers' real sessions with zero flags ·
auto-schedule ignores format durations (Keynote 45/Workshop 120/Lightning 10 all
placed as 30-min blocks) · slot previews pre-announce room clashes but not speaker
double-bookings · "1 conflicts" grammar; a session's own slot counts itself ("will
clash with 1 session") · public agenda renders day headings twice (second empty) ·
day tabs raw ISO ("2027-05-12") vs mock "Tue 12 May" · focus → Cancel/first cell on
placing entry.
(CLOSED by probe 2: DEC-724 conditional "No room yet" column · DEC-742 merged clash
card — inverted ink card, zero inner scroll, fully visible content.)

**Comms** (probe-4 CLOSED: DEC-792 vocabulary — Content Reminder preflights clean
w/ per-recipient values · DEC-793 chip row + cursor insert + hint + NAMED
preflight errors · DEC-796 rendered history, zero raw tokens; earlier: DEC-751 +
history CTA + DEC-710): NEW — seeded "Content Reminder" SUBJECT interpolates the
multi-line {task_list} block (paragraph subjects; empty case "due No due date: No
outstanding tasks.." double period) — add short/long task_list variants or reword
the seeded subject · preflight banner needs role="alert" + name ALL missing
fields per recipient (only first named) · template-selected mode silently ignores
textarea edits (bogus tokens no-op — either respect edits or lock the textarea) ·
history shows no body anywhere (list projection drops bodyText — add body to the
expanded batch view) · SEED: give the 23-recipient batch VARIED subjects so
per-recipient rendering is evidenced · per-recipient SCHEDULED/NO-SLOT tags +
"N have no slot" advisory in Preview (mock caption) · Recent sends minor:
template-label column + per-row Open link.

**Contacts** (probe-3 CLOSED: Title prefill + blank-title guard (UI+API) · role
persists w/ named confirmation DEC-765 · Keep both/Not a duplicate PERSISTED
(POST dismiss + DB + reload) · merge pair counter + keep-column name + real keep
values · contact DELETE API now exists):
**P1 REFRAMED — add-to-event still creates INSTANT DELINQUENCY**: with a real
title, one click creates an accepted session + roster row + 5 task assignments,
3 BORN OVERDUE (due dates before creation; badge 9→12 LATE). Sessions/tasks on
add must be opt-in or due dates must clamp to future. ALSO: fabrication fallback
ALIVE at src/server/repo/contacts/push.ts:55 — reached by POST /contacts w/
eventId (crud.ts:122) and CSV import (push.ts:88); kill the fallback everywhere ·
event default ignores current context (AddToEventModal.tsx:47 picks
res.items[0] by desc startDate — PROVEN with a temp 2029 event; default to the
event in the app chrome) · no already-on-roster check (drawer already shows "On
roster"; modal/route ignore it — second add silently duplicates) · role surfacing:
participants table shows raw lowercase "moderator" (apply participantRoleLabel);
NO role on Speakers roster or drawer · role option set vs mock
(Speaker/Reviewer/Guest) — settle in a DEC.
Merge view remaining: discard column headed literal "Discard" (MergePage.tsx:203)
— use the record's name · absent fields render STRUCK "—" (strike only real
discarded values, not never-present ones) · **Labels/Notes preview iterates ONLY
the discarded record's fields** (src/domain/contacts.ts:386) — keeper-only
labels/notes never shown; iterate both · no Name row · no footer impact line
("N submissions and M tasks move to the kept record").
**P2 duplicate warning at creation**: NO candidate lookup exists in
NewContactModal (zero network while typing) though findImportDuplicateCandidates
exists for CSV — wire it in as an inline hint.
**SEED REGRESSION: 0 duplicate pairs in the seed now** (was 2; mock shows "1 of 6
pairs") — the Duplicates tab demos EMPTY; reseed 2-3 pairs.
Rest: contact-delete UI affordance (API landed — add drawer/list action) ·
duplicate DETECTION rule when companies differ (DEC) · drawer = read-only record
view (reorder page around history + action bar) · import: real step panels or CTA
above fold · pipeline: card captions ("Added N days ago", "No reply · N days"
bold past 30, declined reason) · pipeline enrol: score/rationale fields.

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

1. **Saved embeds (Settings) — probe-4: skeleton only, spec NOT met.** The
   save-form captures only name+surface (a saved embed CANNOT carry a recipe);
   the full builder has no Name/save; NO edit path exists ("Editing · ‹name›" +
   "Save changes" absent; Get code appends a static snippet). **Disabled embed
   still 404s ("Embed not found.") — design REQUIRES empty 200** (blank inside
   pasted iframes). Wording: LIVE/DISABLED + Enable/Disable → v5 ON/OFF + Turn
   on/Turn off; add recipe caption ("Sessions · iframe · AI Engineering · 6
   fields"), "3 on · 1 off" header count, footer caption "Turning one off breaks
   it wherever it is pasted". URL: /embed/e/<slug> SSR resolution is fine as the
   mechanism — keep it, drop the unimplemented ?embed= form from the spec.
   ALSO: restore ics to the Format picker + /embed/<slug>/schedule.ics (the
   regression; picker/feed parity test).
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
6. **Assignment tooling (Review) — probe-4: preview built, spec half-met**:
   "Distribute evenly" + per-reviewer projections exist; still needed per v5:
   cap-per-reviewer field · rename/retarget to "Distribute the unassigned"
   (unassigned pool, not load-leveling) · preview states what it CANNOT do
   ("N stay unassigned — cap reached / nobody covers X") · out-of-track rows
   listed "unchanged · wrong track".
7. **Scoped reviewer queue (Review)** — queue headed "Review · ‹plan name›" over
   the count + "‹scope› · closes in N days" beneath; scorecard back link "‹ ‹plan›
   queue"; scorecard eyebrow names plan · track · round.
8. **Password CTA, three states (Public, CFP-05 w3) — SECURITY RULE (DEC-098)**:
   `fresh` (contact created by THIS submit) → "Create a password" button w/ claim
   path · `pending-existing-contact` (email already in CRM) → NO claim URL in the
   HTML AT ALL; "We emailed … a link to set a password" + Log in fallback ·
   `has-account` → "Log in to track it", no claim minted. Copy is "set a
   password", never "create an account" (no public signup route). NOTHING on the
   form itself. Add a test asserting the pending-existing-contact response
   contains no claim URL.

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
- CRM KPIs: eventCount + returningSpeakers still unrendered (API returns them).
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
