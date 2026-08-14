# MANDATE — desktop-polish oscillation (gate-3 pruned 2026-08-13, snapshot 9b78f61e; full history in docs/mandates/findings-archive-2026-08-12.md)

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

## CLOSED-VERIFIED (wave 43)

Each item below was re-verified today by opening the named file:line FIRST (not by
trusting the prior mandate text) and confirming the fix is live on `main`. Moved off
the open list.

- **Reviewer-queue "Score this" contrast** — `app/src/pages/review/review.css:451`
  (`.chq-review-queue-score-action`, no `color` declared) + guard test
  `app/src/pages/review/review-primary-contrast.test.ts` (parses real token values,
  asserts no offending rule exists).
- **Per-round anonymization enforced server-side** — `src/routes/review/reviewer.ts:264`
  (`plan.anonymized ? anonymizeForReviewer(detail) : detail`) +
  `src/domain/evaluation.ts:609` (`anonymizeForReviewer` strips speaker/speakerAnswers);
  the submission summary itself carries no speaker field
  (`src/server/repo/review/submissions.ts:410-429`).
- **Co-presenters visible to the conflict engine** — `src/server/repo/agenda.ts:239-259`
  (DEC-974: loads ALL `ACTIVE_INVITE_STATUSES` participants, not just the primary
  speaker) feeds `src/domain/schedule.ts:269` (buckets by `${day}|contactId`,
  independent of room) — a co-presenter can trigger a speaker-overlap conflict.
  (Co-presenter visibility on the agenda CARD DISPLAY is a separate, still-open claim
  — left in the Conflict engine gaps item below.)
- **Speaker deliverable writes are status/close-date locked** —
  `src/routes/files.ts:109-118` (`authzSubmissionWrite` calls `canEditSubmission`
  for the speaker role) is the guard actually used by the upload route
  (`src/routes/files.ts:125`).
- **Comms History and Recent Sends are one reader** —
  `app/src/pages/comms/HistoryTab.tsx:30` and `app/src/pages/Comms.tsx:72` both call
  `GET /events/:id/email-log?groupBy=batch`.
- **Saved-embed honours its stored format** — `src/routes/public/saved-embed.tsx:60-75`
  (DEC-850: json/xml redirect to the per-surface `.json`/`.xml` route, ics redirects to
  the fixed whole-agenda route).
- **Per-surface published counts** — `app/src/pages/settings/PublicPagesPanel.tsx:115-130`
  (DEC-816: Sessions reads `sessionCount`, Agenda/Schedule read `scheduledCount`,
  Speakers/Gallery read `speakerCount` — three distinct counts, not one shared total).
- **`/schedule` renders the search + track + format controls** —
  `src/routes/public/dispatch.tsx:185-221` parses `q`/`trackId`/`format` and passes
  `formatOptions`/`format` into `ScheduleContent`, which renders `ItinerarySearchForm`
  (`src/routes/public/agenda.tsx:375-420`) — a `PublicSearchBox` plus track and format
  `PublicFilterBar`s.
- **New-submission dialog sends format and PATCH accepts it** —
  `app/src/pages/submissions/NewSubmissionModal.tsx:87` includes `format` in
  `onCreate`; `src/routes/api/submissions.ts:231-233` (POST create writes it via
  `upsertSubmissionAnswers`) and `:295-296`/`:337-339` (PATCH parses and writes it).
