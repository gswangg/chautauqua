# Findings archive (2026-08-15)

Archived by task w6-e (rebase of docs/eval-findings.md onto the current tree and
frame pack, DEC-139 amendment). Everything below is the ENTIRE prior generation of
docs/eval-findings.md, moved here verbatim and never deleted, because it cites
`chautauqua-research/design-frames-v7/v8/v9` (a pack not vendored in this repo — the
vendored frame pack is `docs/design/*.dc.html`), a gate-N fleet/sbek run, or a
snapshot sha. Line references inside this file do NOT resolve against the current
tree; treat every claim here as unverified until someone re-checks it against
current `main` and current `docs/design/`. Verified-against sha for this archive
cut: `541688f54670cfa8596c4fc749cfa9c5d47a6286`.

Three families that were still live in this file were re-verified against current
main and were NOT re-filed as open findings (see docs/eval-findings.md TIER 0):
seeded dates are already relative to a single seed clock (scripts/seed.ts:261-278,
SEED_NOW/DEC-591); saved embeds exist (src/db/schema/embed.ts,
src/routes/public/saved-embed.tsx); per-person reminder scope exists on both the
send and preview onboarding-reminder routes (contactIds, src/routes/tasks.ts:564-613,
DEC-694).

---

# MANDATE — desktop-polish oscillation (gate-4 pruned 2026-08-14, snapshot 33fbc724; full history in docs/mandates/findings-archive-2026-08-12.md)

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
changes a desktop pixel has failed; scan-lock) · USER PRINCIPLE (2026-08-14, refined):
mobile REFLOWS the desktop design, it never competes with it. Reflow IS inclusive of
phone-native grammar — action bars, sheets, stacking, 44px targets are legitimate
translations of desktop affordances (an action bar translates a form footer), so do
NOT strip phone idioms in the name of reflow. The principle governs DIRECTION OF
AUTHORITY, two rules: (1) the phone rendition keeps the desktop design's hierarchy,
capabilities, and token vocabulary — only the grammar changes; (2) derivation is
one-way: when a surface has ONLY a 390 frame, desktop is NEVER "phone anatomy scaled
up" (no full-width primary bars or phone stacking in wide columns) — the desktop
state holds for a frame or derives from the width system + affordance grammar, and
the gap gets filed to the design-standard brief · tests: workers targeted, trains run
fast tier (pure domain + scans, <60s), full suite ONLY at exit, maxWorkers 2 (now in
vitest.config.ts — keep) · every fix needs a test; where a test contradicts the v4
design copy, THE TEST IS WRONG · affordance grammar: conditional-and-quiet; controls
render only when their action is possible; primaries never float in their own band —
title row or form footer; section actions are links on the section rule · one shared
vocabulary + scan-lock beats per-page fixes (dialogs=ModalFrame, buttons, send
reporting, page measure).

**TOOLING NOTE for probes/fleet** (re-confirmed by three gate-4 pairs): `main.chq-main`
scrolls internally — Playwright fullPage silently truncates; force `overflow: visible`
on it before full-page captures. The "Sign out" band that then appears mid-page is an
artifact of that override, not a live overlap.

**STANDING RULE (added at gate-4 after a falsified closure): items close on MEASUREMENT or
RUNTIME evidence only — never on code-reading.** Wave-43 closed "History and Recent Sends are
one reader" by observing both call sites hit `?groupBy=batch`; gate-4 measured them rendering
different Template columns for identical rows. A file:line read proves intent, not behavior.
Scribes: a CLOSED-VERIFIED entry must cite a measured/exercised check (computed style, HTTP
round-trip, rendered DOM), or it stays open.

## SEQUENCING DIRECTIVE (USER, 2026-08-14 afternoon) — DESKTOP FIDELITY + EVAL BEFORE MOBILE

**The swarm's priority lane is desktop fidelity-to-v9 + the ⚡ eval batch, to 100%, BEFORE
any further mobile work.** The phone round is deprioritized as of this directive: finish
only phone tasks already in flight this wave, then the wave planner draws from (in order):
(1) the ⚡ PRIORITY BUILD BATCH (V8 section below) + password-reset flow (V9), (2) the
DROPs + /logout must-fix, (3) desktop fidelity to the v9 frames (settings edit views,
sign-in redraw, error-states standard, B8 interaction states, contact drawer), (4) open
desktop P1/P2s below. The MOBILE QUEUE (including the former phone-queue P0s: blank phone
agenda ≤700px, 390 plan editor) resumes ONLY after the desktop gate: fleet-clean vs v9 +
eval composite at target. Mobile-additive-reflow scan-lock stays in force for anything
already landed.

## ⚠ STRAGGLER STATUS (orchestrator, 17:55) — 1 of 3 CLOSED, 2 CLAIMED BY ORCHESTRATOR

1. **AIA-04 CLOSED-VERIFIED (runtime, snapshot c15d5fe9, fresh reseed):** the seeded
   cross-room co-presenter clash renders "Speaker double-booked" chips on BOTH cards,
   counter "1 unplaced · 2 conflicts", and SES-009's card lists both speakers
   ("Frankie Lindqvist, Elliot Ekström"). Fix was DEC-974's participant hydration;
   evidence now measured, closure valid under the standing rule.
2. **EMB-01 CLOSED (orchestrator, a6ac400e, runtime-verified):** the block was ONE
   default — SESSION_LIST_DEFAULT_FIELDS.description:false (DEC-968) withheld the
   already-built SessionDescription snippet/Show-more from every list. Flipped under the
   recorded ruling; measured 12/12 rows rendering snippets on /e/ AND /embed (fresh
   cache keys — NOTE: the public edge cache serves pre-change renders until keys turn;
   prod reseed + TTL handles it). Fleet: the recorded ruling is authority over frame
   10--00's description-less cards, pending design-agent ratification.
3. **CFP close-path CLOSED (already built by swarm, runtime-verified):** the read-view
   "Close the call" action exists in CallForPapersPanel (confirmCloseNow — same PATCH as
   the edit form, DEC-731) and renders in the Settings read scroll. My burn-down greps
   missed the commit; no work was duplicated.

**GATE CYCLE IN FLIGHT (orchestrator): boundary a6ac400e DEPLOYED** (version d3e4750d;
migrations through 0036; D1 775-statement reseed incl. CNT-S3 fixture alignment; 35 R2
objects --remote, spot-verified; parity clean; EMB-01 live on prod). Sbek full run in
progress (fresh run 22-14-24 — an earlier start was stopped by an orchestrator
false-alarm about the CFP name field; root cause was probe/fixture staleness, not the
product; ~3 scenarios of spend lost). Fidelity fleet (6 pairs vs v9) running in parallel.

**PASSWORD RESET — CLOSED with runtime evidence (walkthrough J2 green on the gate
build):** full round trip on a THROWAWAY account (never a seeded persona): POST /forgot →
enumeration-safe copy asserted → organizer-authed /dev/mailbox captures the email →
/reset/<token> names the account → completion sets the password, revokes ALL sessions,
token single-use. Mechanism+routes+screens+rate-limits all exercised. Prod mailer path
already proven (gate-4 inbox confirmation).

**HARNESS MAINTENANCE (walkthrough fixture drift — swarm lane, NOT gate-blocking):**
orchestrator fixed J1/J2 (c9194533: speaker_name, radio dropdowns, "Submission received"
copy, authed+polled mailbox, template-field autofill). Still stale: **J5** compose
preview omits the now-required feedbackPlanId when the template carries {feedback} ·
**J11** duplicate-contact POST expects 201, seeded data already holds the pair (409) ·
**scale step3** expects 5 task_assignment cells, new seed has 6. Every fixture that
hand-enumerates form/seed shape should re-read it the way J1 now does.

## DELTA PROBE 2 (2026-08-14 ~wave 29, snapshot 0bb56c9c) — landed v9 batch VERIFIED LIVE

