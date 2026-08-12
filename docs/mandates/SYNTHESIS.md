# Fidelity pass synthesis — all 11 design files vs prod (2026-08-12)

Per-file details in `fidelity/*/report.md` with screenshot evidence. Prod ran OLD data
during this pass (reseed had silently failed on a pipeline_entry UNIQUE collision) —
structural verdicts stand; data-dependent observations flagged in-place.

## Tier 1 — SYSTEMIC root causes (fix once, apply everywhere)

1. **Phone fixed tab bar clips content on every page family** (Settings: every expanded
   section; Content: files pagination; Submissions: detail + form builder). Root cause:
   pages use native scroll with ~34px bottom padding under a 69px fixed bar instead of
   the README's fixed-header / `flex:1 overflow-y:auto` body / fixed-footer regions.
2. **Native controls were never styled, anywhere**: `input[type=file]` (Content deliverable
   zones ×3, Settings resources — the user's "unstyled submit button" sighting),
   `input[type=date]` (New-event modal, plan editor, CFP builder), and native `<select>`
   where the design specifies pills/segmented controls/buttons (detail decision panel,
   task Kind, add-to-event, pipeline MOVE TO, header event switcher).
3. **Header shell migration is per-page inconsistent**: Overview has the new single-row
   shell; Comms/Speakers/Contacts/Content still show the old two-band (select + raw
   email). The shell must become ONE shared component; event name plain text, user as
   "JORDAN A. · SIGN OUT".
4. **Desktop agenda: one clipping bug + one pattern port**: card boxes shorter than
   content w/ overflow visible (12/12 cards bleed, worst on conflict cards — closes
   ghosting AND title-overflow findings in one fix); port the phone's real-`<button>`
   card pattern to the desktop grid (**CRITICAL: desktop grid exposes zero interactive
   elements to the a11y tree — the sbek judge cannot place sessions**); strip
   blue/amber/green track borders (olive only); consider mock's full-width conflict panel.

## Tier 2 — surfaces NEVER redesigned (largest blocks, design order steps 6-7)

5. **Speaker portal, all routes** — "Two things to do" worklist pattern; Sign-out demoted;
   two ACTIVE layout bugs (hotel-stay + edit-session fields overlap).
6. **Public CFP form** (+confirmation) — unstyled default controls on the single most
   judge-visible surface. Also: Track is CHECKBOXES (functional bug — single-track model).
7. **Public agenda + my-schedule at 390px** — raw multi-room grid; needs the phone list.
8. **Review**: plan editor (pre-redesign form), queue-first reviewer flow (kill the plan
   picker landing), organiser landing worklist (inline progress + ranked results WITH
   Accept/Decline).
9. **Settings content** below section labels + TWO MISSING SECTIONS ("Call for papers",
   "People and roles"); phone subscreens vs accordion.
10. Smaller absences: phone roster screen (no route); Save-view modal (currently a native
    `window.prompt`); Task-response modal actions ("Mark complete"/"Ask for more" don't
    exist in code).

## Tier 3 — structural deviations on implemented pages (see per-file reports)

Submissions (phone triage actions GONE; decision select→buttons; detail missing Speaker
card + Reviews; form-builder shape) · Contacts (drawer is an edit form, not the designed
record view w/ history + action bar; import wizard collapsed into overflowing modal;
add-to-event modal; missing New contact/Export CSV) · Content (worklist 8-col→4-col IA,
inline split panel; files library size column/stat/chips) · Overview (deadline strip
fixed order; Export/New submission buttons; §04 humanized copy + "Place at" rows; Public
pages row; New-event modal) · Comms (phone landing state; batched history + drill-in;
template editor input clipping; per-recipient tags in preview) · Account (login
CTA block; password captions + phone Cancel; not-found copy/links).

## Tier 4 — bugs found in passing

CNT-D1 still broken but is a WIRING fix (feature works on submission detail) ·
"40 of 3 evaluation plans in" counter · "Unknown uploader" attribution · pipeline stray
concatenated row · template Subject/Name inputs clip text · comms phone step-bar letters
stack vertically · raw enum `ROOM_OVERLAP` in Overview §04.

## Eval-defect dispositions from this pass

FIXED: SPK-S1-D1 (New task opens), SPK-S3-D1 (recipient cap gone), preview #1 (Overview
crash), preview #4 (single-row shell — on Overview only, see Tier-1 #3).
STILL-OPEN: CNT-D1, agenda desktop a11y + ghosting + track colors (phone side fixed),
preview #5 (portal), #9 (reviewer click-path, now measured at 2-3 clicks).

## Seed/data items

Seed wipe list must be SCHEMA-DERIVED (32 tables; hand-list missed pipeline_entry etc.
and broke the remote reseed) · canonical demo "today" (homepage-mandate) · Forward
Summit 2028 presence resolved by hub grouping + reseed.