- **`createTask` has no assign-to-all opt-out** — `src/server/repo/tasks/crud.ts:229-232`
  (DEC-746: always expands to every accepted-with-active-invite contact); the UI has
  no such checkbox anymore (`app/src/pages/speakers/TaskModal.render.test.tsx:35`
  asserts it's absent) — an orphaned task cannot be created.
- **Organizer add-co-presenter validates role against `PARTICIPANT_ROLE_OPTIONS`** —
  `src/routes/api/submissions.ts:445-461` (DEC-784: unknown role is a loud field
  error); the UI offers the real picker
  (`app/src/pages/submissions/SubmissionDetailPage.tsx:988`) and displays the actual
  role via `participantRoleLabel` (`:939`), not a hardcoded "speaker".

## GATE-4 FLEET (in progress, snapshot 33fbc724 vs design-frames-v7) — EARLY VERDICTS + REDS

**Verdicts so far: 04-speakers PASS (first PASS of the oscillation) · 05-content FAIL 2 MAJ ·
02-submissions FAIL 1 MAJ · 03-review FAIL 4 MAJ.** Full reports at
chautauqua-research/fidelity-gate4/. Massive convergence — gate-3's BROKEN + nearly all MAJORs
verified fixed (queue CTA contrast, plan-editor measure, distribute anatomy, focus ring,
draft guard, replace-keeps-versions exercised live v1+v2, speakers matrix typography+pills).

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

## P0 — CLOSED (probe-2 verified end-to-end 2026-08-13)

Reviewer lockout FIXED and externally verified: sbek-reviewer login → /admin/review
renders → scorecard reached through the UI → rating inputs live. Regression test
guards the closed-plan envelope shape (test/review-queue-shape.test.ts) — re-verified
live at gate-3 (closed-plan queue returns 200 with `recused` present; no lockout).
Residue (small, filed under Review): shell still fires one non-fatal 403 organizer
overview fetch right after reviewer login — make the shell skip it for reviewers.

## SBEK RUN 3 (2026-08-13, prod, gate-3 SHA): 87.4% — DOWN from 91.5%. ROOT CAUSE IS CONFIG, NOT UI.

**w43-h note: the mailer P0 below and its downstream '0 total' audit-trail finding (SPK grader additions, "P2 Comms audit trail") are being closed by tasks w43-a/b/c — do not re-file until their landing is verified.**

Areas: CFP 90.7@71c · ABS 91.7@86c · SPK 88.3@91c · CNT 72.0@81c · AIA 86.1@100c · EMB 91.4@100c · CRM 94.4@95c. 10 of 19 scenarios died at the 70-turn cap (many burned turns retrying 500s below). Full report: killmysaas-evals/runs/2026-08-13T16-55-22/.

**P0 · EVERY send path on prod returns 500 — makeMailer throws on missing RESEND_API_KEY.** DEC-996 switched prod mail to Resend; prod has no RESEND_API_KEY secret (verified: `wrangler secret list` shows only Airtable). `makeMailer` (context.ts, DEC-547) throws per-request → 500 on: public CFP submit (proposal persists, then confirmation dispatch throws — submitter sees "Internal server error"!), decision notifications, bulk email, single+bulk reminders, remind-laggards, organizer note replies ("Send note only"/"Ask for changes"). Sbek filed 5 criticals across 4 areas on this one cause. FIX SHAPE (respecting fail-loudly): mail dispatch is an external-IO boundary — catch at the send boundary, record per-recipient status "failed" with the reason ("mail provider not configured"), surface an honest banner ("N failed — mail provider not configured"), and NEVER fail the enclosing request after its own mutation persisted (CFP submit returns its confirmation regardless of email fate). Missing-config stays loud via a startup/health surface (Settings "Email" row shows NOT CONFIGURED), not via 500s on user actions. Keep DevSinkMailer behavior for dev. NOTE: actually delivering real mail needs the user to mint a Resend key + verify the chautauqua.cc domain — USER DECISION, filed separately; the code fix restores honest non-500 behavior without it.

**P0 · "Replace file" DESTROYS the previous version** (sbek critical, CNT): version history shows a single v1 after replace instead of v1+v2; comments attached to the file are silently lost. Versions are append-only; replace = new version row; comments ride the deliverable, not the blob. This also blocks the frame's "3 versions" chip and the RE-UPLOADED demo.

**P1 · Conditional field logic not applied on the public form** (CFP): "Show when Format eq Workshop" saves and displays in the builder but the public form always shows the field.

**P1 · Conflict engine gaps** (AIA): speaker double-booking flagged on one pair but MISSED on another same-slot different-room pair (SES-033/SES-003 vs SES-031); co-presenters (Participants) invisible to the agenda card display; conflict label attaches to only one of the two clashing cards.

**P1 · "Remind laggards (N)" 500** — same mailer P0; verify it heals with the boundary fix. **"Submission (removed)"** label renders for a live assignment on the who-reviews-what list.

**P2 · duplicate-contact hygiene** (SPK+CRM): manual Add-speaker doesn't match existing email → three Priya Raman rows; CSV import creates a synthetic "Imported speaker batch talk" accepted session per row (pollutes submissions/agenda); returning-speakers KPI reads 0 until a re-import; "already on this event" dialog's only affirmative silently adds a second session.

**P2 · misc from run 3:** SBEK-PORTAL-BIO-01 fixture string visible on the public speaker detail (seed hygiene); embed accent-color option appears to not re-theme the rendered embed; picks-only itinerary renders empty time-group headers; search + day-pill combine silently to "No sessions"; blank-render flash on Contacts/Speakers pages needs a loading state; CFP required-field errors rely on native tooltips only, "Key takeaway" required (check seed intent); portal task "Finalize bio + headshot" is actually a session-file upload widget (semantics mismatch).

**TURN-DIET note:** 10/19 truncations, but read them with the mailer P0 in mind — CFP-S1 spent 4 attempts on a 500ing send, CNT-S2/S3 retried 500ing reminders/replies. Fix the P0, then judge turn-diet fresh at gate 4. CNT-S3 truncated at gate-2 too and remains the structural turn-diet target (content-detail navigation tax — the gate-3 content reds are the cure).

## GATE-3 FLEET VERDICTS (all 6 pair reports landed, audited vs design-frames-v6 on snapshot 9b78f61e)

ALL 11 SECTIONS FAIL.

- 01-overview — FAIL, 4 MAJOR
- 02-submissions — FAIL, 4 MAJOR
- 03-review — FAIL, 1 BROKEN + 5 MAJOR
- 04-speakers — FAIL, 3 MAJOR
- 05-content — FAIL, 8 MAJOR
- 06-agenda — FAIL, 4 MAJOR
- 07-comms — FAIL, 4 MAJOR
- 08-contacts — FAIL, 1 BROKEN + 4 MAJOR
- 09-settings — FAIL
- 10-public-portal — FAIL + 1 BROKEN (seed)
- 11-account — FAIL, 4 MAJOR

Reports: `chautauqua-research/fidelity-gate3/{01-overview,02-submissions,04-speakers,07-comms,09-settings,11-account}/report.md`
(each covers its pair). These reports are the authority for every disposition below.

## P0 · USER DECISION (2026-08-13): REVERT PROD MAIL TO CLOUDFLARE EMAIL SERVICE — DEC-996 IS SUPERSEDED

DEC-996's premise is FALSIFIED BY EMPIRICAL EVIDENCE: the user RECEIVED real emails from the
Cloudflare `send_email`/EmailBindingMailer implementation; the gate-2 prod email_log showed honest
per-recipient results ("2 failed, 21 sent" — failures were reserved example.com recipients); the
SES-039 confirmation dispatched. Commit 9131a53a's "unusable" verdict was static analysis (it
pattern-matched the binding name to the Email Routing API and inferred prod couldn't send) with
ZERO observed runtime failure. Do not re-litigate this without new RUNTIME evidence.

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

REVERT SHAPE (as originally directed; superseded by the landed implementation above):
- Restore `src/mail/email-binding.ts` (EmailBindingMailer) from `9131a53a^` — that version already
  carries the DEC-923 single-writer email_log discipline. Restore its tests likewise.
- Re-add the `"send_email": [{"name": "EMAIL"}]` block to wrangler.jsonc and the `EMAIL` binding
  type to env.ts (structural interface, per DEC-002). Restore the Stage-2 MAIL_FROM comment.
- `makeMailer`: dev mode → DevSinkMailer (unchanged); EMAIL binding present → EmailBindingMailer;
  binding absent on a non-dev env → the existing UnconfiguredMailer honest-failure path (KEEP the
  wave-43 boundary work — guarded construction at all 8 send sites, per-recipient failed rows,
  /api/v1/mail-status — it is mailer-agnostic and correct).
- DELETE `src/mail/resend.ts` + RESEND_API_KEY from env.ts (no dual-mailer support, no shim).
- Reserved-domain recipients (example.com) failing at send is CORRECT honest behavior, not a bug.
This ships with the gate-4 deploy; deploy procedure keeps the secrets/bindings parity check.

## REVIEW PACK LANDED (2026-08-13, vendored — SUPERSEDES ALL PRIOR 03-review AUTHORITY; the reviewer surfaces finally have DESKTOP frames)

`Chautauqua Review.dc.html` redrawn (9 frames incl. 1600px reviewer queue + scorecard for the
first time — the old pack had these only at 390, which is why the build improvised phone anatomy
on desktop). Frames re-rendered into **design-frames-v7/03-review--\*** (manifest updated); zip at
chautauqua-research/design-pack-review.zip; README sections "Reviewer surfaces" + "the queue is
scoped to a plan" carry the spec. Directives:

**P1 · Reviewer queue desktop = frame 03--03** (supersedes the earlier USER-FILED phone-anatomy
item with designed authority): header = eyebrow `REVIEW · WAVE 2`, h1 "11 left to score",
subtitle "<plan name> · closes in N days", primary `Score the next one` right-aligned on the
title row; progress bar beneath with "7 of 18 done" right; rows = `REF  STATE` eyebrow line
(SCORED 4.5 / NOT SCORED bold caps / RECUSED), title, meta "Talk, 30 min · advanced", and an
INTRINSIC-WIDTH right-aligned action (~220px): olive `Score this` unscored, outlined
`Change your score` scored, outlined disabled-style `You work with this speaker` on recused rows
(the recusal reason IS the row action); footer "Showing 5 of 18  Show all 18" left + "Your
scores stay hidden from other reviewers" right. Reviewer chrome: wordmark + underlined `Review`
nav item + event name + FULL name `SAM WHITFIELD · SIGN OUT`.

**P1 · Scorecard desktop = TWO-COLUMN WORK SURFACE, frame 03--01** (structural — supersedes the
single-column 820 scorecard and the "equal spans filling the 820" segment spec): reading column
~820 left (eyebrow `WAVE 2 · AI ENGINEERING · ROUND 1`, title, `DFC-021 · talk, 30 min ·
advanced` meta, ABSTRACT, FORM ANSWERS as label|value rows) + 300 rail right holding the ENTIRE
scoring panel: per criterion = name + right-aligned "Weight 3 · 50%" on its rule, guidance line,
compact 1-5 pill row (~64px squares, selected olive-filled); `Overall  4.5` + "Averaged by
weight · not editable. A plain average of 5, 4, 4 would be 4.33."; `Comment to the committee`
textarea; `Recuse me from this one` checkbox (plain, no card); full-width olive `Submit and
next` + `Save draft` secondary. Chrome: back link `‹ Wave 2 queue`, progress "7 of 18 done" in
the header right. When the plan is anonymized the reading column states it: "The speaker's name
and company are hidden while this plan is anonymised". Phone (03--02) stacks the same content.

**P2 · plan-name scoping everywhere**: queue heading names the wave; scorecard back link reads
`‹ Wave 2 queue`; eyebrow names wave · track · round (criteriaForRound makes this load-bearing).

**SEED**: plans should carry distinct weights (mock uses 3/2/1) so weighted ≠ naive is visibly
demoable — partially landed with the earlier seed variety fix; verify.

**Supersession notes for fidelity agents:** the gate-2/3-era clauses "rating segments equal
spans across 820", "scorecard is .chq-measure 820 single column", "queue full-width action" are
ALL DEAD — judge 03-review exclusively against the new 03--00..08 frames. The scorecard shows NO
keyboard-tip line and NO focus box on any criterion at rest (aligns with the USER-FILED focus-ring
item — keep the number-key behavior, drop the visible tip line, ring on keyboard interaction only).

## DESIGN PACK v7 LANDED (2026-08-13, vendored to docs/design/ — SUPERSEDES v6 FOR SECTION 10 ONLY; both HOLDs below are LIFTED)

Only `Chautauqua Public and Portal.dc.html` + README changed (verified byte-diff; all other
sections stay on v6 authority). Frames: **chautauqua-research/design-frames-v7/** (v6 clone with
section 10 re-rendered — 20 frames, manifest updated; fidelity agents use v7 for EVERYTHING from
now on, it is a superset). Zip vendored at chautauqua-research/design-pack-v7.zip. READ THE
VENDORED README's new sections — "Public agenda — desktop" and "Public filter bar — one idiom,
four surfaces" — they carry the full spec; summary directives:

**P1 · Public agenda desktop = SEQUENCE, not matrix** (frames 10--01/02, README §Public agenda):
one row per start time — 88px time column + blocks in `repeat(auto-fit, minmax(228px, 1fr))`
inside the 820 content column of the 1180 pair (1 session = full 712, 2 split, 3 at ~228, 4 wrap
2×2); room = LABEL ON THE BLOCK (eyebrow), never a lane header; day appears ONCE as the h1
("Tuesday 12 May · 9 sessions · 4 rooms") with a Tue|Wed|Thu SEGMENTED SWITCHER right-aligned on
the heading row (one day at a time — navigation, not a filter; ?day= param); time renders only
where something starts; BREAKS are spanning quiet rules with small-caps labels ("COFFEE · FOYER ·
15 MIN", "LUNCH · FOYER · 60 MIN") — needs a breaks data model (per-event/day: label, location,
startMin, duration) + seed rows; block = ROOM eyebrow + SAVE/SAVED top-right + title (links to
detail) + speaker + track/format chips; footer "Last session ends 14:30 · Wednesday 13 May ›";
rail = YOUR SCHEDULE (saved count + Download .ics olive button) / ROOMS IN USE TODAY (per-room
session counts, each jumps to that room's first session) / PRINT ("Printable programme ›" — a
one-page all-days route). NO clash indicators on public.

**P1 · Agenda track control = HIGHLIGHT, not filter** ("a list filters; a schedule highlights",
frame 10--02): `Highlight a track ▾` beside the day-scoped search; matching blocks keep full ink
+ 3px olive left edge + track chip inverted to filled olive; every other block recedes (lighter
card/border, muted ink) but the GRID NEVER REFLOWS and Save is NEVER dimmed; rail rooms line
becomes "N in <track>"; control shows active value + Clear. Room and format are DROPPED from the
agenda bar entirely (rooms live in the rail; both remain full filters on Sessions where the eval
probes them).

**P1 · Public filter bar — one row, one idiom** (frame 10--00, README §Public filter bar): built
for the 820 column — search at the head + compact SELECTS of one visual language. Sessions:
`[Search sessions or speakers…][All days ▾][All tracks ▾][All formats ▾][All rooms ▾]`. Agenda:
`[Search this day…][Highlight a track ▾]`. Speakers: `[Search speakers…][All tracks ▾][List|Grid]`.
NO pill rows anywhere on public (the pill-row idiom is dead — that's what forced the stacked
rows). ACTIVE-FILTER LINE appears only when set: "9 of 18 sessions [Tuesday 12 May ×] Clear" —
count + one removable chip per active filter + Clear; zero height at rest.

**P2 · Sessions list row anatomy per frame 10--00:** two-line left gutter (start time / room),
title, speaker, uppercase small-caps meta "TRACK · FORMAT, N MIN", bordered Save/Saved button
right; per-day section capping with "4 more on Tuesday  Show all 9"; rail = YOUR SCHEDULE /
THREE DAYS (per-day counts, jumps down the page) / CALL FOR PAPERS (closes date · no account
needed + "Submit a talk ›").

**NAV RULING (pack-internal discrepancy):** frame 10--00's header still shows a "Gallery" nav
entry; frame 10--01's header and README "Changed since the previous handoff" §4 drop it. The
README + the standing USER DECISION win: public nav = Sessions / Speakers / Agenda / My schedule,
NO Gallery; /gallery stays as the Grid URL with Speakers nav-active. Fidelity agents: do not file
the sessions frame's nav row.

**SEED note:** frames depict 18 published sessions across 3 days with breaks and 4 saved picks;
current seed publishes 7 on 2 days. Enrich the published set (+ breaks rows) so the agenda's
multi-block rows and per-day counts are demoable.

**~~HOLD — REDESIGN PENDING~~ (LIFTED by v7 above — build both now):**
(1) Public filter-bar collapse (delta-probe item 11 / DEC-919 one-pill-row) — the v6 one-row
design predates the format/room facets; a redesigned filter bar is coming via design handoff.
(2) Public agenda desktop layout — v6 has NO desktop agenda frame (10--01 is 390 phone); the
current room-lane grid is improvised and will be replaced by a designed frame
(10--17-public-agenda-desktop expected). Until the handoff lands: no layout work on either
surface; copy/data fixes (e.g. the "No sessions scheduled yet" empty-state honesty when a day
filter constrains search) are still fair game. Fidelity agents: do not file layout findings
against these two surfaces until the new frames arrive.

**P1 · USER-FILED (2026-08-13): scorecard first criterion boxed on load.** Scorecard.tsx:118
pre-arms `focusedId` to the first rating criterion on mount, so the DEC-939 inset ring
(`.chq-review-criterion.chq-focused`, review.css:549) renders before ANY interaction — the top
scoring row sits in a stray 2px box (user screenshot). DEC-939's own rationale ("reads as one
criterion styled unlike its siblings") applies to the ring-on-load too. Fix: focus-visible
semantics — keep `focusedId` armed for number-key routing, but render the ring only after
keyboard interaction (Tab/arrows/number key), never on initial paint. Render test: fresh mount
has no `.chq-focused`; pressing a number key both scores and shows the ring.

**P1 · USER-FILED (2026-08-13): reviewer queue rows use PHONE anatomy on desktop.** Screenshot
evidence: each queue row renders ref/status line, title, meta, then a FULL-WIDTH 820px olive
"Score this" block button — reads as the phone view. Root cause: the only v6 reviewer-queue
frames (10--01/02) are 390px phone frames, so fleet passes graded the full-width action as
frame-faithful; there is NO desktop frame for this surface. Desktop anatomy therefore follows
the affordance grammar (primaries never float in their own band): "Score this" is a normal
intrinsic-width button right-aligned on the row (vertically centered against the title/meta
block), same for outlined "Change your score" on scored rows. Keep the phone full-width
treatment for the mobile round only (additive reflow). Fidelity agents: do not re-grade the
desktop queue against the 390px frames' block-button pattern.

**P1 · USER DECISION (2026-08-13, supersedes delta-probe item 14 AND v6 frame 10--00's nav row):
DROP "Gallery" from the public nav.** The user observed the List/Grid toggle jumping the nav
highlight between two top-level entries ("a view switch that presents as leaving the section").
Ruling: Speakers is ONE nav section (DEC-990 one-page-two-views); the toggle owns the List/Grid
switch; /gallery keeps resolving as the Grid URL for deep links and embeds but has no nav entry
and never renders a nav-active state of its own — when on /gallery, the nav highlights
"Speakers". Fidelity agents: frame 10--00's nav row is SUPERSEDED on this one point; do not
re-file the missing Gallery nav entry.

## DELTA PROBE w49 (2026-08-13, snapshot 2cfc855a) — DISPOSITIONS OVER THE GATE-3 REDS BELOW

28 P1 items measured: **16 FIXED · 8 PARTIAL · 4 STILL-PRESENT · 0 BROKEN.** Verified FIXED (hands off, red-block clauses below are DEAD for these): reviewer CTA contrast (6.8:1); plan editor + /plans/new on table measure with full-bleed title row; CFP builder Track field; Columns: Format + populated column; plan status pills (open filled / opens outlined / closed bare); scorecard reconciliation line; **plan-editor unsaved-draft guard ("Leave without saving?" dialog)**; public 1180 pair layout (x130/1180, 778+300); speakers List view + 6×172px gallery grid; joined List/Grid toggle on the title row; /submit OPEN with full-bleed header, TRACK|FORMAT 2-up, audience pills, single name, real textareas; import org→Company automap + named preview blocker; compose ICS note per-recipient (single flag + honest aggregate); pill/button font Figtree everywhere; mail boundary = UnconfiguredMailer with failed log rows + guarded construction at ALL 8 send sites + /api/v1/mail-status Settings read; auth 732/820 borderless flex-start; /e/bad-slug 404 designed card at real 404.

**GATE-4 BLOCKING SET (the only items holding the gate; all measured w49):**
- **(16) Public agenda track/format chips are 622px full-width strips** — `.chq-pub-track-chip`/`.chq-pub-format-chip` display:flex inside `.chq-pub-agenda-block`; must be inline pills (correct on session detail — scope the fix). USER-PRIORITY surface.
- **(11) Public search row: input still on its own row above THREE separate `nav.chq-pub-filter-bar` rows** (tracks/formats/rooms at y238/292/400) — frame: ONE pill row with the compact input at its head. Label/button correctly hidden now; the row collapse is what's left. USER-PRIORITY surface.
- **(14) Public nav lacks "Gallery"** — /gallery reachable only via the Speakers toggle; frame 10--00 nav: Sessions / Speakers / Agenda / My schedule / Gallery.
- **(7) Distribute preview STILL flat** — cap input 64px clips "No cap"; no "talks each" suffix; no "N talks · N reviews needed at N each · N reviewers" summary; flat `<li>` list not the 3-col table. (Frame 03 anatomy in the Pair-2 block below.)
- **(17) Contact drawer headshot input STILL overflows** — `.chq-file` right edge 1477 vs 1440 viewport, drawer scrolls 38px horizontally. THE last surviving gate-2 BROKEN. `max-width:100%` on `.chq-file` + drawer overflow test.
- **(22) Tracks-and-rooms grid still 488px** in the 820 settings column (two 227px cols).
- **(28-admin) /admin/* 404 still inside full admin chrome at HTTP 200** — frame is chromeless; return real 404.

**PARTIAL residuals (ship-with, not blocking):** (3) forms content 820 vs 756 inset; (19) template editor renders the v6 two-pane correctly at table measure — the "820 reading" clause below is MIS-SPECIFIED vs frame 07--02, drop it; (21) Settings read views: Resources + API tokens description-only, People counts-not-names, SAVED EMBEDS only in edit mode; (23) files view keeps a Worklist/Refresh band; (25) speaker-detail TASK STATUS cells still `.chq-flag` bare text (participation chip done).

## GATE-3 REDS — THE OPEN LIST (measured at gate-3; these supersede any older filing of the same finding)

**Full fleet reports live at chautauqua-research/fidelity-gate3/*/report.md — they carry
additional MINOR polish findings not promoted here (e.g. 02's "01 —ABSTRACT" section
counters + 34px detail gutter, 08's header-stat clause count, 11's 46-vs-48 input).
Scribes/planners: mine them when a surface's P1/P2s run dry, before inventing work.**

**ANONYMIZATION POSTMORTEM (orchestrator repro, 2026-08-13 — supersedes the run-3 "P0 anonymization" filing; read-model is CORRECT, do not touch it):** Verified live on the gate-3 snapshot AND on prod: PATCH anonymized=true → reviewer detail strips `speakers`+`speakerAnswers` per plan; SPA passes the URL's planId; same submission fully identified through a NON-anonymized plan is per-plan semantics BY DESIGN. Prod's sbek-created "Initial Review" plan shows `anonymized:false, anonymizedAt:null` — the eval agent checked the box and NEVER clicked Save (ABS-S2 turn 32→33 jumps straight to Assign-a-reviewer). The scored "critical" was an unsaved draft.

**P1 · Plan editor mixes instant-apply and draft controls — silent draft discard.** Assign-a-reviewer/Distribute fire their own APIs immediately; the anonymize checkbox (and name/dates) are draft state needing Save; navigating away silently discards the draft. A competent agent fell for it and it cost a scored critical — humans will fall for it too. Pick ONE convention for the whole editor (recommended: toggle applies immediately with the DEC-799 ratchet confirm on switch-off; otherwise everything drafted behind one sticky Save + dirty-state navigation guard) and test that a toggled-then-navigated checkbox either persisted or visibly warned.

**Pair-2 reds (02-submissions FAIL 4 MAJOR · 03-review FAIL 1 BROKEN + 5 MAJOR):**

**P1 · Plan editor + New plan are 820 (`.chq-measure`); v6 frames 03/05/06 are table class** — criteria rule spans 1376px (l=112→r=1488 at 1600). Move `/admin/review/plans/:id` and `/plans/new` to `.chq-measure-table`, give the editor title bar (`‹ Review` / name / Duplicate·Save) full-bleed chrome-bar treatment per frames. Fixes the criteria-row cramping (guidance inputs clip mid-word) in the same stroke.

**P1 · CFP builder page shrink-wraps its children.** `.chq-forms-page` is a centered flex column; `header.chq-forms-header` measures 275.5px wide (declared 820 max) so the rule + Preview/Save jam mid-page, and `.chq-forms-content` shrinks to 617px vs frame's 756. Stretch children to the measure instead of center-shrinking. (Gate-2's "builder 820-aligned header" fix REGRESSED into this.)