Measured at 1440 on a fresh snapshot: **SESSION DETAILS section live** on submission
detail (section + PARTICIPANT table + Edit tracks) · **public-pages Change gate GONE**
(read rows carry View | Embed code, no Change) · **B3 speaker detail live**
(/admin/speakers/:contactId with SESSIONS/TASKS/FILES) · **files library FIXED** ("21
files · 9.0 KB" — the 0-count regression dead — plus scoped "Download all") · **public
speaker bios render** (EMB-05 live). Reviews expansion: implemented with the band grid
(DEC-632/633), toggle labelled "Reviews (n)" — FIDELITY NIT for the fleet: frame copy is
"3 reviews" / "2 reviews · 1 recusal" as the disclosure text.

## DELTA PROBE 3 (2026-08-14 ~wave 50, snapshot 0d9ddb12) — gate-6 class fixes, measured

VERIFIED LIVE: 12-home shell full-bleed (1600 wide, no border/max-width — MAJOR closed) ·
speakers search-empty drops its thead + shows the message (B7 half-landed) · public
control heights 44 → 40 (target 35-39; closer, not there) · date/portal/preview fixes
landed per commits. RESIDUE (still open, file against the same items): speakers empty
state still renders the PAGER ("Showing 0") and has NO facet-naming escape link (B7
rules 5/6 incomplete) · /account/password lost its card but is NOT the bare-820 page —
inputs 188px, H1 28px at x=643 (fleet fix: fields at the full 820, H1 ~36, content
x≈390). CLASS 4 is part-landed; finish the measure.

## GATE-7 SBEK RESULT (official cap, run 07-46-32): 89.0 @ 94.2% — NEW RECORD

AIA **100.0 perfect** · ABS 98.1 · CRM 88.9 · CFP 88.7@82 · SPK 84.4 · EMB 82.9 · CNT
82.8. CFP-16 close-lock verified in build but UNMEASURED by the run (both CFP scenarios
capped before closing the call — again). Post-gate priorities, in order:
1. **⚡ EMB session-card speaker title/company** (~1.3 composite; dinged twice EMB-01/09;
   data exists on the speaker record — render "Name · Title, Company" second line in the
   muted register; also add the description to AGENDA-style cards per EMB-09).
2. **⚡ COMPOSE-FLOW TURN DIET is the CFP-04/16 + SPK blocker** — the compose steps
   precede the close-the-call step in the eval scripts and eat the budget (S1+S4 capped
   again). Fewer clicks per step, default-forward selections, no dead ends. This is now
   the single highest-leverage eval item left.
3. CNT-S3 still caps at the session-edit step — cheapen the edit-save-reload loop.
4. Everything in the GATE-7 FLEET RE-VERDICT below (five one-liners partly landed
   already; finish the classes).

## GATE-7 FLEET RE-VERDICT (vs v9 on ea2a5543; details in fidelity-gate7/pair*/report.md)

**14 gate-6 MAJORs measured CLOSED · ~49 remaining (incl. re-splits + new).** The pervasive
pattern: fixes hit the MECHANISM but miss the MEASURED anatomy. Big real closures: B7
empty-state sweep (submissions/speakers/contacts/public/agenda), overview brand-new-event
state (verbatim), home full-bleed chrome, bare-page card removal, error vocabulary on plan
editor + settings + import refusal (exact 1px/3px ink match), step-3 B9 mail preview,
public register (H1 36px, 24h times, tap targets gone), drawer Delete border, import
step-3 diffs, import file-refusal.

**⚡ FIVE ONE-LINE ROOT CAUSES the fleet pinpointed — fix these FIRST, each closes a class:**
1. **Settings.tsx:58 registers 'tracks' vs TracksRoomsPanel's SECTION_KEY 'tracks-rooms'**
   — the one unconverted B10 edit screen + a broken bookmarkable URL.
2. **auth.css.ts:43 `body{display:flex;justify-content:center}` shrink-wraps
   .chq-bare-page** — /account/password renders 354px-wide fields instead of the 820
   column (and the 404 at 553). Give the bare page flex-grow/width:100%.
3. **AUTH_CSS cascade order makes .chq-field-invalid INERT on every auth form**
   (theme.ts:176 .chq-input wins) — sign-in/forgot/reset/change-password field error
   treatment never renders. (Works under CFP_CSS — order-only bug.)
4. **The shared EmptyState type scale is ~2/3 of frame** (.chq-empty-what 15px/600 vs
   framed ~24-25px display register; reason 14 vs 16-17) — one component fix re-scales
   every zero-state in the app.
5. **`.chq-form-row-optional` inherits text-transform:uppercase** — DEC-917's lowercase
   '· optional' still PAINTS as '· OPTIONAL' across 02/04/08 modals (rulings A7/A21).
   (And 03-N2: the criteria editor flipped the ONE context frames draw as caps — swap.)

**NEW REGRESSIONS (fleet-found, user-visible):** /account/password 'Change it' button
broken (19px tall, label overflows fill; footer hairline wider than the 188px fields) ·
comms templates list binds DESCRIPTION into the NAME column (template names never shown)
· wizard sends drop template attribution (history shows TEMPLATE '—') · **comms dedupe
window DOES NOT EXIST at runtime** — resending the same template to the same recipients
40s later emailed both again, 0 skipped (A14's EMAILED/dedupe claim + step-4's skip
anatomy both depend on it; eval-relevant).

**Remaining per-section (top items):** 03: duplicated ranked-results head · is-active
edge STILL absent (pixel-identical to gate 6) · Your-plans hub still missing all 5 framed
row elements · plan-editor draft footer absent · FORM ANSWERS stacked · 07 (worst):
step-1 SLOT column + footer, templates grid overflow/overlap, history tab chrome, step-4
report anatomy + unreachable skip block, pre-flight still at step 2 · 05: files-library
columns STILL swapped + orphan row + zip policy DEC needed; upload-reject modal absent;
content-detail needs its own 1180/32 container · 04: participation panel 260 vs 420;
speaker-detail grid + theads; reminders modal unchanged (still prints localhost:8799!);
write-failed banner anatomy; NEW: free-text search excluded from hasActiveNarrowing so
search-empty shows FRESH copy · 02: SESSION DETAILS label-left grid + participant chips ·
09: field widths (dates 401 vs 200, seats 178 vs 110), no destructive-far-left footer
anywhere, olive Add-track bar persists, people-and-roles grid (broken first row), portal
what-speakers-may-edit toggles missing, CFP-edit intro bound to description column (data
bug) + FORM NAME/TIME ZONE/QUESTIONS missing, saved-embed still two stacked blocks ·
CLASS 1 admin measure (1372@114, topbar 59) untouched everywhere · 12-home: chrome
content pinned to reading measure vs 46px gutters; body 820 vs 732 (three values in
home.css.ts) · 10: active-filter chip still a pill vs ink fill; TBD room STILL public
(ruling A25); speakers toolbar still distributed; underlined initials; blue avatars.

**RULING NEEDED (user):** '· optional' paint case — in-code DEC-917 says match-the-label,
rulings A7/A21 say lowercase, frames 03--05/07/08 show caps in the criteria context.
**BLESS candidates (fleet):** agenda 'Breaks ›' control; event-switcher caret.

## GATE 7 IN FLIGHT (2026-08-15 ~03:50, boundary ea2a5543 DEPLOYED, version 798a1e52)

Full runbook clean (no new migrations; 775-statement D1 reseed; 35 R2 objects; smoke 200).
**CFP-16 CLOSED-VERIFIED at RUNTIME on prod**: call closed → accepted speaker's read view
drops Edit, edit route renders "Editing closed" with no form, uploads remain; closeDate
restored to 2026-09-02 after. Official-cap sbek running (runs/2026-08-15T07-46-32);
6-pair re-verdict fleet vs v9 in parallel (closure-focused on the gate-6 46 MAJORs);
swarm REBOOTED fresh at the boundary. This is the number-of-record run for the ~93.8
ceiling thesis: turn-diets + CFP-16 + fleet-class fixes all aboard.

## 140-TURN DIAGNOSTIC (run 02-24-33, DIAGNOSTIC ONLY — never a trend number; official cap is 70)

**The five capped areas at double turn budget: 94.3 @ 97% coverage** — ABS 96.4@100 ·
CFP 94.4@95 · CNT 93.1@94 · **CRM 100.0@100 (first perfect area)** · AIA 91.7@100.
All 13 scenarios COMPLETED (zero caps; finishes at 74-124 turns). Implied full-product
ceiling ≈ **93.8 composite** — i.e., the 70-turn cap costs ~6 points of already-working
product, which is exactly what the turn-diet lane recovers at the official cap.

**CFP-16 FIXED (orchestrator, d4616c8d) — pending runtime verify at the gate-7 deploy:**
root cause was canEditSubmission's accepted-status exception (accepted talks editable
forever past close). The close gate now binds every status; the exception moved to a new
canUploadDeliverables predicate so accepted speakers keep uploads/comments past close
(the content flow's obligations outlive the window). Runtime bar: close a CFP on prod,
load the accepted speaker's view — no Edit affordance, edit route refuses; uploads still
work.

**Also learned:** CFP-11 (scorecard second-criterion commit) PASSED at 140 turns — the
agent works around it with patience, so it costs points only via turn-burn; the defect
fix (already mandated) doubles as diet. AIA-04 fires for LEAD placements live (badge +
"2 new clashes" toast + counter) — the open half remains the co-presenter path as filed.
**CNT-14 never reached even at 140 turns** — CNT-S3's step list is structurally too long;
no realistic diet reaches bulk-export at 70. Recommend accepting CNT-14 as
likely-unjudged (compliant control exists for MANUAL judging) and not spending further
build effort on reachability.

## GATE-6 SBEK LOSS ANALYSIS (run 22-14-24: composite 87.9 @ 92% — ZERO environmental losses)

**The drops (CFP −5.4, AIA −5.6, CRM −6.0) decompose into: one re-falsified closure, a
handful of new product defects, and a TURN-CAP EPIDEMIC — 12 of 20 scenarios died at
exactly 70 turns (~5-6 composite pts sitting in unmeasured, often ALREADY-BUILT work).**

**RE-OPENED (falsified a second time): AIA-04.** The seeded lead-lead clash flags, but a
RUNTIME-ADDED co-presenter is invisible to the conflict engine AND the grid card ("the
engine only evaluates the lead speaker... SES-035 card even omits Priya"). DEC-974's
hydration covers seed-time participants, not the live-add path. Fix + verify with a
runtime-added co-presenter, not the seed. (~0.8 composite)

**NEW PRODUCT DEFECTS (eval-measured this run):**
- **P0-class · CFP-11 scorecard:** the SECOND criterion's rating buttons don't commit a
  value via click-after-scroll, and keyboard (Tab/ArrowRight) can't set them — agent
  died fighting it. Same lineage as the gate-4 scorecard P0. Runtime-verify a
  two-criterion mouse+keyboard scoring pass. (≥0.55)
- **Date-input class:** strict "11 May 2028" grammar rejects "May 1, 2027" and ISO; and
  the New-task modal SAVES ANYWAY with "No due date" when the format is rejected — a
  silent drop (fail-loudly violation). Hit in CNT and CFP new-event modal.
- **Pointer-occlusion class:** public sessions search BUTTON is covered by the input
  (Enter-only, reproduced twice); AIA "Place SES-003 at 10:00" slot button exists in the
  a11y tree but is visually covered by the placed card (drag is the only working path).
- **CNT portal (judge-major, data-loss risk, zero score cost today):** the portal upload
  session-selector RESETS to SES-001 on every load → silently forks a new version
  series; comments are scoped per-series so the fork ORPHANED a posted comment.
- **SPK bulk-email picker "effectively impractical"** (judge major): keyed to
  submissions, no select-all, full re-render per checkbox. Also blocks CRM-11/CFP-14
  evidence paths.
- **EMB cards omit speaker title/company** (~1.3 composite in our best area) · **ABS:**
  no duplicate-submission detection (seeded twins pollute rankings); "12 total" vs "34
  talks" inconsistency; results Speaker column drops co-presenters; ABS-10 sort still
  not discoverable in budget · **SPK:** portal shows placeholder avatar after successful
  headshot upload; add-speaker first submit silently no-ops on an unlabelled required
  field · **CRM import:** dedup pre-count says "0 rows match" then Review says "3
  UPDATED"; same-email duplicates survive import.

**TURN-DIET, now with scenario-path specifics (the #1 lever, again):**
- CNT lane (~2.3 pts): S3's history/Restore must be operable without scroll-loops; S1
  burned ~9 turns WANDERING THE NEW SETTINGS EDIT VIEWS hunting task creation (an
  eval-side echo of fleet CLASS 3 — the B10 rebuild should fix navigation legibility);
  CNT-12 bulk-approve gate + CNT-14 Download-all are BUILT and earning zero coverage.
- CFP-S4 (~1.7): the agent never reaches settings — two comms composes (~28 turns) come
  first. The close-the-call path needs to be FIRST-ACTION obvious; drop the /dev/mailbox
  detour (404s on prod — route is dev-only; CFP-14 stays pendingManual there).
- CRM (~1.8): the CSV wizard alone is 19 turns; CRM-03/04/06/09/11 all died queued
  behind it.
- AIA-06 (~0.5) conflict-clear demo; ABS residue (~1.4) ABS-08/09/10/13.

**ADDENDUM (coverage audit — four judge observations missed in the first distillation):**
- **AIA:** stacked clash cards OVERFLOW across the coffee-break band on the day grid
  (visual bleed when 2+ clashes stack at one slot).
- **SPK/CRM:** the Speakers LIST page was captured stuck in its loading skeleton across
  two separate judge captures — the DEC-678 first-paint class covered Content/Comms/
  Contacts/speaker-detail but NOT the speakers roster; add it.
- **CRM:** Add-to-event does not carry the contact's headshot over to the event side.
- **COMMS:** History header said "24 sent" while the list flashed "0 total" — a
  count-source mismatch on first paint (same family as DEC-518's count-source ledger;
  wire the header and list to one envelope).

**HOLDING UP under live judge evidence:** CFP close control (seen), CNT-S3 seed fix
(found fast), files library (pass), SESSION DETAILS (pass), bulk-approve gate (visible
via AIA-07's "8 held back: content not approved"), EMB-01 snippet (works).
**Harness note:** judge screenshot-attachment pipeline dropped files that exist on disk
(cost ≤0.12 composite, shaved confidence on ~6 items) — killmysaas-evals side, not ours.

## GATE-6 FLEET VERDICTS (audited vs design-frames-v9 on boundary a6ac400e; full detail per pair in chautauqua-research/fidelity-gate6/pair*/report.md)

**01:1MAJ · 02:2MAJ · 03:4MAJ · 04:5MAJ · 05:2MAJ · 06:MINOR · 07:7MAJ · 08:7MAJ ·
09:11MAJ · 10:4MAJ · 11:2MAJ · 12:1MAJ — 46 MAJORs, zero BROKEN.** Read this correctly:
v9 tripled the audited authority (empty/error states, B8, B10 edit views, new pages);
what gate-5 passed still passes (public grid exact, agenda MINOR, auth card anatomy
right, A1 bulk bar verbatim, EMB-01 ruling respected). The MAJORs are mostly the NEW
standard not yet built. Priority is the CROSS-CUTTING CLASSES — each closes findings on
many sections at once:

**CLASS 1 — admin content measure (every 1600 admin frame):** app 1440 @ 80px gutters vs
frame 1372 @ 114px; topbar 65 vs 59. One shell change; re-measures everything.
**CLASS 2 — B7 empty states are still headers-over-nothing:** submissions filtered-to-zero
(full thead + pager + live count), speakers search-found-nothing (6-col header + pager +
action cluster stay), plan-editor zero-criteria (headers + error-edge misuse), comms
history empty (search above the message). And three zero-states DON'T EXIST: overview
brand-new-event (frame 01--04; Overview.tsx has no empty branch), public sessions
programme-not-out (frame 10--20; one bare sentence + chrome), home fresh-deploy variants.
**CLASS 3 — B10 settings edit views failed as a class (11 majors):** an edit view must be
a SCREEN (‹ back + per-view H1 + consequence line), not an inline panel in the read
scroll; caps section sub-labels over 2px rules; FIELD WIDTH FOLLOWS CONTENT (dates 200,
seats 110, slug/textarea 820 — app uses four arbitrary widths); footer = destructive
far-left + Cancel + "Save changes"; kill the full-width olive "Add track" bar (the named
phone tell); people-and-roles needs the framed PERSON/ROLE/SCOPE grid + role select;
your-data needs the API-token anatomy (prefix, dates, per-row Revoke, shown-once/
irreversible facts, never-used mark); saved-embed editor still has the forbidden stacked
code blocks; portal edit lacks the what-speakers-may-edit toggles; CFP edit binds Intro
text to the form NAME (data bug) and omits FORM NAME/TIME ZONE/QUESTIONS block.
**CLASS 4 — bare-page 820 shell missing:** /account/password, /admin/* 404, and
CFP-closed all render in bordered cards; frames are full-bleed 820 columns. ONE new shell
(no border/bg/radius, max-width 820 centered) routes all three. /login,/forgot,/reset
stay on the 460 card (correct).
**CLASS 5 — error vocabulary absent where framed:** sign-in rejection has no #EFEBDF
band/3px ink edge/two-line copy and inputs take no error treatment (frame 11--09);
settings server-reject renders one unstyled line; upload-rejected modal (frame 05--07)
doesn't exist — instead a 69px-wide inline error ribbon; speakers write-failed banner has
wrong anatomy/placement; compose merge-field pre-flight fires at step 2 as a plain panel
instead of step 3's RECIPIENT/MISSING table.
**CLASS 6 — public register sweep:** H1s uniformly 24px (frames 30-40); every control
44px tall (frames 35-39 — the 44px tap target is phone grammar on desktop); 12-hour +
machine timestamps ("Tue, Sep 01, 2026, 23:59 PDT") vs frames' 24-hour + human dates;
active-filter chip pill-outline vs frame's rectangular ink fill; header pad 34 vs 46.

**Section-specific MAJORs beyond the classes:** 12-home shell boxed at 900px+border vs
CHROME IS FULL BLEED (strip shell, body measure 732) · 03: duplicated ranked-results
section head; is-active row has NO 3px olive edge and bleeds 16px outside the measure;
Your-plans hub missing 5 framed row elements (header/state pill/progress bar/action/
closed plans); no Save-as-draft path (error-rule 9) · 04: participation menu ships an
"Invited" radio that records without sending (frame: Send-portal-invite occupies that
slot) + 260px panel vs 420; speaker-detail grid 1018/34/320 + drop theads; reminders
modal lacks per-speaker rows + rendered B9 email preview (and prints a raw
localhost:8799 portal URL — env leak into copy) · 05: files library FILE/SESSION column
widths effectively swapped (filenames wrap mid-token, pitch 86-137 vs 60) + orphan
title-less action row; "Download all 21 (.zip)" → "Download all"; facet vocab
Slides/Video/Other · 07 (worst section): step-1 recipient table missing selection bar/
SLOT column/footer; templates tab overflows its grid at 1600 (buttons clip into editor);
history tab missing all chrome + B8 band anatomy; step-4 report missing the whole framed
anatomy; step-3 preview is an unstyled paragraph (B9 shell exists in src/mail/shell.ts
but is never used for preview) · 08: drawer Delete renders UA-default 2px outset border
(.chq-btn-tertiary never resets border + missing .chq-btn class); drawer THIS EVENT
missing TRAVEL/ACCESSIBILITY rows and mislabels travel_logistics as DIETARY; import
step-2 2-up grid vs framed single-column; step-3 lists all 214 rows vs the 9 updates
with diffs; bulk-email emits four identical unlabelled template links; A21 helper lines
replaced with bare "optional" · 10: public agenda renders the TBD room (ruling A25
violation — never on public; also in ROOMS IN USE) ; speakers toolbar distributed
across the measure vs right-grouped + underlined avatar initials + bulleted sessions
column + off-palette blue avatars · 02: SESSION DETAILS built but abandons the
label-left definition grid (stacked labels; participants table wrong columns/order; role
not a chip) · uppercase "· OPTIONAL" persists across 02/04/08 (rulings A7/A21 say
lowercase).

**FLEET RULINGS-ADJACENT NOTES:** (a) the app's non-personalized reset-Sent copy is
JUDGED CORRECT over frame 11--06's personalized variant (enumeration risk) — record as
ruling; (b) event-switcher caret is unframed but B8-compliant and load-bearing —
recommend BLESS; (c) upload accept-list includes .zip while frame 05--07's exemplar
rejects .zip with a rationale — needs a policy DEC; (d) numbers-as-words: headlineText
should use spellSmallNumber ("Four things" not "4 things").

## EVAL GAP AUDIT (2026-08-14 afternoon) — every non-529 point loss mapped; GAPS FOUND

Full mining of the authoritative runs (gate-4 full run + ABS/AIA re-measure + SPK run 9),
every rubric-line loss mapped to mandate coverage. Headline: **11 of 22 scenario
executions died at the 70-turn cap** — the #1 measured lever is TURN-BUDGET SURVIVAL, not
capability. Most "partial" verdicts read "the control exists; the agent ran out of turns
proving it." Changes below are part of the ⚡ priority lane.

**RE-OPENED — two closures FALSIFIED by live judge evidence (both were closed on
tests/code-reads, violating the measured-evidence rule):**
- **AIA-04 cross-room co-presenter double-booking**: SES-001 (Room 2A 10:00) vs SES-002
  (Priya co-presents, Room 2B 10:00) — NO conflict indicator, counter stuck at "1
  conflict"; grid card shows only the primary speaker. Was CLOSED-VERIFIED (wave 11) on
  unit tests. Re-verify at RUNTIME on a deploy or fix. (~0.8 pts)
- **CNT-04 portal Replace-file OVERWRITES v1**: three portal replace attempts produced no
  v2 entry. The gate-4 "exercised live v1+v2" evidence was the ORGANIZER path; the
  SPEAKER-PORTAL path still overwrites. Fix + runtime-verify the portal path. (~0.5 pts)

**⚡ TURN-DIET PROMOTED TO THE PRIORITY LANE — and it now includes CFP** (previous
turn-diet work omitted CFP entirely; CFP has the most cannot_judge weight left:
CFP-04/13/16). Required shortcuts/diets, all invisible to fidelity: fast path to CLOSE
the CFP from settings (CFP-S4 died on the edit screen); scorecard-fix re-measure covers
CFP-11/13; deep links + fewer clicks on: ABS results/Progress pages (ABS-09/10/13),
CNT speaker-profile edit/restore/export lane (CNT-10/11/14), CRM duplicates/merge tab
(CRM-06 — add to the diet list beside CRM-08/11), SPK compose→send completion (B1 seam).

**⚡ SEED FIX (cheap, big turn savings): CNT-S3 fixture mismatch** — the eval script
expects the file-with-2-versions + comment thread on SES-032; our seed puts it on
SES-001. The agent burned ~10+ turns searching. Align the seed to fixture expectations
(both D1 seed + R2), ship with next deploy's reseed.

**⚡ NEW eval items (UNCOVERED until now — cheapest points on the board):**
- **EMB public speaker bio render** (EMB-05/13, ~0.9 pts): speaker detail renders NO bio
  anywhere; data exists. One render fix closes two items (+ its "Show more").
- **EMB-01 session-card description snippet + in-place "Show more"** (~0.9 pts): public
  sessions-list cards carry no description. Frame-check vs v9 public list before styling.
- **CNT-01 New-task INSTRUCTIONS/description field** (~0.4): A15 restores deliverable
  KINDS but nothing adds the instructions text the judge looked for.
- **EMB-02 fixture-searchable publish** (~0.6): ensure sessions containing fixture
  vocabulary ("Taming", "Raman") are PUBLISHED so public search demonstrates positive
  results, not just zero-states.
- **ABS-10/08 results-page + dashboard skeletons**: `plans/:id/results` renders
  heading+Loading long enough that judges screenshot a skeleton; sort control exists
  (DEC-737) but wasn't discoverable in budget — instant-render these pages.
- **CFP-05 create-account CTA** on /submit (S-tier item stands) · **CFP-10**: reviewer
  provisioning must be REACHABLE in budget (Settings → People path, B10 frame exists).
- **SPK-10 / CNT-13 promoted from P2**: headshot has no download/view control (bare img)
  and the files library reports "0 files · 0 B" while files exist — a broken page in the
  judges' path (regression of "closed" DEC-773; runtime-verify this time).

**CNT-14 bulk export — compliant variant BUILT (65bce94b), user ratification pending:**
the swarm landed the skip-list-compliant option ahead of the ruling — a dialog-free
scoped "Download all N (.zip)" in the files-library header (POSTs visible rows to the
existing archive endpoint; absent on empty set; cap-aware disable). NO grouping dialog,
so the skip rationale is respected. If the user rules against it, revert 65bce94b;
otherwise it stands and CNT-14's ~1.0 coverage converts from guaranteed-not_found to
satisfiable.

**Recorded forfeit (unchanged, deliberate): ABS-14 AI-triage** (~0.7 pts) — we never
claim AI in the UI.

## V9 DESIGN INTAKE (2026-08-14 afternoon) — AUTHORITY IS NOW design-frames-v9

**`chautauqua-research/design-frames-v9` (135 frames / 12 sections) supersedes v8** —
8 sections redrawn on top of v8; overview/submissions/agenda/home carried forward.
DESIGN-RULINGS.md re-vendored with three new standards. Every v8 OPEN item is closed:
- **Contact drawer FIXED at source** (VAL bug) — `08-contacts--02` now renders all four
  groups (Contact/Profile/This event/Notes, "Nothing recorded" disabled ink, Delete far
  left / Cancel+Save footer). Frame is auditable/buildable again; A20 fully framed.
- **Reviewer "Your plans" hub framed BOTH widths** (03-review--10 at 1600: same list at
  the 820 reading measure; --09 at 390 derives from it). Single-plan reviewers skip it.
- **Password-reset screens delivered** (11-account--05..08: Ask / Sent / Set / No longer
  valid, all on the 460 card measure): Sent state is non-branching enumeration-safe
  ("If <email> has an account, a reset link is on its way") — matches the mechanism spec
  below; Set names the account being changed; No-longer-valid is a designed screen with
  "Send a fresh link" and duration-free copy ("already been used, or replaced by a newer
  one") — compatible with our single-use/1h/hashed decision, which STANDS (the frames
  deliberately assert no TTL; the builder owns it). Swarm: build the FULL flow now.

**ERROR & VALIDATION STATES STANDARD (new, recorded):** nine frames, one per failure
shape — public submit multi-field · sign-in rejected (one message both causes) · speakers
optimistic-rollback ("Overdue · not saved" cell + banner naming cause with Try again /
Reload) · plan-editor cross-field+empty-collection · import file-level ("import the 205
good rows") · content upload wrong-type · compose pre-flight on irreversible send ·
scorecard blocked-submit-savable-draft · settings server-only clash. **No red exists in
this system:** invalid field = 1px ink border + 3px ink left edge + 13px/600 ink message
(the overdue vocabulary). Rules: summarize at top + fix in place (anchors); say what was
kept ("Nothing was lost"); count against limits ("212 characters over"); offer the way
out; say why the field matters; credentials fail with ONE message; rolled-back optimistic
writes must announce themselves; drafts never validate; offer the partial action; name
what survived; server-only errors don't blame the input; pre-flight the irreversible.
This supersedes any improvised error styling; the scorecard draft/submit split and the
speakers rollback banner are ⚡ eval-relevant.

## V8 DESIGN INTAKE (2026-08-14 midday) — superseded by V9 above; rulings below still stand

**Authority is now `chautauqua-research/design-frames-v8`** (121 frames / 12 sections;
10 sections redrawn, agenda+home carried from v7) **plus `docs/design/DESIGN-RULINGS.md`**
(vendored) — the design agent's ruling on every design-standard-brief item. From this
intake forward, "matches a v8 frame or a recorded ruling" is the closed fidelity standard;
anything matching neither is improvisation and gets flagged. verify-frames passed (five
portal-frame 1px-border flags accepted as benign).

**KNOWN-BROKEN FRAME — do not audit or build against it:** `08-contacts--02-contact-drawer`
rendered without its four field groups (source bug: `valueStyle: VAL`/`VAL_EMPTY` constants
undefined in Chautauqua Contacts.dc.html; reported to the user for a design-agent fix).
Ruling A20's TEXT spec (four titled groups Contact/Profile/This event/Notes, "Nothing
recorded" in disabled ink, sticky footer Delete-far-left / Cancel+Save right) stands
meanwhile.

**DROP (deletions, swarm work):** public-pages Change/edit view (read view carries
everything; kill the gate) · bulk-bar "Delete…" on submissions · per-reviewer "Reset
password" in the plan editor (Settings → People owns credentials) · the Edit link under
the abstract (header "Edit title and abstract ›" covers it).

**MUST-FIX:** `/logout` — currently 404s while dropping the session. Real POST →
redirect `/login?signed-out=1`; login card carries one muted "You have been signed out."
line. No dedicated screen.

**⚡ PRIORITY BUILD BATCH (eval-relevant, frames delivered — this is the eval-lift lane):**
1. **A1 worklist bulk-approve** (05-content--00 + Content·selecting·390): 26px checkbox
   col; select-all with partial mark; ONLY re-uploads pre-ticked; bulk bar BELOW filters /
   above header — "N selected · Approving sends nothing · the speaker sees it in their
   portal · Approve N · Clear"; title row keeps quiet actions only. Phone = select mode.
2. **A5 SESSION DETAILS section** on submission detail (02-submissions--02): fourth
   numbered section after Reviews — tracks chips + Edit tracks, FORMAT + AUDIENCE LEVEL
   selects, participants table (LEAD/CO-PRESENTER, Make co-presenter/Remove), add-co-
   presenter search + "emailed a portal link · the lead presenter is not changed" note,
   eyebrow "EDITABLE UNTIL THE SCHEDULE IS PUBLISHED".
3. **A27 expanded reviews band** (03-review--00): review count is a disclosure; expanded
   band REPEATS the results table's grid — per-criterion scores under their columns,
   recused rows as em-dashes, footer "One reviewer recused · their scores are excluded
   from the mean".
4. **B1 comms seam** (Compose step 1 + step 4 frames): selection survives filter changes
   and says so; unscheduled recipients named; every step's primary is the next step, Send
   exists only at step 4; step 4 is a REPORT — leads with "21 of 23 speakers were
   emailed", names each skipped recipient with reason + retry time.
5. **A19 bulk-email template select** (08-contacts--10) + **A18 evaluation-plan select**
   indented under Include-reviewer-feedback with "Only submitted, non-recused reviews are
   merged." + **A26 public session-detail Save** in the header, same two-state control as
   list rows, same `chq_itinerary_<slug>` key.

**B10 settings edit views — the design gap is CLOSED, seven 1600 frames delivered**
(editing: event / tracks-and-rooms / CFP / speaker portal / people-and-roles / one saved
embed / your data). Build to frames; field width follows content; footer row right-flushed
(never a full-width bar); each view carries its consequence line (see DESIGN-RULINGS B10
table). Your-data: exports are actions (no edit view); API tokens own the edit view.

**B8 interaction-states standard SUPERSEDES the interim ~16px state-band rule:** hover
#EFEBDF no shift · selected adds 3px olive left edge replacing 3px of padding · expanded
band #FAF8F2 with 1px #E1DDCE rules, inherits parent grid, 16px insets · carets right-edge
via space-between (fixed-width) or 6px gap (content-width), muted ink, never a trailing
glyph · focus 2px olive outline/2px offset everywhere · disabled #8E8A7A on #DDD8C8,
genuinely-inert only.

**Sign-in REDRAWN (11-account--00 "a card, not a stretched phone") — supersedes the
732/820 hold ruling:** ~460px bordered card, vertically composed, footer row with
right-flushed Sign in. ⚠ The frame shows a "Forgot your password?" link — that capability
DOES NOT EXIST in the app; DEC pending with the user (build a reset flow vs drop the
link). Do NOT ship a dead link; omit it until the DEC lands. Demo-accounts block per
ruling A23: below the card, outside it, DEMO ACCOUNTS micro-label, prefills not submits.

**Also recorded (ruling IS the artifact — flag deviations):** A2 detail-header tertiary
links · A3 per-version Delete (tertiary, confirm only on newest) · A4 note version tags
BLESSED · A6 rail Clone/Review-content links · A7 new-submission extras BLESSED
(lowercase `· optional`) · A9 Delete-plan tertiary in footer, frozen with criteria ·
A10 anonymize toggle beside Rating scale ("Hide speaker names from reviewers") · A11
number-key scoring BLESSED unlabelled · A12 matrix-header one Edit link, Remove inside
editor · A13 Import-CSV lives on the roster, not the filter row · A14 EMAILED marker
BLESSED (micro-label) · A15 DELIVERABLE KIND restored in New-task · A17 Compose pill
BLESSED · A21 lowercase optional suffixes · A22 settings rows BLESSED ("Open as a
speaker" must say read-only; change-password moves to People beside your own row) ·
A25 TBD room column BLESSED (dashed header rule, never public) · B2 breaks editor =
2×2 modal in New-task register · B4 wave lifecycle (Start-a-new-wave = prefilled
New-plan; reviewer landing skips to queue when single-plan) · B6 portal desktop = the
390 column centered at 560, buttons shrink to right-flushed · B7 empty-state rules
(fresh hides chrome + primary; filtered keeps chrome + names the facet + escape link;
never headers-over-nothing; six empty-state frames delivered) · B9 email shell (four
620 frames: Submission received / Accepted / Tasks outstanding / Schedule published).

**OPEN from this intake:** (a) reviewer "Your plans" hub delivered 390-only — desktop
artifact missing by the pack's own reflow principle; routed back to the design agent
(cheap ruling: same list at the reading measure). (b) contact-drawer frame re-vendor
after the VAL fix.

**USER DEC (2026-08-14): PASSWORD RESET WILL BE BUILT.** The design agent is mocking the
screens; frames incoming. Sequencing: the MECHANISM is design-independent — the swarm can
build it now; the SCREENS (request form, reset form, email) build to frames when they
land, and the sign-in "Forgot your password?" link ships only once the flow works
end-to-end. Mechanism requirements (same security posture as the existing auth work):
- POST request-reset endpoint answers IDENTICALLY whether the email exists or not — no
  account enumeration (same oracle-closing discipline as DEC-004), and rate-limited in
  the DEC-180 failures-only shape.
- Token: single-use, ~1h expiry, 256-bit random, stored HASHED (a reset token is a
  password equivalent — never store it plain). Invalidated on use AND on any password
  change; only the newest token per user is live.
- Reset email goes through the existing EmailBindingMailer; template follows the B9
  email shell (560 measure, one olive button, footer naming the event and why they
  received it) until its own frame lands.
- Completing a reset enforces MIN_PASSWORD_LENGTH=12 and revokes ALL of the user's
  sessions (a reset asserts the credential was lost — unlike login's rotate-this-
  session-only rule, DEC-994).
- Runtime evidence required to close: a real reset round-trip on a seeded account
  (request → email content captured → token consumed → old sessions dead → new
  password signs in; second use of the token rejected).

## GATE-4 FLEET VERDICTS (all 6 pair reports landed, audited vs design-frames-v7 on snapshot 33fbc724)

01:2MAJ · 02:1MAJ · 03:4MAJ · 04:**PASS** · 05:2MAJ · 06:1BRK+4MAJ · 07:2MAJ ·
08:5MAJ (BRK fixed 9ba85315) · 09:5MAJ · 10:8MAJ · 11:2MAJ

Reports: `chautauqua-research/fidelity-gate4/{01-overview,02-submissions,04-speakers,07-comms,09-settings,11-account}/report.md`
(each covers its pair). **These reports are the authority for every disposition in this file.**
They also carry MINOR findings not promoted below — scribes/planners: mine them when a
surface's P1/P2s run dry, before inventing work.

Massive convergence — 04-speakers is the first PASS of the oscillation; gate-3's BROKEN +
nearly all MAJORs verified fixed (queue CTA contrast, plan-editor measure, distribute anatomy,
focus ring, draft guard, replace-keeps-versions exercised live v1+v2, speakers matrix
typography+pills).

## 3-AREA RE-MEASURE (2026-08-14 ~09:00, mini-gate SHA 63a692c3 on prod) — THE P0 FIX CONVERTED

**AIA 91.7 @ 100% coverage** (from n/a/0% — the 529 zeroing fully exonerated) · **ABS 82.7 @
93%** (from 71.7 — the scorecard-submit fix converted; mouse-driven E2E also verified by the
mini-gate probe) · SPK 72.2 @ 82% — **understated: SPK-S2 is a KILL ARTIFACT** (the external
process kill closed the browser at turn 0; the resume baked it in as attempted-failed).
Best-known composite across runs ≈ **85-86** and climbing. SPK gets ONE more targeted re-run
after the next deploy (which carries the PageSkeleton + caret + filter-row fixes prod lacks).

**P1 · Add-speaker duplicate-email dead-end** — the modal blocks on a detected duplicate with
no resolution path (re-click just re-renders the warning). Same no-forward-path class as the
bulk-template picker: offer "Use existing contact" / link to the contact, or name the action.

**P2 (re-measure):** contact drawer has no discoverable Save affordance (agents scrolled/
tabbed hunting one — if rows are click-to-edit-auto-save, SAY so; else add Save);
`/logout` 404s while still dropping the session (route it properly); PageSkeleton coverage
gaps already filed (plans/:id/results renders heading+"Loading…" — finish the P1).

## DELTA-2 PROBE (2026-08-14 ~11:30, snapshot 6c7f0132) + ORCHESTRATOR FIXES (ff8e8341)

15 open P1s measured: 6 FIXED (schedule 10--12 rebuild ✓, bulk-template picker self-describing
✓, merge six-row contract ✓, rail dup reasons+Keep both ✓, add-speaker duplicate forward path
✓, has-account plain meta ✓) · 3 PARTIAL · 6 STILL-PRESENT — of which FOUR were ONE bug:
settings.css's unscoped `.chq-settings-panel > div` stack rule silently defeating every
intended settings layout rule at higher specificity (the source-scan "closure" passed while
the render never changed — the measured-evidence rule in CSS form). **ORCHESTRATOR FIXED on
main (ff8e8341): the settings cascade defeat (definition rows/section-head/public-pages
rows/tracks grid all flip), the comms templates minmax pane split, and the agenda armed-bar
→ zero-footprint overlay on the day-tabs strip.** HANDS OFF those three shapes; regression
pins updated.

**PLANNER: DESKTOP-FIRST STILL BINDING.** Wave-12 phone tasks were premature — the mobile
queue stays closed until the desktop gate passes (standing rule). Remaining desktop items:

**~~P1 SAVED-EMBEDS EDITOR REGRESSION~~ WITHDRAWN (orchestrator code-read 2026-08-14):**
NOT a regression — bare `?edit=1` shows the saved-embeds LIST by design; the editor mounts
via each row's Edit → `?embed=<id>` (DEC-822 wiring verified intact in PublicPagesPanel/
SavedEmbedsPanel). The delta-2 probe never clicked Edit. The REAL remaining item is the
already-tracked read-view PARTIAL: v7 frame 09--00 renders the saved list AND the editor
inline in the un-gated scroll document — treat as the settings read-view design gap, not a
break. Do not hunt a phantom.

**P2 (delta-2):** compose-mount Recent-Sends `Open` should expand in place (History mount's
does; compose's navigates); import match-step: title "Match the columns" missing, panel
560 not 640 (`.chq-modal` width beats the panel max-width), match grid `288px 288px` clips
57px inside the 508 content box, and the always-on "SESSION TITLE FOR THIS BATCH" gate is
unframed (make it conditional or move it off the match step).

## GATE-5 PASS-CHECK (2026-08-14, snapshot 0bc2b12e vs v7) — VERDICTS + LAST DESKTOP REDS

**10-public-portal: PASS (clean sweep — track-highlight verified exactly to spec, zero
reflow, Save never dimmed).** 06-agenda: every DESKTOP disposition ✓ exact (armed-bar
overlay Δy=0, one z-tier, breaks disclosure, single-tone lattice, 24h gutter) — its FAIL is
phone-scoped (below). 03-review: the ENTIRE rebuild verified incl. mouse-driven submit E2E;
FAIL narrowed to two small desktop MAJORs (below). 09-settings: cascade fix landed
(definition rows 53px, ×7 eyebrow actions, tracks grid 820, read-view lists, embeds editor
via Edit ✓); its one MAJOR (public-pages read rows) + the shell wordmark/nav overlap were
FIXED BY ORCHESTRATOR post-snapshot (re-gridded summary-value; nav margin -9px→+13px — the
-9px comment's frame numbers were mismeasured; pin test updated). Reports:
chautauqua-research/fidelity-gate5/.

**P1 · Criteria-row grid: 5 tracks, 6 children** — `.chq-review-criterion-row`
`20px 534px 534px 150px 70px` leaves `.chq-review-criterion-share` ("71%") and Remove
overprinting in the last cell (both plan editor and /plans/new). Add the sixth track (share
column before the action), both illegible now.

**P1 · Distribute copy self-contradiction** — PlanEditor prints "Distribute the unassigned
applies immediately." while the flow is preview-then-confirm and the preview says "Nothing
is saved until you confirm." Drop the wrong clause (frame has no such caption; Assign-a-
reviewer's half is true and may stay).

**PHONE QUEUE — P0s for the CURRENT phone lane (both are regressions from this run's own
phone work; frames exist):** (a) **phone agenda (≤700px) renders BLANK** — the base
`display:none` on `.chq-phone-*` is only partially restored in the media query; never
restored: room-chip, slot-time, slot-card-meta/title, slot-clash, slot-free-label/length,
footer-btn, sheet — markup mounts fine, CSS eats it (frame 06--01 is exactly this view);
add a scan test asserting every `.chq-phone-*` class set to display:none has a media-query
restore. (b) **plan editor at 390 = one character per line** — reviewer/criteria rows keep
desktop grid tracks (`13.66px 140px 90px…`), doc height 8644px; frame 03--06 shows the
stacked layout (CRITERIA/REVIEWERS sections, Swap, CAP EACH, bottom Save bar).

**DELTA PROBE (2026-08-14 ~wave 21, snapshot f57ecbc6): 9/9 desktop invariants HOLD —
zero phone-round leakage measured.** Live at 1440: login 820/732 (frame ruling) · nav
margin 13px · agenda armed-bar display:none at rest · speakers toolbar selects 36px caret
clearance ×3 · contacts record-row grid 130/320 · comms templates two equal 395 columns ·
settings section-head flex row · public sessions 4 one-row filter selects with data-URI
caret + 34px clearance · review landing loads clean. The additive-reflow scan-lock is
holding empirically, not just in code review.

**SUPERSEDED by V8 intake (sign-in redrawn — see V8 section; build to 11-account--00
"a card, not a stretched phone").** ~~RULING · USER-FILED (2026-08-14, sandbox tour #2):
sign-in desktop geometry is FRAME-FAITHFUL — do not "fix" it.~~ User flagged login as "mobile-optimized and stretched"
on desktop. Measured at 1440: card box 820 (732 content + 2×44 padding), inputs/submit 732,
centered — exactly frame 11-account--00 at 1600 (its input column measures 732 with a
full-column olive Sign in bar). The 03:50 box-math amendment (e8fe9dc4) trued the app UP to
the frame (content was 644, off-frame, before it). USER RULED (same day): this is a
DESIGN-side problem — frame 11-account--00 reads as phone grammar scaled to 1600, the
swarm's frame-matching was CORRECT work, and the user will fix it in the design. Expect a
redrawn 11-account frame in a future design intake; until it lands, 732/820 stands and no
build agent touches sign-in geometry. Scoping audit of the overnight auth commits
(001a7960, 13db6d8c) found them clean — top-level additions inert on desktop, phone shells
inside the 700px block.

**CLOSED by V8 intake (seven settings edit-view frames delivered — see V8 section, B10).**
~~DESIGN GAP · USER-FILED (2026-08-14) — settings EDIT views on desktop (routed to the
design brief, NOT swarm work).~~ Every 09-settings sub-screen frame (Event / Tracks / CFP /
Public pages / Saved embeds) is 390-only; the desktop edit drill-ins are undesigned. Filed
evidence: the CFP edit view — ~340px intro textarea in the 820 column, narrow date inputs,
sparse rhythm, full-width olive Save + centered Cancel = phone anatomy at desktop. Do NOT
improvise desktop redesigns of settings edit forms; hold for frames. (The structural-batch
P1's read-view-inline work stays mandated and is unaffected. User also validated that
batch's direction: the public-pages Change view "doesn't seem to offer much" — the read
view already carries everything, kill the gate there per frame 09--00.)

**FIXED (orchestrator, d5990e2f) — embeds URL/Snippet flow.** User filed Copy/Preview
buttons floating mid-code-text. Root cause: flat inline flow (`<code>` then buttons).
Now `.chq-embeds-output-block` (full-width code box + actions row beneath); render test
asserts the buttons live in `.chq-embeds-output-actions`, never in the code's text flow.

**P2 · USER-FILED (2026-08-14): state-band insets** — tinted interaction-state bands
(results-table reviews EXPANSION rows; review-landing `is-active` plan row) put content
flush against the band edge and free-float their columns. Interim rule until the
interaction-states design ruling lands: a state band insets its content ~16px and inherits
the surface's column grid. Do not invent per-surface treatments; the design-standard brief
(chautauqua-research/design-standard-brief.md) carries the class.

**P2 (gate-5):** queue/score actions floor-clamped 180px (frame sizes to content); FORM
ANSWERS re-prints title/abstract + exposes name/email rows (curate to Format/Audience/
Notes/Accessibility — also an anonymization hygiene point); frozen panel headline/body
inverted + header row; Delete-plan unframed beside Assign; scorecard rail not sticky
(Submit below the 900 fold); tray hint wraps 2 lines at 238px; gutter rule tone vs field
rows; settings saved-embeds eyebrow rule/note; People rows emails-only + label wrap;
public MINORs from pairA (day switcher in rail column vs day-title row, agenda title
underlines, list bullets, avatar-initial underline, last select 30px short of content
edge, off-palette seed headshots).

## GATE-4 REDS — THE OPEN LIST (these supersede any older filing of the same finding)

## SBEK RUN 4 (2026-08-14, prod, gate-4 SHA 33fbc724): 82.2% @ 78.9% coverage — READ WITH CARE

CFP 88.7@82c · ABS **71.7**@82c ⚠ · SPK **79**@94c ⚠ · CNT 82@81c (turn-diet WORKING, up
from 72) · AIA **n/a@0c** (BOTH scenarios died to API-529 harness errors at turns 1/9 —
zero product signal) · EMB 88.6@100c · CRM 92.1@100c. The run rode the 529 storm; a targeted
re-measure (`--resume runs/2026-08-14T05-46-07 --areas ai-agenda,abstract-management,
speaker-management`) runs AFTER the fixes below deploy. Orchestrator runs it — not the swarm.

**P0 · Scorecard submit validation false-negative (THE run-4 ABS killer).** With both rating
criteria visibly selected (Originality=4, Relevance=2) + Recommendation + comment filled, the
scorecard still shows "Rate every criterion before submitting" and the header count stays
"0 of N" — the reviewer CANNOT submit; eval agents burned turn budgets fighting it (ABS-S2/S3
+ SPK truncations downstream). Mechanism hypothesis (two-reader): the two-column rebuild left
`Submit and next`'s validation (and the header counter) reading a stale scores-state
shape/keying while the rating pills write the new one. Fix = ONE scores store read by pills,
validator, and counter; regression test: select all criteria via clicks → submit succeeds and
counter increments.

**P1 · Admin pages render blank/heading-only on first load** (observed independently in ABS
and SPK captures: /admin/review, per-plan Results, Speakers — nav + h1 only until a
wait/re-snapshot). This is a cross-area turn tax on every eval agent and reads as broken to
humans. Diagnose the deferred data/render path (loading state must render structure, not an
empty main region).

**P2 (run 4):** review progress counter "37 of 34 evaluations in" (completed > total — the
per-plan totals read); speakers task-status filter only TINTS matching rows when "All tasks"
is selected (narrow the list or label the behavior); garbled roster note "Not chasing -
invite invited"; non-Confirmed speakers hide ALL task cells (organizer can't see outstanding
items — show cells + the not-chasing note); speaker headshots not downloadable anywhere
(Content files says 0; contact record renders bare <img>); co-presenter list absent from the
speaker's read-only submission view (edit view only).



**P1 · CFP builder header has NO Save button** (frame 04: `Preview` + olive `Save` right;
FormsPage.tsx renders only Preview — the page's framed primary action is absent).

**P1 · Scorecard reading column drops the frame's body** (frame 03--01: ABSTRACT eyebrow+rule
+ abstract + FORM ANSWERS block with 4 label|value rows; app: title → abstract ¶ → "Read the
full submission ›" then ~600px dead space). Also: rail actions must be full-width STACKED
(`Submit and next` olive over `Save draft` secondary — app has intrinsic-width side-by-side
"Save"); anonymized plans must state "The speaker's name and company are hidden while this
plan is anonymised" in the reading column (currently silent omission).

**P1 · Reviewer queue row anatomy** (frame 03--03): REF + STATE are ONE paired left eyebrow
(~8px apart; app spreads them 500px); recused rows get the outlined ~220px right action
"You work with this speaker" + keep their meta line (app: inline Undo link, meta dropped);
footer = "Showing 5 of 18  Show all 18" as one left group + "**Your** scores stay hidden from
other reviewers" right-aligned on the queue's own footer row (not the chrome footer).

**P1 · Cap row still collapsed into the WHO-REVIEWS-WHAT head** (frame 05: head = label +
`Assign a reviewer` right → rule → persistent row `CAP PER REVIEWER [8] talks each
[Distribute the unassigned] 18 talks · 36 reviews needed at 2 each · 4 reviewers`; app hides
the summary + "talks each" inside the distribute confirm panel; Distribute is a text link not
a button).

**P1 · Content status band: full-bleed is the ONE missing dimension** (every other aspect
landed: tint, top ink rule, actions inside; band is clamped x34→1406 — span x0→1440; bottom
rule color rgb(211,207,192) not hairline).

**DEC NEEDED · Worklist select-all checkbox column + filled `Approve N ready` primary** —
deliberately added (DEC-274) for eval bulk-approve capability but absent from the v7 frame,
and it makes the title row's most prominent element unframed. Options: keep (capability wins;
restyle quieter), or frame-pure (drop bulk from the worklist). Do not silently drop —
capability decisions route through the orchestrator/user.

**Pair-4 reds (07-comms FAIL 2 MAJ · 08-contacts FAIL 1 BRK + 5 MAJ):**

**~~P0-BROKEN headshot overflow~~ FIXED BY ORCHESTRATOR (9ba85315, on main):** root cause was
the drawer record-row's bare `1fr` value column — its auto min-content floor is the file
input's intrinsic ~284px, so it could never shrink into the 418px drawer (which is why the
earlier `max-width:100%` bound was a no-op). `minmax(0,1fr)` + `width:100%`; scan test pins
both halves. HANDS OFF — do not re-litigate the grid template.

**P1 · Template editor STILL at table measure** (three gates now): `chq-comms-page
chq-measure-table` renders 1372; v7 frame's templates content = 757px of 1600 (reading
measure). Change the PAGE container for the templates tab; the two panes become ~363 each.
The BODY-width fix landed inside the wrong container.

**P1 · Recent Sends vs History STILL two readers** — identical four sends: compose mount
Template column renders `—` ×4; History tab renders the template names for the same rows.
One reader (History's) feeds both. Also compose-mount `Open` ignores its row (navigates to
bare ?tab=history; the History mount's expands correctly).

**P1 · Bulk-email template picker offers 3 unsendable templates** (Acceptance/Content
Reminder/Decline preview → "recipients are missing merge fields (only speaker_name/event_name/
portal_link are allowed)" — no offending token named, no forward path). Same dead-end class
as the fixed {feedback} P1: either restrict the picker to templates whose tokens the bulk
context can merge, or grow the in-place resolver. Do not leave a picker that 400s.

**P1 · Import "Match the columns" dedicated screen** (frame 03, third gate): 640px screen,
filename · row count header, each CSV header ABOVE a sample value, dashed "Skip this column",
dedupe footer "N rows match existing contacts by email · they will be updated", primary
"Import N rows"; the step rail currently highlights "Match columns" while step-1 upload/paste
content is still on screen (make the steps real screens).

**P1 · Merge table = fixed six-row identity contract** (Name/Email/Company/Title/Labels/
Notes) on EVERY pair — app renders only differing fields and NEVER Labels/Notes while its own
footnote promises "Notes are appended"; **P1 · pipeline cards drop the MOVE-TO selects** (20/20
carry one; frame is drag-only, cards ~40% shorter); **P1 · directory-rail duplicates get the
reason line + Keep both** (second reader drops data the Duplicates tab already renders).

**P2 (pair-4):** insert-field helper count copy ("Six available" family vs "7 available");
Recent Sends timestamps "Tue 11 Aug, 4:12pm" family + single "23 sent" count; templates rows
purpose-copy; editor eyebrow = template name + Duplicate + preselect + drop NAME input; seeded
Acceptance body uses {task_due_date} + {portal_link}; Attachments card title "…and merge
fields"; EVALUATION PLAN select out of the Attachments card; one stat format; chip wording
NO SLOT YET everywhere; drawer 520 + 5 populated rows + DIETARY + one-line buttons; contacts
search placeholder fits; rules row match count + Save as a segment; merge chrome (tinted
combine box, green Not-a-duplicate link, no extra Cancel, no shouted email eyebrows); pipeline
card staleness plain at foot + rationale inline + pale outlined fit chip; add-to-event cards/
roles/selected-state; add-to-pipeline pills/black-selected/footnote-below; bulk-email subtitle
names + MESSAGE label + terminal Send; header stats 3 clauses + Import/Export/New order;
labels plain small-caps; pagination arrangement.

**Pair-6 reds (11-account FAIL 2 MAJ — near-PASS, both mechanical):**

**P1 · Auth card box-math: the design's CONTENT column is applied to the CARD BOX and padded
inward** — login content 644 (frame 732), password/404 content 750 (frame 818), every left
edge shifted 44/35px inboard. Fix: card box = column + 2×padding (732→820 box for login,
818→888 for narrow), content column hits 732/818 exactly. One CSS change + measure test.

**P1 · 404 block vertical rhythm ~2× frame** — h1→body 48 vs 19, body→links 61 vs 26 (block
186.5 vs 126). Causes: uniform card gap 26px on a tight block + UA `<p>` margin + footer-link
min-height 44 adding dead lead. Type itself is frame-exact — rhythm is the only divergence.

**P2 (pair-6):** admin-404 links = `Overview ›` + `Submissions ›` per frame 02 (app hard-codes
homepage/Log-in — wrong-door for a signed-in organizer); demo prefill buttons to card link
vocabulary (14/700 olive, no underline at rest); UA form margin-bottom 16 on login footer;
footer links min-height 44 sit 18px low; /account/password head gaps (+13/+8.5 from Back/h1
min-heights); organizer at /portal/nope should 404 not 200-to-overview; demo block is
unframed (85px below the designed footer — keep per demo utility, but note as deliberate).

**Pair-5 reds (09-settings FAIL 5 MAJ · 10-public FAIL 8 MAJ — USER PRIORITY):**

**P1 · THE ONE ROOT FIX for most public MAJORs: the pair layout is 1112, not 1180.**
`.chq-pub-sessions-layout`/`.chq-pub-agenda-layout` = `778px 300px; gap:34` — spec/frames
measure content **820** + gap **60** + rail **300** = 1180. Fixing the tokens cascades:
agenda `minmax(228px,1fr)` auto-fit yields 3 blocks across at 820 (currently 2 at 778, and a
degenerate `674px 0px` track on day 1; block gap 8→16); the filter bar's 837px of controls
fits one row at 820 (currently wraps "All rooms" to row 2); speakers List view joins the same
1108-1112 column as Grid (currently 752). Measure tests against 820/60/300.

**P1 · Public selects draw NO caret** — every `.chq-pub-select` computes `appearance:none;
background-image:none`, visually identical to a text input ("All days" et al). One shared
caret treatment (inline SVG background or wrapper ::after) across all six public selects.

**P1 · /sessions must sort chronologically** (day, then start time, untimed rows LAST) — it
currently sorts alphabetically by title with days interleaved and an untimed row mid-list;
frame 10--00 is 9:00 → 10:45.

**P1 · Agenda day switcher = ONE joined segmented control** (~210px, "Tue 12 | Wed 13 |
Thu 14" short labels, active filled near-black) — currently three detached 99px-radius pills
spanning 426px with long US dates. Related P2: ALL public dates use "Tuesday 12 May" family
grammar (h1, pills, footer, rail, gutters — currently "Wed, May 12, 2027" everywhere).

**P1 · /schedule (My schedule) was never rebuilt to frame 10--12** (new 1600 frame in pack
v7): 1180 pair with rail (TAKE IT WITH YOU: saved count + Download .ics; TWO OVERLAPS block
with "RUNS OVER THE NEXT TWO"/"INSIDE THE WORKSHOP" markers); lists the SAVED sessions with
Remove (not all sessions with Save); "4 saved · 2 overlaps" subtitle + "Browse all sessions ›";
two-line time/room gutter; DROP the duplicate day-pill row, "Show only my picks" checkbox,
and highlight control (none in frame).

**P1 · Settings structural batch (unchanged since gate-3 — schedule it as ONE wave):**
definition rows = one line `label | value | right-flushed meta` at ~50px pitch (app stacks at
88px; page 3947px vs frame 2905); read views SHOW the lists for Resources / People / Exports /
API tokens / SAVED EMBEDS+editor (still Change-gated); public-pages read rows = 4-col
`Sessions | /path | LIVE | Embed code`; section actions right-flushed ON the eyebrow row ×7;
tracks-and-rooms grid spans the 820 (two ~392 halves, counts right-flushed).

**P2 (pair-5):** agenda blocks drop the always-on 3px olive edge (hairline at rest; olive =
highlight only); highlight control inverts dark with caret when set; rail swaps to "N IN
<TRACK>" on highlight; PRINT block gets its eyebrow + caption + "Jumps…" captions; break rows
= gutter time + quiet rule + left-aligned "COFFEE · FOYER · 15 MIN" (not centered filled band
swallowing the gutter; keep room for coffee); day-1 h1 "0 rooms" vs rail contradiction; CFP
column 732 (app 663) + copy drift batch (lede, TRACK, counters "412 of 1,200" family, BIO
label+helper, footer rule, dedup account note); speakers search joins the title-row cluster;
Save on agenda blocks = uppercase text link not bordered button; chips drop the colored dot;
sessions CFP rail copy "Closes Sun 16 Aug · no account needed" family; embed editor 2-up
pairs + plain eyebrow (not native fieldset legend) + trim unframed rows + SAVED EMBEDS above
EDITING; embeds middle column = where-pasted.

**Pair-1 reds (01-overview FAIL 2 MAJ · 06-agenda FAIL 1 BRK + 4 MAJ):**

**P0-BROKEN · Break bands struck through in select mode — the clash-card z-order bug
REAPPEARED on the new element class.** Armed, 20 slot buttons (z-index 6) underlie the lunch
band (z-index 4), painting 1px bottom borders straight through "12:00 · LUNCH · FOYER · 60 MIN"
and slicing the band into strips. Fix the CLASS, not the instance: slot-button borders must
never paint above ANY grid overlay (clash card, break band, or future overlays) — one z-order
rule + a regression test that arms the grid and asserts no rule crosses any overlay's box.

**P1 · Unframed breaks EDITOR panel displaces the agenda canvas 308px** — `.chq-breaks-panel`
(label + 2px rule + rows + 4-field add form) sits between head and grid; frame chrome is 153px
and shows ~687px of grid at 900 viewport vs the app's 333px. v7 designed the PUBLIC breaks
display, not an admin editor — this is a real design gap (the user's "no screen for it" rule).
Interim direction pending design: collapse the editor behind a disclosure on the head row
("Breaks ›" link opening a small panel/modal) so the canvas keeps frame chrome height; do NOT
delete the capability. Also restore the frame's two full-width day-bar rules (y138/y192).

**P1 · Shared chrome: unframed 48px full-bleed sign-out FOOTER on every admin page** — frame
puts "JORDAN A. · SIGN OUT" in the header right; no v7 frame has a bottom chrome bar; it
permanently costs 48px of viewport. Move sign-out into the header identity, delete the footer.

**P1 · Tray anatomy trio:** hint copy permanently clipped ("…click Uns…" — nowrap+ellipsis in
a fixed 268px tray; frame copy fits); `· 30 min` duration renders OUTSIDE the card as a
dangling sibling line (belongs inline on the ref line "DFC-033 · 10 min"); drop the
`.chq-session-card-tracks` line from tray+grid cards (frame: ref/title/speaker only) and count
becomes bare right-aligned "6" not "(1)".

**P2 (pair-1):** overview quiet-row value column: Public-pages row offset 304.3 vs the strict
220.5 of its siblings and 12px vs 14px (the ONE surviving gate-3 overview MAJOR — fix the row
to the shared two-column grid + summary copy "17 sessions live, with speakers and schedule");
stat band bolds only the nearest "Today" (tie: both bold or neither); §03 artifact meta add
size + relative time; "Place at 13:00" drop the room suffix; NEXT-FREE-SLOT caption
sentence-case; modal head rule ink; modal title 23px; ENDS placeholder "13 May 2028"; spell
small numbers; §04 "Tue 12, 10:00" grammar + single duration + lowercase format; 15-min
midpoint rules dropped (single #EDE9DD tone, 18 rules not 36); gutter 63px; clash-cell hover
disclosure; caption "ROOM DOUBLE-BOOKED"; armed-bar reserved 38px (head→tabs 78 vs 29 — find
a no-shift approach that doesn't reserve dead chrome); day-pill 29px h + 11.5 gaps; head
summary gap 15.5px; "Auto-schedule" 35px + 9px gap; cards inset ~3.5px off the column divider;
header height 57.5 + nav gaps; chrome header/rhythm spacing per measured deltas.

**P2 batch (gate-4):** submissions section counters "01 —ABSTRACT" glued em-dash (all six
detail sections); builder field extras (Job title/Company/Speaker bio unframed, Abstract
order) + Add-a-question as green text link + Track row handle/Edit treatment + built-in Edit
stays green; Columns picker 44px square in a 26px pill row; subtitle recomputes to filtered
set; new-submission modal extras; ← vs ‹ glyph mixing (also review's "← Your plans");
scorecard "N of M done" belongs in chrome header right; queue progress caption right of bar
on the same line; recusal copy "Recuse me from this one"; locked banner second sentence;
"Scores average by weight" as right-aligned eyebrow; ASCII "--" in ratchet dialog; draft
guard should also cover global-nav exits; speakers "Has account" back to plain lowercase
meta (regressed to a chip); extra EMAILED marker unframed; content RE-UPLOADED emphasis
inverted (bold ink) vs NOT REVIEWED muted; band copy two-line + agree with worklist label;
files library Download all on header block; kind vocabulary "Slides · N versions".

## CARRIED-OPEN RESIDUE (pre-gate-4 clauses that survived the prune)

Everything below is either **STILL-PRESENT at gate-4 but not covered by a red block above**,
or **unmentioned by any gate-4 report** (tagged). Nothing here is a new finding.

**Overview / agenda**
- top toolbar buttons 42.8px vs frame 37.0 (vertical padding only); "No action needed" row
  pitch 58.4 vs frame 51 — gate-4 STILL-PRESENT (MINOR).
- **"VENUE · OPTIONAL" → "VENUE"** — label renders "Venue · optional" (`.chq-form-row-optional`)
  *and* placeholder "Optional"; gate-4 STILL-PRESENT.
- gutter time zero-padding — the three-grammar defect is FIXED to one 24h grammar, but the app
  renders "09:00" where the frame reads "9:00 / 9:30 / 10:00" (gate-4 MINOR residue).
- §04 clash tail needs a real no-wrap guard — gate-4 records it as FIXED **in this data only**
  ("no `white-space:nowrap` on the tail span, so it is data-luck, not a fix in kind").
- no-room toast copy **(unverified at gate-4** — not reproducible; no room-less column in this
  seed, same as gate-3).

**Submissions / review**
- review rows still one line heavier than frame (frame: `Sam Whitfield 4.0 18 Mar` + comment;
  app adds rubric + Recommendation lines) — gate-4 STILL-PRESENT. (The 2dp→1dp half is FIXED.)
- speaker rail history line — frame adds "2 submissions this year · spoke in 2026"; gate-4
  STILL-PRESENT.
- **bulk-bar "Delete…" DEC** — not in frame 00; gate-4 STILL-PRESENT.
- `aria-pressed` on scored segments — all 10 rating buttons return `null`; gate-4 STILL-PRESENT.
- orphan `Download CSV` + duplicated results headings + `.chq-pager` on `/plans/:id/results`;
  the landing embeds the full 30-row ranked table with a Prev/Next pager where frame 00 shows a
  4-row preview — gate-4 STILL-PRESENT.
- landing `Remind the 4 not started` right-aligned in REVIEWER PROGRESS + track subtitles on
  the rows — gate-4 STILL-PRESENT.
- queue meta audience level — rows read "Talk, 30 min"; frame "Talk, 30 min · advanced";
  gate-4 STILL-PRESENT.
- reviewer chrome carries the FULL name (`SAM WHITFIELD`); app abbreviates to `SAM W.` —
  gate-4 STILL-PRESENT. (The footer-vs-header sign-out half is the gate-4 shared-chrome P1.)
- locked banner heading/body still inverted and duplicates the LOCKED eyebrow — gate-4
  STILL-PRESENT (its missing second sentence is in the gate-4 P2 batch).
- **extras audit** — unframed on the plan editor: `Reset password` per reviewer row,
  `Delete plan`, the `rating`/`dropdown` kind column (gate-4 STILL-PRESENT); the scorecard's
  "Tip: number keys 1-9…" hint **(unverified at gate-4)**.
- **plan-name scoping**: scorecard eyebrow must name plan · track · round — app renders
  "PROGRAM COMMITTEE REVIEW · ALL TRACKS" with no round (and it contradicts the same plan's
  queue subtitle "AI Engineering"); gate-4 STILL-PRESENT. criteriaForRound makes this
  load-bearing.
- **SEED**: spread evaluation scores so rank order isn't arbitrary **(unverified at gate-4)** ·
  a second reviewer on plan 0003 so frame 03's four-reviewer distribute table is reproducible
  **(unverified at gate-4)** · RESTORE seed_saved_view_0001 **(unverified at gate-4 —
  `saved_view` count 1 stable, provenance unconfirmed)**. (maxEvaluations is FIXED — all 4
  plans render "· 3 reviews each".)
- shell still fires one non-fatal 403 organizer overview fetch right after reviewer login —
  make the shell skip it for reviewers **(unverified at gate-4)**.

**Speakers / content**
- speakers matrix polish residue, all gate-4 STILL-PRESENT (MINOR): All-tasks select 242px vs
  frame 86; toolbar controls 44px vs frame 33; unframed Edit/Remove links in the task column
  headers; "Showing 1-10" hyphen; skip-copy "EMAILED" not "REMINDED"; unframed "Import speakers
  from a CSV" link; identity block 3 lines (pill + Remind inline) vs the frame's 4.
- upload cells show "File" inline right of the pill — gate-4: the truncated filename is gone but
  **nothing replaced it**, and no seeded task carries an upload deliverable (seed + affordance).
- participation menu *(sub-800 modal frame — informational at gate-4)*: `.is-current` row
  renders no tint band; NOW is an inline filled chip at x=135 in a 260px panel, not
  right-aligned — STILL-PRESENT.
- **DELETE ROUND-TRIP — still narrowed.** The SEEDED-contact case (orphaned `task_assignment`
  rows → DEC-921 409 that permanently inflates roster stats; DEC-886 prose contradicts
  implementation) was **not re-tested at gate-4** (no speaker created that round).
- upload dropzone caps text is a long sentence vs the frame's "PDF, KEYNOTE, POWERPOINT OR MP4"
  and omits the mp4/mov/webm its own `accept` allows — gate-4 residue of the MOSTLY-FIXED zone.
- content polish residue, all gate-4 STILL-PRESENT: LATEST FILE = per-kind summary
  ("Slides v3 · recording v1") not "deck-v2.pdf · v2"; library VERSION cell bold accent caps;
  library search placeholder clipped; headshots sort atop the library with empty SESSION cells;
  version rows "NEWEST" right-aligned + no per-version Delete; notes placeholder "Write a note —
  sent with the decision, and kept on the thread"; ONE chip per KIND (SES-005 renders two
  "Presentation · 1 version" chips); one time convention.

**Comms / contacts**
- comms header subtitle real figures — frame "4 sent in 7 days · last Tue 4:12pm"; gate-4
  STILL-PRESENT.
- templates residue not in the gate-4 P2 batch (all gate-4 STILL-PRESENT, MINOR): editor footer
  `Save` + `Use in a send`; template row actions wrap (Delete orphans to line 2); extra Compose
  pill.
- pipeline header — `Pipeline` h1 + `‹ Contacts` + "20 people · drag between columns"; app shows
  eyebrow "SOURCING PIPELINE" + "20 people"; gate-4 STILL-PRESENT.
- DEC-868 `Add a rule` dashed-outline button vs the frame's green text link **(unverified at
  gate-4** — the report dispositions the rule row's shape and its missing count/save-as-segment,
  not this control).
- **USER (drawer action row): "Delete this contact" shows the BROWSER-DEFAULT blue-gray focus
  ring** — `.chq-btn-tertiary` has no focus-visible treatment; give tertiary buttons the
  design-system olive ring and sweep other tertiary/link-button classes **(unverified at
  gate-4** — no report dispositions `.chq-btn-tertiary`).
- customFields/Labels: the MERGE view renders raw lowercase custom-field keys — apply the
  server-side formatting **(unverified at gate-4**: the merge table omits Labels entirely, so
  the formatting cannot be observed until that row lands).
- **Verify-then-close**: data-loss trio REMAINDER (headshot-upload-discards-bio, CSV bio
  overwrite) **(unverified at gate-4)** · comment version TAGS renumber after a version delete
  (store-vs-display drift, no content loss) **(unverified at gate-4)**.
- DEC-979 delete cascade / pipeline-restore timestamp — **not re-tested at gate-4** (shared
  snapshot, mutation avoided); carried from gate-3.

**Settings / public / portal / account / home**
- Settings ISO dates + hints on definition rows, and Dates as one row "12–14 May 2027" +
  right-flushed relative pill — gate-4 STILL-PRESENT (the row *anatomy* is in the gate-4
  settings structural batch; this is the value grammar).
- Settings H1 not aligned to the rail edge — gate-4 STILL-PRESENT.
- Settings label drift — frame "Custom questions — 4 — format, audience level…" (lowercase) vs
  app title-case; frame eyebrow "EVENT" vs app "EVENT SETTINGS"; frame "Public pages" vs app
  "Public pages and embeds" — gate-4 STILL-PRESENT.
- "Turning one off breaks it wherever it is pasted" still sits on its own line under the
  eyebrow instead of right-flushed on the SAVED EMBEDS eyebrow — gate-4 PARTIALLY-FIXED residue
  (the sibling caption did land beside Build-an-embed).
- **caret focus ring** — `.chq-eventswitcher-menu-btn` is a 24×23 button holding only "▾"; the
  2px olive focus box around a bare glyph reads as stray. Give the switcher a larger focus
  target (ring around name+caret group). Gate-4 STILL-PRESENT on both 01 and 09.
- submission-delete: add the detail-page action (bulk-bar path is CONFIRMED WORKING;
  discoverability is the open half) + the blast-radius page's primary opens a SECOND confirm
  modal **(unverified at gate-4** — the report dispositions the flow as holding, not the
  discoverability or the double-confirm).
- Edit-the-form should link the question builder · portal Change edits welcome/pills/tasks ·
  styled resource picker · markdown rendered view — all **(unverified at gate-4)**.
- **SEED settings**: display names · per-track scopes · a NOT PUBLISHED page **(unverified at
  gate-4)**.
- Saved embeds: the SavedEmbedsPanel quick-save form still hardcodes iframe/{} instead of
  carrying the recipe (two save paths, different fidelity) · "N on · M off" header count ·
  footer caption **(unverified at gate-4)**.
- Speakers footer caption "Only 'Invited' sends anything…" **(unverified at gate-4)**.
- **public sessions row gutter** — frame is 268px two-line "9:00 / Main Stage"; app is 126px
  carrying a wrapping "9:30 AM–10:00 AM" plus "Fri, May 14, 2027 · Room 2A" (three visual
  lines). Gate-4 MAJOR, NOT folded into the 1112 root fix — build it with that wave.
- public sessions copy residue (gate-4 STILL-PRESENT, MINOR): speaker line is a bare name
  (parentheticals still render); "TALK, 30 MIN" comma grammar; the extra "Sessions" H1. (The
  duplicate "7 of 7 sessions" row is gone.)
- per-day section capping "4 more on Tuesday  Show all 9" on /sessions **(unverified at
  gate-4)**.
- public CFP residue not in the gate-4 copy batch: email input `type=email` (gate-4
  STILL-PRESENT); the YOU section break is 15px vs the frame's ~54px (gate-4 MOSTLY-FIXED);
  track radios carry the required marker + single-choice error copy "Select a track"
  **(unverified at gate-4)**.
- CFP confirmation — no spam-folder line; the meta card is only the title (frame carries
  track/format meta); confirmation measure consistent with the form (620 vs 662 inset drift)
  **(unverified at gate-4)**.
- Portal **(unverified at gate-4 — every v7 portal frame is 390px, so the fleet ruled them out
  of desktop scope; re-file to the mobile queue if they persist)**: portal-home ISO date
  (one-line formatter) · the seed's real double-booking is unflagged · date restated ×3 per row
  · portal header on the body grid · task vocab → TO DO/DONE everywhere · .ics footer CTA.
- **Home (marketing) — GATE-2 strict FAIL, no regression; no gate-3 or gate-4 report covers it
  (unverified at gate-4)**: drop the extra stacked Speakers action (one centred action/row) ·
  shell body → --chq-paper · API docs 12px · main/footer landmarks · published-row meta
  qualifier · section head 4pt. (CORRECTION on record: bare session counts are frame-legal.)
- Password-CTA chrome vs frames 14/15: echo the submitted address · separate "Already have a
  password? Log in ›" block · primary button "Log in to track it" **(unverified at gate-4;**
  the eyebrow "SUBMITTED · ‹ref›" and "That's in. Check your email." are confirmed present).
- **Grader P3s (unverified at gate-4)**: label New-event Timezone · explicit CFP publish
  affordance · close-before-open validation loud at the field.
- CFP builder content column 820 vs the frame's 756 inset **(unverified at gate-4** — the
  report grades the 820 container as conforming and files the header's bleed instead).

**Still open from SBEK RUN 3 (all unverified at gate-4 — no fidelity report covers behaviour)**
- **P1 · Conditional field logic not applied on the public form** (CFP): "Show when Format eq
  Workshop" saves and displays in the builder but the public form always shows the field.
- **P1 · Conflict engine gaps** (AIA): speaker double-booking flagged on one pair but MISSED on
  another same-slot different-room pair (SES-033/SES-003 vs SES-031) — CLOSED-VERIFIED (wave 11,
  test/conflicts-cross-room-copresenter.test.ts::findConflicts emits exactly one speaker_overlap
  naming both submissionIds for a same-slot different-room co-presenter clash); co-presenters
  (Participants) invisible to the agenda card DISPLAY — CLOSED-VERIFIED (wave 11,
  test/conflicts-cross-room-copresenter.test.ts::getAgendaPayload carries the conflict AND both
  sessions' speakers arrays include the co-presenter); conflict label attaches to only one of
  the two clashing cards — CLOSED-VERIFIED (wave 11,
  app/src/pages/agenda/SessionCard.conflict.render.test.tsx::renders both cards, in different
  room columns, as data-conflict="true" with the " (conflict)" accessible-name suffix). (The
  engine's co-presenter *visibility* is closed server-side — DEC-974.)
- **P1 · "Remind laggards (N)" 500** — same mailer cause; verify it heals with the boundary
  fix. — CLOSED-VERIFIED (wave 11, test/review-remind-laggards.test.ts::"200s with a
  structured partial-failure body, never a 500, when one recipient's send throws"). **"Submission
  (removed)"** label renders for a live assignment on the who-reviews-what
  list. — CLOSED-VERIFIED (wave 11, app/src/pages/review/PlanEditor.render.test.tsx::"renders
  reviewer scope by name, never by ULID, and words a null label as removed" — extended to also
  assert a genuinely dangling submission-scoped row still renders "Submission (removed)").
- **P2 · duplicate-contact hygiene** (SPK+CRM): manual Add-speaker doesn't match an existing
  email → three Priya Raman rows; CSV import creates a synthetic "Imported speaker batch talk"
  accepted session per row (pollutes submissions/agenda); returning-speakers KPI reads 0 until
  a re-import (gate-4 header stats still print "0 returning speakers"); the "already on this
  event" dialog's only affirmative silently adds a second session.
- **P2 · misc from run 3**: SBEK-PORTAL-BIO-01 fixture string on the public speaker detail ·
  embed accent-color option doesn't re-theme the rendered embed · picks-only itinerary renders
  empty time-group headers · search + day-pill combine silently to "No sessions" ·
  blank-render flash on Contacts/Speakers needs a loading state · CFP required-field errors
  rely on native tooltips only, "Key takeaway" required (check seed intent) · portal task
  "Finalize bio + headshot" is actually a session-file upload widget (semantics mismatch).

## DESIGN AUTHORITY

- **Frames: `chautauqua-research/design-frames-v7/`** (verified manifest) — the superset; every
  section is judged against v7, including the redrawn section 10 and the review pack's
  `03-review--00..08` (the reviewer queue + scorecard have DESKTOP frames for the first time).
  Zips: `chautauqua-research/design-pack-v7.zip`, `design-pack-review.zip`.
- **Vendored to `docs/design/`**: the `*.dc.html` packs + README. The README is the code-level
  spec — read its "Widths", "Public agenda — desktop", "Public filter bar — one idiom, four
  surfaces", "Reviewer surfaces" and "the queue is scoped to a plan" sections before building
  on those surfaces.
- **Width system (README §Widths is the page-width AUTHORITY; class belongs to the CONTENT):**
  READING 820 centred (Overview, session detail, CFP form + confirmations, login, CFP form
  builder, Comms template editor) · READING + RAIL (Settings = 820 centred on the page with the
  rail hanging in the LEFT margin, `minmax(196px,1fr) minmax(0,820px) minmax(0,1fr)`,
  rail `justify-self:end`; public = 1180 centred pair, 820 + 60 + 300) · TABLE 1440 centred
  (Submissions list, Contacts directory + pipeline, Content worklist + files, Review plans +
  results + plan editor, Comms compose, Speakers matrix) · CANVAS uncapped (agenda grid ONLY) ·
  **submission detail = 1180** · CHROME ALWAYS FULL BLEED.
- **Supersession for fidelity agents:** the gate-2/3-era review clauses "rating segments equal
  spans across 820", "scorecard is `.chq-measure` 820 single column" and "queue full-width
  action" are ALL DEAD — judge 03-review exclusively against 03--00..08.
- **NAV RULING (pack-internal discrepancy):** frame 10--00's header still shows a "Gallery" nav
  entry; frame 10--01 and the README drop it. The README + the standing USER DECISION win.
- **USER DECISION (2026-08-13) — DROP "Gallery" from the public nav.** Public nav = Sessions /
  Speakers / Agenda / My schedule. Speakers is ONE nav section (DEC-990 one-page-two-views); the
  List/Grid toggle owns the switch; `/gallery` keeps resolving as the Grid URL for deep links and
  embeds, has no nav entry, and highlights "Speakers" when active. Do not re-file the missing
  Gallery nav entry. (Gate-4 confirms this shipped.)
- **USER DECISION (2026-08-13) — public submit form goes SINGLE-SELECT track radios** per the
  frames; keep the many-to-many model underneath; reseed the two 2-track sessions single;
  format = radio cards, audience = 3-pill segment.
- **SEED (open):** frames depict 18 published sessions across 3 days with breaks and 4 saved
  picks; gate-4 measured day 1 rendering "1 session · 0 rooms". Enrich the published set (+
  breaks rows) so the agenda's multi-block rows and per-day counts are demoable.

## MAILER — CLOSED (2026-08-14): USER CONFIRMED INBOX RECEIPT of the gate-4 verification
email ("We received your submission: Gate-4 Mail Delivery Verification" at the test mailbox).
The Cloudflare send_email binding + EmailMessage/raw-MIME shape delivers real mail end-to-end.
The rich-shape fallback branch (chautauqua-qa mail-rich-shape-fallback) is RETIRED. The
runtime-evidence bar below remains standing policy for any future mailer change.

## MAILER — USER DECISION, EVIDENCE BAR, MIME, STATUS

**P0 · USER DECISION (2026-08-13): REVERT PROD MAIL TO CLOUDFLARE EMAIL SERVICE — DEC-996 IS
SUPERSEDED.** DEC-996's premise is FALSIFIED BY EMPIRICAL EVIDENCE: the user RECEIVED real
emails from the Cloudflare `send_email`/EmailBindingMailer implementation; the gate-2 prod
email_log showed honest per-recipient results ("2 failed, 21 sent" — failures were reserved
example.com recipients); the SES-039 confirmation dispatched. Commit 9131a53a's "unusable"
verdict was static analysis (it pattern-matched the binding name to the Email Routing API and
inferred prod couldn't send) with ZERO observed runtime failure. Do not re-litigate this
without new RUNTIME evidence.

**What counts as runtime evidence (and what does NOT):** evidence means, on the DEPLOYED PROD
worker, either (a) the binding API itself rejecting the call — an error naming the send_email
contract, captured verbatim and reproduced — or (b) the log claiming `sent` while a REAL,
deliverable mailbox (the user's test address, not example.com) verifiably received nothing.
NOT evidence: anything observed under `wrangler dev`/workerd local simulation (local never
really sends); `failed` email_log rows for reserved or undeliverable recipients — the seeded
sbek personas are all @example.com, so failed rows for them on prod are the honest-reporting
boundary WORKING, not the binding breaking; type errors or shape mismatches found by reading
code or docs; tests driving the adapter over a stub. If a wave believes it has (a) or (b),
file it to this mandate with the captured error/log — do not swap mailers unilaterally.
**Swarm agents NEVER deploy to prod, never run wrangler against the remote, and never
send mail against prod to gather evidence** — prod-side evidence arrives exclusively
through the orchestrator's gate deploys and official sbek runs. This restates the standing
rule; the runtime-evidence bar above is a filter on what those orchestrator runs surface,
not an invitation to probe prod.

**P1 · MIME-construction defects in EmailBindingMailer (orchestrator code review, 2026-08-13 —
fix BEFORE the gate-4 delivery test so structure doesn't muddy the shape verdict):**
(a) **Header injection**: `Subject:`/`From:`/`To:` interpolate raw strings; CRLF in a subject or
contact-derived display name injects headers. Strip CR/LF and RFC-2047-encode non-ASCII header
content (subjects with em-dashes/diacritics are currently invalid 7-bit headers). Test: subject
with "\r\nBcc: x@y" renders as ONE header line.
(b) **ICS is a sibling of text/html inside multipart/alternative** — declared as an alternative
BODY, not an attachment; clients may show only the ICS or drop it (this touches the eval's
calendar checks). Correct: multipart/mixed wrapping [multipart/alternative(text, html),
text/calendar attachment].
(c) **No Content-Transfer-Encoding on text/html parts** — UTF-8 bodies under an implicit 7bit
CTE, and long HTML lines exceed the 998-char limit. Use quoted-printable (or minimally 8bit) on
both parts.
(d) **Fixed boundary "chq_mime_boundary"** — a body containing that literal shatters the
structure. Random boundary per message (no Math.random in pure-core? derive from newId()).
**PREFERRED FIX (user-endorsed direction): do not hand-patch buildRawMime — replace it with
`mimetext`** (the library Cloudflare's own send_email docs recommend for building EmailMessage
raw content; small, zero-dep, workers-compatible). It solves (b)/(c)/(d) by construction and
most of (a); keep a thin wrapper that strips CR/LF from header inputs, and keep the injected
binding/factory, never-throwing makeMailer, and single-writer logging exactly as they are —
the DEPENDENCY replaces only the serialization, not the adapter. Check bundle-check budget
(mimetext is ~small); pin the structure with one test asserting multipart/mixed >
[alternative(text,html), calendar] when ics is present.

**STATUS (wave 57): REVERT LANDED (a9b85eb7) — with ONE open runtime question.** The swarm's
implementation keeps the binding but sends `new EmailMessage(from, to, rawMime)` (documented
Workers contract, lazily imported at the composition root) rather than the Stage-2 rich
`{to, from, subject, html, text}` object that the user's received mail empirically validated.
Nobody has runtime-verified the EmailMessage/MIME shape on this zone. Per the runtime-evidence
rule this gets settled AT THE GATE-4 DEPLOY, not by more analysis: the orchestrator triggers a
real send to the user's test mailbox from prod and checks (a) email_log status and (b) actual
receipt. If the MIME shape fails or claims sent without delivery, the rich-shape implementation
is preserved on branch `mail-rich-shape-fallback` (786642f7) in the chautauqua-qa clone — swap
same-day. Swarm: no further mailer changes until that verdict.

**Resolved history (pointers only):** the RESEND_API_KEY P0 (every prod send path 500ing,
5 sbek criticals on one cause) is closed by the revert plus the wave-43 boundary work —
guarded construction at all 8 send sites, per-recipient `failed` rows, `/api/v1/mail-status`
surfaced as the Settings "Email" row (gate-4 verified: "Email — Dev mailbox (/dev/mailbox)").
`src/mail/resend.ts` + RESEND_API_KEY are deleted; no dual-mailer shim. Reserved-domain
(example.com) recipients failing at send is CORRECT honest behavior. The full revert recipe is
in the archive. Delivering real mail still needs the user to mint keys/verify the zone —
USER DECISION, filed separately. The downstream "0 total" audit-trail finding (SPK graders,
"P2 Comms audit trail") is being closed by tasks w43-a/b/c — do not re-file until their
landing is verified.

## COLLAPSED HISTORY (pointers — do not re-open without new evidence)

- **CLOSED-VERIFIED (wave 43)** — 12 items re-verified by opening the named file:line on `main`
  (reviewer-queue CTA contrast, per-round anonymization server-side, co-presenters in the
  conflict engine DEC-974, speaker deliverable write locks, saved-embed stored format DEC-850,
  per-surface published counts DEC-816, `/schedule` search+track+format controls,
  new-submission format round-trip, createTask assign-to-all DEC-746, organizer
  add-co-presenter role validation DEC-784). Details in the archive. **One of them is
  contradicted at gate-4 — see the note at the foot of this section.**
- **P0 reviewer lockout — CLOSED** (probe-2, end-to-end: sbek-reviewer login → /admin/review →
  scorecard → live rating inputs). Regression test `test/review-queue-shape.test.ts` guards the
  closed-plan envelope; re-verified live at gate-3 and again at gate-4 (recused rows render).
- **SBEK RUN 3 (2026-08-13, prod, gate-3 SHA): 87.4%, down from 91.5% — ROOT CAUSE WAS CONFIG,
  NOT UI.** Areas CFP 90.7 · ABS 91.7 · SPK 88.3 · CNT 72.0 · AIA 86.1 · EMB 91.4 · CRM 94.4;
  10 of 19 scenarios died at the 70-turn cap, most of them burning turns retrying the mailer
  500s. Both P0s are resolved: the mailer P0 by the revert + boundary work above, and
  "Replace file DESTROYS the previous version" by the version-retention fix — gate-4 exercised
  it live (v1+v2 retained, chip "Presentation · 2 versions", `REPLACED` marker, both cleaned
  up). Full report: `killmysaas-evals/runs/2026-08-13T16-55-22/`; its surviving P1/P2s are in
  the residue section above. TURN-DIET: judge it fresh at gate 4 now that the 500s are gone;
  CNT-S3 remains the structural target.
- **GATE-3 FLEET VERDICTS** — all 11 sections FAIL, reports at
  `chautauqua-research/fidelity-gate3/*/report.md`. Superseded by the gate-4 verdicts above;
  gate-3 reports remain readable but gate-4 is the authority.
- **DELTA PROBE w49 (snapshot 2cfc855a)** — 28 P1s measured, 16 FIXED. Its whole "GATE-4
  BLOCKING SET" is now resolved or absorbed: agenda chips, public search row, Gallery nav
  (user decision), distribute preview, `/admin/*` 404 and the headshot overflow (orchestrator
  fix 9ba85315) are done; tracks-and-rooms 488px is carried by the gate-4 settings batch.
  **Its PARTIAL (19) is overruled** — see the contradiction note below.
- **ANONYMIZATION POSTMORTEM** — the read-model is CORRECT and per-plan semantics are BY
  DESIGN; the scored "critical" was an unsaved draft (checkbox never Saved). Re-confirmed at
  gate-4 by round-tripping plan 0003's `anonymized` flag (speaker line disappears, flag
  restored). DO NOT TOUCH the read model. The draft-discard defect it exposed lives on only as
  the gate-4 P2 clause "draft guard should also cover global-nav exits".
- **Cross-cutting closure ledger** (probe 2026-08-13, snapshot e254eca): Contacts DirectoryRail
  DEC-710/711 · stale nav badges · form-builder row anatomy DEC-715 · Review landing grammar
  DEC-706/707/708 · assign-by-track preview/confirm · Comms Body-width + URL-state tabs DEC-710
  · History count · content file-version delete DEC-713 · comment-loss across versions · content
  file-input styling.
- **Per-pair "verified fixed" ledgers from gate-3** (pairs 3/4/5/6) are absorbed into the gate-4
  dispositions and deleted; gate-4 re-verified the load-bearing ones as HOLDING.
- **GATE-2 SBEK: 91.5%** (coverage 93.4; SPK recovered 75→89.1 on turn-diet; CNT 73.9 was pure
  turn budget). **GATE-1 SBEK: 90.1%** — target hit, evidence-driven not functional. Both runs'
  standing lesson is the click-depth/turn-budget audit in EVAL-COVERAGE below.
- **NOT defects (do not re-file):** no password-reset flow (unframed; `/claim/:token` is the
  recovery path) · reserved-domain send failures on prod · bare session counts on the marketing
  home.
- **CONTRADICTIONS a human should settle:** (1) wave-43 CLOSED-VERIFIED asserts "Comms History
  and Recent Sends are ONE reader" from code (both call `?groupBy=batch`), but gate-4 measured
  them disagreeing on the Template column for identical rows — the gate-4 MAJOR stands and the
  closure was a false negative (same endpoint, two renderers). (2) delta-probe w49 said the
  template editor's "820 reading" clause was MIS-SPECIFIED vs frame 07--02 and should be
  dropped; gate-4 pixel-measured the frame's templates content at 757px of 1600 and files the
  1372 table measure as a MAJOR for the third gate. Gate-4 wins; w49's PARTIAL (19) is void.

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
- Weighted-score label CLOSED (probe-4); residue: caption under it still says
  "Mean of submitted reviews · recusals excluded" — update to describe the
  weighted blend.
- CRM KPIs CLOSED (probe-5: "0 returning · 1 events" rendered). Pluralization nit
  FIXED at gate-3 ("1 event" per 08 report).
- Per-speaker "Send portal invite" — **CLOSED at gate-4**: the roster now shows the invite
  link ONLY on not-invited rows (verified by flipping one row and restoring it).
- Public CFP visible "Create an account" CTA on /submit (magic-link copy only).
- Agenda "+ Add room / track" link into Settings.
- **RECONCILE (DEC needed): Speakers Import CSV** — OnboardingGrid.tsx:76 says
  "Import CSV is the Contacts page's job" (DEC-662/746), but SPK-03 (w2) looks for
  it in the speakers area. Cheap resolution honoring both: toolbar LINK into
  Contacts import with the event preselected. (NOTE: gate-4 files the existing
  "Import speakers from a CSV" link as UNFRAMED — settle the DEC before either
  building or deleting it.)
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

## ABS grader additions — ALL CLOSED by probe 2 (sort DEC-737, labels DEC-723,
anonymity DEC-736, pending-submissions).

## SPK grader additions (2026-08-13, prod — 3/3 scenarios PASS, defects below)

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

- **P3 attribution by raw email**: file comments + session history show
  "sbek-organizer@example.com" instead of the display name; history entries date-only,
  no time.
- Seed/coherence notes: two accepted sessions share the title "Taming 40-Minute CI"
  (SES-001 seeded vs SES-031 grader-created) — later graders matching by title hit
  both · duplicate seeded "Confirm participation" task · Priya has two contact
  records · file-request kinds limited to Presentation/Poster/Handout (no
  headshot/image kind).

## Mobile queue (NEXT ROUND — not this round's convergence)

Phone agenda: enumerate ALL 22 chq-phone-* classes in the media override + fix
phone-block-visibility.test.ts to assert the override side; N-aware clash caption;
occupied-slot place-anyway. Phone shells: bottom fixed tab bar + inset scroll,
44px targets everywhere, phone landing/content parity (Comms landing content,
Submissions triage cards' verbose fields, Settings subscreens as routes, phone CFP
2-step wizard, phone password fixed footer + Cancel, roster screen, Home footer
media rule). All under the additive-reflow rule.

## CLOSED-VERIFIED (wave 16)

- Review progress: reviewer with evaluations on a recused/out-of-scope
  submission reports completed <= assigned (the '37 of 34 evaluations in'
  finding) — CLOSED-VERIFIED (wave 16,
  test/review-progress-counts.test.ts::"a reviewer with evaluations on a
  recused and an out-of-scope submission reports completed <= assigned,
  never a raw per-plan count", also re-asserted at
  test/gate4-residue-closure.test.ts::"completed is computed by
  intersecting evaluated ids against THIS reviewer's assigned set, never a
  raw count").
- Plan list's inline progress and the progress panel/editor header read the
  SAME progressTotals for identical rows — CLOSED-VERIFIED (wave 16,
  test/gate4-residue-closure.test.ts::"both source files import and call
  the SAME progressTotals from './progress' (no second definition)" and
  ::"progressTotals(rows) is pure/deterministic: two independent call
  sites given identical rows compute identical totals").
- Public CFP conditional visibility: a ruled field is hidden and its
  `required` cleared when the trigger answer does not match, executed in a
  real jsdom document (the 'conditional field logic not applied on the
  public form' finding) — CLOSED-VERIFIED (wave 16,
  test/gate4-residue-closure.test.ts::"hides the dependent field and
  un-requires it when the trigger answer does not match").
- Segment save under an existing name UPDATES rather than twins, and a
  name PATCH collision is a 400 — CLOSED-VERIFIED (wave 16,
  test/segments-upsert.test.ts::"a second save with the same name updates
  the existing row instead of inserting a twin" and ::"renaming onto an
  existing name in the same org is a loud 400, not a 500").
- A comment tagged against a version keeps its number after a SIBLING
  version is deleted (DEC-818) — CLOSED-VERIFIED (wave 16,
  test/file-version-identity.test.ts::"keeps v3's own version number 3,
  preserves comment version tags, and records 'Removed version 2' in the
  audit note").
- Deleting a contact that owns task_assignment rows succeeds and leaves no
  orphan rows (the 'permanent 409 inflates roster stats' finding) —
  CLOSED-VERIFIED (wave 16,
  test/gate4-residue-closure.test.ts::"DELETE /api/v1/contacts/:id 204s
  (not the old permanent 409) and task_assignment/task/contact rows are
  all gone" and ::"deleteContact called directly (repo layer) leaves zero
  task_assignment rows for the deleted contact").
- Organizer 404 card's footer links (ORGANIZER_NOT_FOUND_LINKS) each
  resolve to a route the Worker actually serves, not a bare SPA pattern —
  CLOSED-VERIFIED (wave 16, test/gate4-residue-closure.test.ts::""Overview"
  (/admin/overview) 200s as the admin shell when requested through
  rootRoutes (real GET /admin/* handler, not just matchesAdminRoute in
  isolation)" and the sibling "Submissions" case; predicate-level coverage
  also at test/not-found-links-resolve.test.ts).
- CFP checkbox coercion agrees with the canonical grammar: 'false'/'off'/
  'no'/'0' for a REQUIRED checkbox is rejected, never stored as true —
  CLOSED-VERIFIED (wave 16, test/forms-checkbox-grammar.test.ts::"each
  falsy spelling stores false and FAILS a required checkbox", also
  re-asserted at test/gate4-residue-closure.test.ts::"canonicalizeOperand
  ('checkbox', ...) maps every falsy spelling to false, never true").
