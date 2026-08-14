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
changes a desktop pixel has failed; scan-lock) · tests: workers targeted, trains run
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
