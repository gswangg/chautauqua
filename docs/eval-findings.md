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

A. **Page-measure audit, all admin routes — STILL OPEN, half-landed**: DEC-744's
   --chq-measure token exists but was adopted ONLY on server-rendered surfaces
   (public/docs/mailbox/submit); app/src has ZERO adoption, so submission detail
   (user re-confirmed on 79e58f0: content ends ~75% w/ dead right gutter), session
   detail, plan editor, form builder still clamp left/narrow. Finish the sweep:
   admin SPA containers adopt the token; render-sweep asserts width per route.
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
room-named suggestions CLOSED): USER: event-switcher caret sits in its own
OUTLINED rounded box next to the event name — drop the outline; the switcher
should read as one quiet control (name + bare ▾), border only on hover/open per
affordance grammar · USER: /admin renders Overview WITHOUT redirecting to
/admin/overview, so the Overview nav tab never highlights on landing — redirect
/admin → /admin/overview (same class as the earlier <tab> vs <tab>/ highlight
fix; check reviewer-role redirect to /admin/review still wins) · kill dangling "· ·" on triage rows ("Marcus Okafor
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

**Review** (probe-3 CLOSED: DEC-763 plan-scoped disclosures — all 37 swept clean ·
DEC-763 export sort — hrefs byte-identical all 8 states, CSVs match · reviewer
NAMES render · DEC-760 remind hidden at N=0; earlier: DEC-737/723/736 + blended
SCORE): scoped queue PARTIAL — "← Your plans" breadcrumb landed, but h1 is still
"Your queue" on both routes; add the plan-name heading on the scoped page (the
landing's section-label h2 is dropped there) · SEED still pending: stagger a SECOND
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

**Comms** (probe-3 CLOSED: DEC-751 Recent sends under Compose on all steps ·
History "See the recipients" bordered CTA · earlier DEC-710 + history count;
template landmine PARTIALLY fixed: task_list + portal_link now RESOLVE in compose —
only {due_date} remains unsupported, then the seeded "Content Reminder" template
works; finish due_date via the task-reminder builder + add the seeded-template
preflight parity test) · preflight error UI still discards the per-recipient field
detail the API already returns — render culprits with human names · compose body
step still has zero merge-field affordance (no field list/insert/hint; NOTE probe:
the "Attachments and merge fields" panel TITLE + two toggles match the mock exactly
— do NOT retitle; missing vs mock is the caption "3 of 23 have no slot yet — those
get no invite") · Recent sends minor: template-label column + per-row Open link ·
per-recipient SCHEDULED/NO-SLOT
tags + "N have no slot" advisory in Preview · persistent Recent sends under Compose
(STILL-OPEN — exists only inside History tab) · bordered "See the recipients" CTA on
batch rows · SEED: one ~23-recipient batch + 4 more templates.

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
public form track checkboxes centered above labels, should be inline · search button MOSTLY FIXED
(same row now); residual: button center 11.1px above the input — the flex row
centers the 44px button against the 66px label (caption+input); align to the INPUT
box (align-items flex-end or dedicated input+button row) · DEC-777 residue: portal
SUBPAGE headers drop identity entirely (wordmark only — restore name on subpages) ·
portal detail meta still lacks TRACK ("SES-001 · Talk (30 min)" — add
"· Platform & Infra").

**Grader P3s** (two-track-selectors CLOSED by probe 2): label New-event Timezone ·
explicit CFP publish affordance · close-before-open validation loud at the field.

## EVAL-COVERAGE CAPABILITY SECTION (2026-08-13 audit: 20 briefs + rubric YAMLs +
2 scored runs crossed against code — priority just below the P1/P2 defect tier.
RULE: a capability ships working-and-tested or not at all; half-built scores worse
than absent.)

**#1 click-to-place discoverability — SHIPPED (manual-qa 44da4e0)**: tray hint now
names the click path; selectable tray cards state "click to select, then choose a
time slot" in their accessible name (what a11y-tree agents read). Tests added
(PlacementAffordance.render.test.tsx). Probe 3 re-verifies via a11y snapshot.

**FLAKY TEST ON MAIN (train hazard — fix soon)**: MergePage.render.test.tsx
(DEC-748 struck-empty/Labels/pair-counter test) is ORDER-DEPENDENT — passes alone,
fails in the full app run (1/792). Likely leaked DOM or mock state from another
test file (missing cleanup()). A flaky red randomly breaks merge-train validation —
root-cause the pollution, don't just retry.

**S-tier (compose from existing patterns — no new design):**
- DaySwitcher → ?day= links (agenda.tsx:244; parseDay already wired end-to-end;
  judge explicitly called out anchor-only pills) — EMB-07 w2.
- "Import CSV" entry point ON the Speakers page (backend POST /contacts/import
  already takes eventId; link into contacts import mode w/ event preselected) —
  SPK-03 w2.
- Per-speaker "Send portal invite" button (fire existing bulk-email path w/
  {portal_link} template at one contact + toast) — SPK-06 w2.
- Visible "Create an account" CTA on public CFP portal (surface the existing claim
  flow as signup affordance) — CFP-05 w3, judged partial solely on this.
- Role picker on ORGANIZER-side add-co-presenter (PARTICIPANT_ROLE_OPTIONS already
  exists, portal form already uses it; organizer form silently defaults "speaker" —
  the exact judged defect) — ABS-11 w2. Closes the co-presenter grader item too.
- "+ Add room / track" link from agenda builder into Settings panel — AIA-02 w2.
- Results column label "Weighted score" (ResultsTable.tsx:347 — math already
  weighted; label is free insurance) — ABS-04.
- Render eventCount + returningSpeakers KPIs (already returned by /contacts/stats,
  never displayed) — CRM-12 w1.
- XML output in embed builder (serializer beside existing JSON feed; named in
  EMB-15 full-credit list) · success toast on "Remind laggards" (fires with NO
  confirmation surface — ABS-09 w1) · .ics link surfaced in embed builder (exists
  at /e/<slug>/schedule.ics?ids=…, unreachable from builder) · itinerary search/
  filters honoring ?q=/?trackId= (params parsed elsewhere already) · session facets
  Format/Location beside Track · itinerary time-group sub-headers.

**M-tier (worth it, small design decisions — reuse existing vocab):**
- SPK-04 w2 speaker workflow status: organizer-settable + roster-filterable
  (inviteStatus exists in schema, read-only today; reuse DEC-730 status-control
  family for the roster cells).
- EMB-15 w3 saved-embed list: named, enable/disable-able embeds (needs an `embed`
  table + list UI; DESIGN: reuse Settings public-pages row pattern — pill state =
  enabled/disabled, row action "Get code"). Largest single remaining item.
- ABS-06 w2: auto-distribute submissions across reviewers OR true per-reviewer cap
  (cap today is per-submission; grep finds no distribute).
- CRM-02 w2: restore a multi-facet rule builder UI (SegmentRule[] backend already
  supports AND over company/title/custom.*; the company-rail click REPLACES rules).

**META — click-depth/turn-budget audit**: both sbek runs lost MORE points to
cannot_judge (turn-limit deaths mid-flow: ABS-08/09/10/13, SPK-05/06/14,
CNT-10/11/14, CRM-08/11 — capabilities built and working) than to genuine absence.
Audit click-depth on those scenario paths; review results/progress (behind plan
detail) ate the tail of three scenarios. Shorten paths: direct nav links, fewer
intermediate pages, obvious entry points from the area landing.

**EXPLICIT SKIP LIST (do NOT build)**: ABS-14 AI evaluation (DEC-272 waiver; ensure
UI never CLAIMS AI so it routes N/A) · nested per-round names/dates/pools/anonymity
(two-plans path already passes ABS-01/02/07) · event-level participant custom
fields (org-level passed) · per-file share links + ZIP grouping dialog (optional/
bonus) · separate CRM analytics page (rail widgets pass) · per-assignment deadline
extensions + contract/COI task kinds (zero rubric weight).

**Stale-item corrections from audit**: gallery IS now in the public-pages list
(DEC-767 landed — drop that EMB line) · headshots tab now EXISTS in files library
(closes SPK-grader headshot-invisibility item IF probe confirms metadata renders) ·
CFP-11 reviewer comment visible to organizer — fixed · multi-event switcher +
per-event scoping EXISTS and passes.

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