**P1 · CFP form missing the `Track` field** (frame 04: 8 fields incl. Track — 3 options/Single choice/REQUIRED; app: 10 fields, no Track, plus unframed Job title/Company/Speaker bio; order drift Abstract 3rd vs 2nd). Ties to the user's single-track-radios decision — public form should offer track as single-choice.

**P1 · Needs-triage preset renders "Columns: 0" and drops the FORMAT column** — the gate-2 empty-`columns:[]` root cause now surfaces as user-visible broken copy. Frame: `Columns: Format` + populated FORMAT column.

**P2 · Submission detail FORM ANSWERS omits "Accessibility needs"** (frame renders it with value "None"; the app's own CFP form defines the field — render omission).

**P2 · Plan status pills bare text** — frame 00: OPEN NOW = olive-filled pill, OPENS N = outlined pill, CLOSED = bare text; app renders all as bare text.

**P2 · Scorecard OVERALL missing the reconciliation line** — frame 01: "A plain average of 5, 4, 4 would be 4.33" between "Averaged by weight · not editable" and the value. This line IS the answer to the weighted-vs-plain confusion; do NOT touch the math (DEC: weighted blend is correct).

**P2 · Distribute preview + who-reviews-what anatomy** — frame 03: cap row `CAP PER REVIEWER [8] talks each` + summary "18 talks · 36 reviews needed at 2 each · 4 reviewers"; preview is a 3-col table (name | track | `6 → 8 talks`, `unchanged · wrong track`) + "Assign these N" + leftover line. App: one flat line, cap input shows clipped "No", no summary, no leftover line.

**Pair-5 reds (09-settings FAIL · 10-public-portal FAIL — USER-PRIORITY SECTION):**

**P1-BROKEN-SEED · Public CFP form dark on the delivered seed.** Seed sets form `opens` = 2026-08-14 (tomorrow) so /submit/devflow-conf-2027 says "Submissions aren't open yet" while Settings says "Closes 31 Aug · IN 19 DAYS" with a live Open link and Public-pages says "NOT OPEN YET" — three surfaces disagree and the demo's primary public state (frame 10--11 = the OPEN form) is unreachable. Fix seed: opens in the past, closes in the future. Also reconcile the relative-date math (Settings "IN 19 DAYS" vs overview "17 days" for the same deadline; actual 18).

**P1 · Public 1180 pair layout applied NOWHERE.** Every public surface is x=34 w=1372 full-bleed-ish. Spec/frames: 1180 centered (x=130 at 1440), main ≈820 + 36 gap + rail 324. Applies to /sessions, /agenda, /schedule, /speakers, /gallery, session detail. One container-class fix + per-page adoption.

**P1 · Public search row (the user-filed misalignment).** App: stacked `Search` label + 951×44 input + separate green Search button on their own row, on EVERY public page. Frame: one ~259×40 inline input at the HEAD of the pill row, no label, no button. Single track-pill row (wrapping), not three ruled rows (tracks/formats/rooms).

**P1 · Speakers List/Grid wrong-way-round batch:** /speakers renders the GRID (3×444px tiles, 444px headshots) but frame 10--08 is a LIST (~80px rounded headshot, name+role/company left, session title right column, hairline rules); /gallery must be a 6-col ~184px square-tile grid (app: 13 cols of 96px, names wrapping 2-4 lines); the List/Grid toggle has NO visual selected state (both pills transparent; frame = joined segmented control, active half filled near-black) and belongs right-flushed on the title row next to search; public nav missing "Gallery" and "My schedule" entries (frame 10--00: Sessions / Speakers / Agenda / My schedule / Gallery).

**P1 · CFP form desktop anatomy:** full-bleed page header (date·venue eyebrow / event wordmark / "Call for papers · closes…") + separate H1 "Submit a talk" — not a bordered card in the column; field order/pairing per frame (Title → Abstract → TRACK|FORMAT 2-up → Audience-level PILLS not caret-less select → Notes → Accessibility → YOU: NAME|EMAIL → COMPANY|JOB TITLE → Bio); single NAME field not First/Last; textareas real heights (abstract ~5 rows, app 53px one-liners); email input type=email; YOU section needs a real section break (currently collides with last track row); track radios carry required marker + error copy for single-choice ("Select a track", not "at least one"); limits per frame (1,200 chars pattern).

**P2 · agenda public chips full-width** — `.chq-pub-track-chip`/`format-chip` compute w=622 inside agenda blocks (correct as pills on session detail) — scope fix.

**P2 · sessions list polish:** gutter 268px two-line "9:00 / Main Stage" (app: 126px, 3 lines with full date); unslotted rows (empty gutter) must not sort ABOVE timed rows; rail adds CALL FOR PAPERS block ("Closes … · no account needed" + "Submit a talk ›"); rail day block titled "THREE DAYS" with all 3 days (app: "DAYS", 2 rows); speaker line bare name; "TALK, 30 MIN" comma grammar; drop extra "7 of 7 sessions" row + duplicate H1.

**P2 · settings batch:** 3-col definition rows single-line label|value|right-meta at ~50px pitch (app stacks at 88px); read views SHOW the lists (resources, people, exports, tokens, SAVED EMBEDS + inline editor — all currently gated behind Change); public-pages read rows = 4-col `Sessions | /path | LIVE | Embed code`; section actions right-flushed ON the eyebrow row ×7; tracks-and-rooms grid spans the 820 (app 488px, rules stop short); embed FIELDS SHOWN = one row of 6 pills (app: six 790×51 stacked checkbox rows); embeds middle column = where-pasted; Dates one row "12–14 May 2027" + right-flushed relative pill; rail order/labels per frame (Public pages · Speaker portal · Your data · People and roles); H1 aligned to rail edge; login "Submit a talk ›" footer link when CFP open; confirmation measure consistent with form (620 vs 662 inset drift).

**P2 · caret focus ring (user complaint confirmed):** `.chq-eventswitcher-menu-btn` is a 24×23 button holding only "▾" — the 2px olive focus box around a bare glyph reads as stray. Give the switcher a larger focus target (ring around name+caret group), not a box around the caret.

**SEED · missing frame states:** only 2 saved embeds vs frame's 4 (missing "Homepage agenda strip", "Sponsor deck feed") — feeds the saved-embeds build; track counts/capacities fine.

(Pair-5 verified fixed: settings 3-col page-centered grid EXACT (242/820/242, rail sticky justify-end — DEC-989 wave landed), scroll-spy holds, DEC-966 optional fields verified BY SUBMISSION (only required fields → SES-031 accepted; cleaned up), track radios single-choice horizontal rows, ABSTRACT label, accessibility question present, confirmation edit-until + submit-another + browse links, CFP-closed dead-end has escape links, .ics disabled at 0, speaker-edit pills exact, bulk submission delete E2E works — note its blast-radius page primary opens a SECOND confirm modal, discoverability trap.)

**Pair-4 reds (07-comms FAIL 4 MAJOR · 08-contacts FAIL 1 BROKEN + 4 MAJOR):**

**P1-BROKEN · Headshot file input overflows drawer AND viewport (gate-2 BROKEN survivor).** `.chq-file` hard-coded `width: 284px` inside the drawer's 220px value column: right edge 1477 vs 1440 viewport; drawer scrollWidth 456 / clientWidth 418 (38px internal overflow). Make it fit the value column (max-width: 100%); overflow test on `.chq-contacts-drawer`.

**P1 · Preview ICS note contradicts per-recipient status (the ICS-contradiction P1's last leg).** Two readers again: PreviewPane chip keys off `item.scheduled` (correct), note keys off `attachIcs && !item.ics` — so "No slot yet — this recipient gets no calendar invite." prints for ALL 11 recipients including scheduled ones. Single reader rule (same class as DEC-923); the note renders only when that recipient truly has no slot. Frame shows no such note at all.

**P1 · Template editor on the wrong measure** — `chq-measure-table` (1372 rendered) but v6 templates content is reading class, 757px of 1600 centered → use the 820 reading measure. Same wave: the 187×166 BODY textarea (byte-identical to gate-2) in a 671px column — width: 100% of the field column, sane min-height.

**P1 · Import mapping drops Company silently + opaque disabled Preview.** `org` auto-maps to (ignore) — frame maps `org → Company`; both preview rows show Company "—" with no warning. And "Preview N rows" stays disabled solely because "Session title for this batch" is empty — no required marker, no inline error naming the blocker. Add the auto-map synonym + required marker/inline reason.

**P2 · Recent Sends row = frame's 5 columns** `[time][subject][N sent][Template][Open]` (app lacks Template + per-row Open; two count columns; timestamps "Tue 11 Aug, 4:12pm" grammar); header subtitle real figures ("4 sent in 7 days · last Tue 4:12pm" pattern).

**P2 · comms polish batch:** templates rows show purpose copy not subject; editor eyebrow = template name + Duplicate link, drop NAME input, preselect on entry; footer `Save` + `Use in a send`; insert-field helper line ("Six available · dropped in at the cursor" pattern with correct count); token name `{task_due_date}` per frame (alias `{due_date}`); seeded Acceptance body uses tokens not hardcoded "April 1, 2027", include `{portal_link}`; `{feedback}` error banner clears when plan selected; template row actions don't wrap (Delete orphans to line 2); drop extra Compose pill + extra SCHEDULED chip in preview TO row; Attachments card title "Attachments and merge fields".

**P2 · contacts batch:** import step-2 = dedicated "Match the columns" screen anatomy (640px, filename · row count, sample value under each header, dashed "Skip this column", step-2 dedupe footer "N rows match existing contacts by email"); rail duplicate entries get reason line + `Keep both`; merge screen all 6 identity rows incl. Notes (row missing entirely) + frame composition sentence + "The discarded record is deleted."; pipeline cards drop MOVE-TO selects, staleness plain at card foot, fit chip pale outlined; pipeline header `Pipeline` h1 + `‹ Contacts` + "N people · drag between columns"; add-to-event = two event CARDS + roles Speaker/Reviewer/Guest + white-fill/dark-border selected state; drawer 520 wide, 5 populated rows not 15 with 9 "—", footer buttons one line; dedupe message renders matched contact's NAME (currently empty slot); labels plain small-caps not chips; bulk-email subtitle names recipients, terminal `Send N emails`, label MESSAGE.

**SEED · pipeline variety** — 3 people all "STALE · 119 DAYS AGO" (no signal); frame has 20 across stages with varied fit/rationale/staleness; Contacted/Declined columns empty.

**TOOLING NOTE for probes/fleet:** `main.chq-main` scrolls internally — Playwright fullPage silently truncates; force `overflow: visible` on it before full-page captures.

(Pair-4 verified fixed: {feedback} circular gate CLOSED (itemized banner + in-place plan selector + 200 preview), send-confirm modal, step sublabels + ✓ discs, recipient refs + DEC-912, new-contact modal, import × Close, dup-tab wrap, DEC-950 drawer, DEC-979 delete cascade round-trip 204, DEC-868 rules row functional, pipeline drag-drop, "1 event" plural.)

**Pair-6 reds (11-account FAIL 4 MAJOR):**

**P1 · Auth reading columns far too narrow.** v6 geometry (measured off frames): login form column = 732px (the 820 column inset 44px); /account/password and 404 surfaces = the full 820 reading column. App: login content 550px (card 640, padding 44), password/404 448px (card 520, padding 35, `.chq-auth-fields max-width:450`). Consequence: the 404 body line wraps to 2 lines where v6 shows one 513px line. Retarget the auth measure to v6 (732 login / 820 elsewhere) — the gate-2 numbers (450/520/640) are OBSOLETE-VS-V6.

**P1 · Auth cards stretch to viewport height** — `body{display:flex}` + default `align-items:stretch` in `auth.css.ts` makes every SSR card exactly 820px tall (227–521px dead space). `align-items: flex-start` (or safe-center) + card hugs content. Related: v6 shows NO card border on any 11-account frame — the `.chq-auth-card` 1px border + radius is unframed chrome; dropping it also hides the dead-space rectangle class.

**P1 · `/e/<bad-slug>` third 404 shell still live** — borrows AUTH_CSS but diverges: eyebrow "NOT FOUND" (designed card uses event name), body "Event not found." vs designed line, one link vs two, title "Not found" vs "Not found - Chautauqua", and the bare `<main>` shrink-wraps the card to 293.9px. Route it through the ONE designed not-found card (src/server/not-found.tsx). Same wave: `/admin/*` 404 renders inside the admin shell in a left-aligned 520 card at HTTP 200 — frame 02 is chromeless, block flush-left in the 820 centered column, and should 404.

**P2 · auth polish batch:** ‹ Back and h1 flush at same x (kill the 36px `margin-left` on `.chq-auth-titlerow .chq-auth-title`); UA `form` margin-bottom:16px un-reset (footer rule 42px below button vs 26.5); footer links min-height:44 drops ink 15.5px low; admin-404 eyebrow uses `.chq-section-label` (ink) instead of the muted `.chq-auth-label` treatment, h1 `--chq-ink-2` should be `--chq-ink`, links body-15/400 should be link-vocab 14/700; demo prefill buttons `all:unset` kills the theme `:focus-visible` outline (only controls in auth without a focus ring) and are 13px ink underlined-at-rest vs 14/700 olive no-underline; failed sign-in discards the typed email (re-render keeps `email` value); `/account/password` ‹ Back hardcodes `/admin` (role-blind — speakers bounce via redirect); organizer session at `/portal/nope` 200s with admin Overview instead of 404.

(Pair-6 verified fixed/held: login geometry frame-exact incl. 81px input pitch, 28px titles, NEW PASSWORD AGAIN, underline-on-hover inversion, CSRF 400, role routing incl. /admin/overview landing + aria-current, speaker profile round-trip. NOT defects: single footer link (CFP closed on seed), no password-reset flow (unframed; /claim/:token is the recovery path).)

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

## Cross-cutting sweeps (each closes a class)

A. **customFields/Labels UI surface** — remaining: Labels row in the MERGE view renders
   raw lowercase custom-field keys; apply the server-side formatting there.
   **(unverified at gate-3** — the 08 report dispositions the merge screen's rows and
   composition but never the Labels key formatting.)
B. **Verify-then-close list** (commits claim these landed — external probe confirms,
   then delete the line): data-loss trio REMAINDER (headshot-upload-discards-bio,
   CSV bio overwrite) **(unverified at gate-3)** · comment version TAGS renumber after
   a version delete (store-vs-display drift, no content loss) **(unverified at
   gate-3)**.
   CLOSED by probe 2026-08-13 (snapshot e254eca), retained as the closure ledger:
   Contacts DirectoryRail DEC-710/711 · stale nav badges · form-builder row anatomy
   DEC-715 · Review landing grammar DEC-706/707/708 (residue moved to Review) ·
   assign-by-track preview/confirm · Comms Body-width + URL-state tabs DEC-710 ·
   History count · content file-version delete DEC-713 · comment-loss across versions ·
   content file-input styling.

## Per-surface open items (desktop) — residue AFTER the gate-3 reds above

**Overview — gate-3: FAIL, 4 MAJOR** (report fidelity-gate3/01-overview/report.md;
the 4 MAJORs are in the Pair-1 red block. `--chq-sunk`, the 820 measure, modal
side-by-side dates/46px actions/no-asterisks, the single public-pages row, the
overflow-below convention and §04 distinct suggestion times are all FIXED and
re-verified holding):
- **stat-band nearest-cell bold ties arbitrarily** — v6 does bold the nearest cell, so
  the rule is right, but with two cells reading "Today" `--chq-type-deadline-value-weight-nearest: 700`
  lands on cell 3 (REVIEW WAVE 1) while cell 2 (TASKS DUE) stays 400.
- **"J. ALVAREZ" header grammar** — frame is "JORDAN A." (and no "· SIGN OUT" in header).
- **§04 two-line date anatomy** — app "Wed 12 May, 09:00"; frame grammar "Tue 12, 10:00"
  (drop month, unpadded hour).
- **" in \<room\>" suffix** — "Place at 9:00 in Room 2A"; frame is "Place at 11:30".
- **modal residue** — title 21.5px (app 20px, ink 186 vs frame 200 @2x); placeholder
  colour is the UA default `rgb(117,117,117)`, not a brand token.
- **metrics/spacing batch** — 35px section buttons + 129.3 "New submission" width
  landed; still off: top toolbar buttons 42.8px vs frame 37.0 (vertical padding only),
  "No action needed" row pitch 58.4 vs frame 51.

**Submissions — gate-3: FAIL, 4 MAJOR** (report fidelity-gate3/02-submissions/report.md;
list 1372 + detail 1180 both CONFORM; accept-primary pair+caption, ref line + Next ›,
builder drag handles + locked styling, save-view modal share round-trip, Notes-for-reviewers
in FORM ANSWERS all FIXED):
- **review rows still one line heavier than frame** (frame: `Sam Whitfield 4.0 18 Mar`
  + comment) and detail scores render 2dp (`5.00`, `1.67`) where every other review
  surface is 1dp.
- **"1,200 characters"** — app "Up to 20000 characters" (no thousands separator).
- **strip protocol on the public link** — app `http://localhost:8882/submit/…`; frame
  `chautauqua.cc/submit/devflow-conf-2027`.
- **unframed SETTINGS + TRACKS OFFERED block below the builder fields** (Title/Intro/
  Not yet open/Opens/Closes/Open the call now/Close the call now) — frame 04 ends at
  the "Public link" row, and this block duplicates the OPENS/CLOSES strip at the top.
  SETTINGS DEC.
- **modal extra TRACKS fieldset + `FORMAT · OPTIONAL` select** not in frame 06, and
  drop the unframed "· OPTIONAL" label suffixes (the placeholder already carries it).
- **global count under the filter** — subtitle recomputes to the filtered set
  ("14 total · 14 awaiting triage"); frame shows the invariant global.
- **TRACK/SENT labels** — `th` reads TRACKS / SUBMITTED.
- **filter controls at chip height** — native selects/search at 44.0 tall, radius 4px;
  frame's `All tracks ▾` is a pill matched to the 26px status chips.
- **× on view tabs** — `.chq-submissions-viewtabs-delete` follows the saved view; frame
  00 has none.
- **Add-a-question back to green link** (regressed to a bordered button).
- **builder locked rows: grey only `Delete`, not the field names.**
- **bulk-bar "Delete…" DEC** — not in frame 00.
- **speaker rail history line** — frame adds "2 submissions this year · spoke in 2026".
- **‹ glyph** — ref row mixes `← All submissions` with `‹ Previous` / `Next ›`.

**Review — gate-3: FAIL, 1 BROKEN + 5 MAJOR** (same report; scorecard measure, olive
equal-span segments, recusal below the comment, OVERALL block, RANK-led 1dp results,
queue anatomy, compact hub, PII clamp, criterion focus band all FIXED):
- **aria-pressed on scored segments** — all 10 rating buttons return `aria-pressed === null`.
- **scorecard "N of N done" counter** — the queue now has the scoped progress bar +
  "7 of 10 done"; the scorecard header still has none (frame 01 shows it top-right).
- **criteria drag handles ×3 editors** — zero `[draggable]`/handles on locked, unlocked
  and new-plan editors; frames 03/06 show `⠿` on every criterion row.
- **US dates** — plan editor native `input[type=date]` (07/14/2026); frame is text
  "24 Mar 2027"; detail rail "ACCEPTED · WED, APR 15, 2026".
- **hyphen→middot sweep** — "Locked - 37 reviews…", "3 of about 7 - more than that…",
  "5 - 71%", "Track - AI Engineering".
- **orphan CSV + duplicated results headings + pagination** — `/plans/:id/results`
  places a bordered `Download CSV` alone between two rules above RANKED RESULTS; the
  landing repeats it; `.chq-pager` present.
- **"COMMENT TO THE COMMITTEE"** — app label is `COMMENT`.
- **recusal inline checkbox** — app renders a 125px bordered card with a checkbox AND a
  full-width "Declare conflict of interest" button; frame 01 is a bare checkbox + label
  "Recuse me — conflict of interest".
- **extras audit** — unframed on the plan editor: `Reset password` per reviewer row,
  `Anonymize speaker identity for reviewers`, `Delete plan`, the `rating`/`dropdown`
  kind column, and the scorecard's "Tip: number keys 1-9…" hint.
- **landing remind + track subtitles** — frame 00 has `Remind the 4 not started`
  right-aligned in REVIEWER PROGRESS; rows need the track as a subtitle.
- **footer "· Sign out"** — reviewer footer is only "Scores stay hidden from other
  reviewers"; frame 02 puts Sign out in the footer with the full name in the header.
- **queue meta audience level** — rows read "Talk (30 min)"; frame "Talk, 30 min · advanced".
- **REOPENED at gate-3 (the gate-2 closure list was wrong on these two):** locked-plan
  editor inverts the frame — no right-aligned `LOCKED — N REVIEWS SCORED AGAINST THESE
  CRITERIA` eyebrow on the SCORING CRITERIA rule, and the frame's second body sentence
  ("Wording, weights and the scale are fixed for the rest of this wave…") is absent;
  criteria headers are `GUIDANCE` not `GUIDANCE FOR REVIEWERS · OPTIONAL`; locked rows
  print "rating 2" instead of "Weight 3 · 50%".
- **SEED (top leverage): maxEvaluations still NULL on plans 0002-0004** (landing loses
  "· N reviews each", editor REVIEWS PER TALK renders empty) · **spread evaluation
  scores** (results still tie 4.7/4.7, 4.3/4.3, 4.0×3 — rank-order arbitrary) ·
  **second reviewer on plan 0003** (both `plan_reviewer` rows are the same user, so
  frame 03's four-reviewer distribute table is unreproducible) · a recusal for the
  reviewer **(unverified at gate-3)** · RESTORE seed_saved_view_0001 **(unverified at
  gate-3 — the report only confirms `saved_view` count 1 stable)**.

**Speakers — gate-3: FAIL, 3 MAJOR** (report fidelity-gate3/04-speakers/report.md;
matrix 1372 @ table class CONFORMS; participation-pill 4-state regression FIXED with a
guard test, add-speaker E2E, menu focus/arrows/outside-click, has-account plain text,
`menuitemradio`, accent invite, DEC-920 filename links all FIXED):
- **reopen caption** — "Reopening does not email the speaker." renders ABOVE the button;
  frame puts "Sets it back to pending — the next reminder picks it up" BELOW.
- **KIND selected = outlined chip** — selected `Upload` is `chq-btn-primary` olive/white;
  frame is cream fill + dark outline + ink text.
- **menu panel header line + tinted current row + NOW treatment** — identity is the bare
  name (frame: "Northwind Data · no portal account"); `.is-current` renders no tint band;
  NOW is an inline filled green chip inside the label span, not right-aligned text.
- **SEED SFO date fields** — response modal renders `Check-in date: SFO` /
  `Check-out date: SFO`; frame shows "11 May 2027" / "13 May 2027".
- **DELETE ROUND-TRIP — narrowed, not closed.** Gate-3 verified the FRESH path only
  (add speaker → session delete 200 `refused:[]` → contact DELETE 204 → roster stats
  restored). NOT re-tested: deleting a SEEDED contact that already carries orphaned
  `task_assignment` rows (the DEC-921 ownership case that 409s and permanently inflates
  roster stats; DEC-886 prose contradicts implementation).

**Content — gate-3: FAIL, 8 MAJOR.** All eight MAJORs plus every surviving gate-2 item
on this surface are carried by the Pair-3 red block (`.chq-pill` Arial, the 05-content
structural batch a–h, and the content polish batch). Nothing else remains open here.
`changes_requested → pending` is OBSOLETE-VS-V6 (no v6 frame depicts such a control).

**Agenda (desktop) — gate-3: FAIL, 4 MAJOR** (report fidelity-gate3/01-overview/report.md;
armed ink lattice, "N MIN FREE" slot-gap clamp, tray eviction, ring contrast, N-way
merge, armed-bar pinning and the gutter "am" strip are all FIXED):
- **head→tabs gap 78 vs frame 33** — the delta is the permanently reserved 38px
  `.chq-agenda-armed-bar`, which is exactly what buys the zero layout shift on arming.
  DEC: keep the reservation and accept the gap, or reserve it without spending height.
- **click/keyboard unschedule absent** — clicking a placed card arms a MOVE only; no
  unschedule path outside dragging.
- **no-room toast copy** — **(unverified at gate-3: not reproducible; no room-less
  column exists in this seed.)**
- **unframed ⋮⋮ drag handles** still on the tray cards.

**Contacts — gate-3: FAIL, 1 BROKEN + 4 MAJOR** (report fidelity-gate3/07-comms/report.md;
new-contact modal, import × Close, duplicates-tab wrapping, DEC-950 drawer, DEC-979
delete cascade, pipeline drag-and-drop, "1 event" plural all FIXED; drawer
add-to-pipeline entry is OBSOLETE-VS-V6):
- **DEC-868 rules-row chrome residue** — sentence-case "Matching all of" vs the frame's
  letterspaced eyebrow `MATCHING ALL OF`; dashed-outline `Add a rule` button vs the
  frame's green text link; the frame's right-hand "2 of 318 match" and "Save as a
  segment" are absent from the rule row (count lives in pagination, save in the rail).
- **ACROSS YOUR EVENTS table grammar** — left column mixes event names and a timestamp
  ("DevFlow Conf 2027" / "15 Apr, 22:48" / "DevFlow Conf 2027"); frame's left column is
  uniformly the event.

**USER (drawer action row): "Delete this contact" shows the BROWSER-DEFAULT
blue-gray focus ring** — `.chq-btn-tertiary` has no focus-visible treatment, so the UA
outline shows (off-palette). Give tertiary buttons the design-system focus ring (olive,
like inputs/status cells); sweep other tertiary/link-button classes for the same gap.
**(unverified at gate-3** — the 09/11 reports confirm the 2px olive `:focus-visible`
holds on rails, pills and auth controls, and the 11 report finds one `all:unset`
exception on the demo buttons, but no report dispositions `.chq-btn-tertiary` in the
contacts drawer.)

**Comms — gate-3: FAIL, 4 MAJOR.** All four MAJORs are in the Pair-4 red block
(template-editor measure + BODY textarea, preview ICS note, Recent Sends columns, comms
polish batch). Closed this gate: the `{feedback}` circular gate, the merged
reviewer-feedback block on the natural path, the send-confirm dialog, step sublabels,
recipient refs/DEC-912, nav overflow, stale Recent Sends, history overlap, send-status
honesty. History de-noise/identifying-column work is OBSOLETE-VS-V6 (v6 ships no
desktop history frame).

**Settings — gate-3: FAIL** (report fidelity-gate3/09-settings/report.md; the 3-col
page-centered 242/820/242 grid with `justify-self:end` sticky rail is EXACT, scroll-spy
HOLDS, EDITING eyebrow HOLDS, tracks/rooms editor HOLDS, DEC-910 count + recipe caption
+ near-black portal pills HOLD; the structural trio, tracks-rooms grid width, FIELDS
SHOWN pills, read-view lists, public-pages 4-col rows, rail order, Dates row, H1
alignment and the middle-column fix are all in the Pair-5 settings batch):
- **embed-row wrap at 1440 — THIRD GATE.** In the 820 column the AI-track row's
  descriptor "Sessions · iframe · AI Engineering · 6 fields" wraps to two lines and the
  action cluster (ON · Edit · Get code · Turn off · Delete) runs flush to the column's
  right boundary. Pin the row grid; add a width test.
- **embed editor is missing `Preview`** — frame has Save changes · Copy snippet ·
  Preview; the app has no Preview button (Copy no longer overlaps — that half is fixed).
- **caption placement** — app puts "Turning one off breaks it wherever it is pasted"
  under "Build an embed"; frame right-flushes it on the SAVED EMBEDS eyebrow and puts
  "A saved embed keeps its own URL · editing it updates every page that uses it" next
  to "New embed".
- **label-drift pairs** — frame "Custom questions — 4 — format, audience level…"
  (lowercase) vs app title-case; frame eyebrow "EVENT" vs app "EVENT SETTINGS"; frame
  "Public pages" vs app "Public pages and embeds".
- **CFP orphan row + unbalanced open/close** — the CFP editor still shows "Open the call
  now" AND "Close the call now" side by side; show one.
- **submission-delete: add the detail-page action.** The bulk-bar path is CONFIRMED
  WORKING end-to-end; discoverability is the open half (and the blast-radius page's
  double-confirm trap is filed in the Pair-5 block).
- **Edit-the-form should link the question builder (unverified at gate-3)** ·
  **portal Change edits welcome/pills/tasks (unverified at gate-3)** · **styled resource
  picker (unverified at gate-3)** · **markdown rendered view (unverified at gate-3)**.
- **SEED: display names · per-track scopes · a NOT PUBLISHED page (unverified at
  gate-3).** (The accessibility-needs question is FIXED — present on the public form and
  in the app's own CFP field set.)

**Account — gate-3: FAIL, 4 MAJOR.** All four MAJORs plus every surviving polish item
are in the Pair-6 red block. Closed this gate: 28px titles, underline-on-hover
inversion, NEW PASSWORD AGAIN + `you@example.com`, `<main>`+`<h1>` semantics, designed-404
body 15px/24.45. OBSOLETE-VS-V6: the "520 content-hugging card" premise for frame 02 and
the gate-2 metric targets (padding 35 / column 450 / inputs 48 / card 640) — v6's
container is 732 (login) / 820 (everything else).

**Home — GATE-2: strict FAIL, no regression** (report fidelity-gate2/11-account/report.md):
drop the extra stacked Speakers action (one centred action/row) · shell body →
--chq-paper · API docs 12px · main/footer landmarks · published-row meta qualifier ·
section head 4pt · (CORRECTION: bare session counts are frame-legal; gate-1 premise too
strict). **(unverified at gate-3 — no gate-3 report covers the marketing home.)**

**Public/Portal — gate-3: FAIL + 1 BROKEN (seed) — USER-PRIORITY. DECIDED (user,
2026-08-13): public submit form goes SINGLE-SELECT track radios per the frames; keep the
many-to-many model underneath; reseed the two 2-track sessions single; format = radio
cards, audience = 3-pill segment per frame.** (report fidelity-gate3/09-settings/report.md;
track radios single-choice, format radios, ABSTRACT label, accessibility question,
CFP-closed escape links, .ics disabled at 0, hatched fallback, DEC-966 optional fields
all FIXED — the 1180 pair layout, search row, List/Grid batch, CFP form anatomy, agenda
chips and sessions-list polish are all in the Pair-5 red block; the "speaker tiles
landscape ~262×152" target is OBSOLETE-VS-V6, superseded by frames 10--08/09):
- **confirmation residue** — no spam-folder line; the "meta card" is only the title
  (frame carries track/format meta).
- **portal-home ISO date (one-line formatter) (unverified at gate-3)** · **overlap
  indicator — the seed's real double-booking is unflagged (unverified at gate-3)** ·
  **date restated ×3 per row (unverified at gate-3)** · **portal header on the body grid
  (unverified at gate-3)** · **task vocab → TO DO/DONE everywhere (unverified at
  gate-3)**. All five: every v6 portal frame (10--02…10--07, 10--10) is 390px, `/portal`
  redirects an organizer to /admin/overview, and no speaker credentials were supplied —
  the fleet could not re-audit them on desktop.
- **.ics footer CTA (unverified at gate-3.)**

**Grader P3s (unverified at gate-3 — no report dispositions these):** label New-event
Timezone · explicit CFP publish affordance · close-before-open validation loud at the
field.

## DESIGN PACK v5 — COLLAPSED to a pointer

v5 is vendored to docs/design/ and is SUPERSEDED by v6 (below); read the v6 README for
code-level specs. The eight v5 design-backed additions are BUILT — participation-status
menu, send-portal-invite transition, DEC-868 filter rules, pipeline fit score +
rationale, assignment tooling (cap + shortfall + "Nothing is saved until you confirm" +
the DEC-840 "Distribute the unassigned" rename), scoped reviewer queue, password-CTA
semantics — with the residue folded into the sections above. What is NOT covered
elsewhere:

- Saved embeds: the SavedEmbedsPanel quick-save form still hardcodes iframe/{} instead
  of carrying the recipe (two save paths, different fidelity) · "N on · M off" header
  count · footer caption. **(unverified at gate-3.)** (ON/OFF pills, Turn on/Turn off
  and the Delete control are now live in the embed row cluster.)
- Speakers footer caption "Only 'Invited' sends anything…" **(unverified at gate-3.)**
- Scorecard eyebrow should name plan · track · round — app renders "PROGRAM COMMITTEE
  REVIEW · ALL TRACKS" with no round; frame 01 is "WAVE 2 · AI ENGINEERING · ROUND 1".
- Password-CTA chrome vs frames 14/15: echo the submitted address · separate "Already
  have a password? Log in ›" block · primary button "Log in to track it".
  **(unverified at gate-3;** the eyebrow "SUBMITTED · ‹ref›" and "That's in. Check your
  email." are confirmed present.)

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

**Other v6 content authority still open:** **Merge rebuilt** — column heads name BOTH
records ("Keeping · Marcus Okafor · added 14 Mar" / "Discarding · Marcus O. · added
2 Aug"), combine rules in a block above the actions, primary names its target, "Swap
which is kept" beside it. (The v6 "Merge fields = one `Insert a field ▾` dropdown"
change is BUILT — the dropdown is live on compose step 2 and the template editor, all 7
tokens resolving. The v6 Speakers List/Grid + dropped gallery nav item is now carried by
the Pair-5 red block; DEC-990's one-page-two-views holds with /e/:slug/gallery
resolving 200.)

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
- Weighted-score label CLOSED (probe-4); residue: caption under it still says
  "Mean of submitted reviews · recusals excluded" — update to describe the
  weighted blend.
- CRM KPIs CLOSED (probe-5: "0 returning · 1 events" rendered). Pluralization nit
  FIXED at gate-3 ("1 event" per 08 report).
- Per-speaker "Send portal invite" — STALE at gate-3, defect INVERTED: the roster
  now shows the invite link on EVERY no-account row (04 report); the fix is
  NOT-INVITED-rows-only, already carried in the Pair-3 speakers polish batch above.
- Public CFP visible "Create an account" CTA on /submit (magic-link copy only).
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
</content>
</invoke>
