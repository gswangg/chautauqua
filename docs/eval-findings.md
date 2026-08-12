# MANDATE — verified-current findings round (2026-08-12, ~11h to submission)

Every item below was verified against THIS build (main @ the commit vendoring this file)
in the last three hours: an 11-agent design-fidelity pass against the deployed prod
(evidence: `chautauqua-research/fidelity/*/report.md` + screenshots), and a defect
re-verification pass against a seeded local snapshot (`docs/mandates/defect-reverify.md`
— 12 previously-known defects are FIXED and are NOT listed here; do not re-fix). Detail
files live in `docs/mandates/`. The design handoff in `docs/design/` is **v2** —
re-vendored, includes the new `Chautauqua Home.dc.html` + README §Open decisions.

Work the tiers in order. Every fix needs a test that would fail without it. Gates
unchanged (`build`, `test`, `gate:render-sweep`, `walkthrough`, `perf:smoke`) — but see
"Test policy" at the bottom before running suites.

## Tier 0 — judge-blocking (P0)

1. **Agenda desktop a11y (UNCHANGED WCAG 2.1.1 failure, twice-verified)**: the grid
   exposes ZERO interactive elements — cards are `div draggable`, a 40-press Tab walk
   never reaches one. The phone view already solved this (every card/clash item is a
   real `<button>`) — port that pattern to desktop cells/cards and add per-item
   accessible placement ("Place at HH:MM" menu/buttons per the Overview §04 design).
   The sbek judge drives via the a11y tree: this single item gates every scheduling
   rubric point.
2. **Agenda desktop card clipping**: card boxes shorter than content + overflow visible;
   12/12 placed cards bleed into the next row (29–190px, worst on conflict cards). One
   CSS fix (clip/size to slot). Also strip blue/amber/green track borders (olive only)
   and prefer the mock's full-width conflict panel.
3. **Assign-by-track fan-out (ABS-S2-D1)**: assigns every submission in the track with
   no preview/confirm. Add count-preview + confirm, allow bounded selection.
4. **Files-library "versions and comments" button**: WIRING fix — button only mutates
   URL; the panel it should open already works from the submission-detail page.
5. **Comment loss across file versions (CONFIRMED server-side)** + **headshot upload
   discards unsaved bio edits (both portal and admin)** + **CSV import silently
   overwrites bio**: three confirmed data-loss paths.

## Tier 1 — systemic design fixes (fix once, apply everywhere)

6. **Phone fixed tab bar clips content on EVERY page family** (Settings sections,
   Content files pagination, Submissions detail + form builder). Adopt the README's
   fixed-header / `flex:1; min-height:0; overflow-y:auto` body / fixed-footer shell as
   ONE shared phone layout component.
7. **Style the native controls**: `input[type=file]` (deliverable zones, Resources),
   `input[type=date]`, and every native `<select>` where the design specifies
   pills/segmented/buttons (decision panel, task Kind, add-to-event, pipeline moves).
8. **One shared header shell**: Overview has the new single-row shell; Comms, Speakers,
   Contacts, Content still render the old two-band. Event name as plain text, user as
   "JORDAN A. · SIGN OUT" (derive initials from the seeded name).

## Tier 2 — surfaces never redesigned (design order steps 6–7; docs/design v2 is authoritative)

9. **Speaker portal — all routes** ("Two things to do" worklist; demote Sign out; fix
   the two ACTIVE overlap bugs on hotel-stay + edit-session forms).
10. **Public CFP form + confirmation** (most judge-visible surface; currently default
    controls). Fix Track: radios not checkboxes (single-track data model).
11. **Public agenda + my-schedule at 390px** (raw grid today; needs the phone list).
12. **Review**: queue-first reviewer flow (remove the plan-picker landing); organiser
    landing worklist w/ inline progress + ranked results incl. Accept/Decline; plan
    editor per mock.
13. **Settings**: redesign content rows; ADD the two missing sections ("Call for
    papers", "People and roles" — even a minimal honest version); phone subscreens.
14. **Home page — NEW surface**: implement `docs/mandates/homepage-mandate.md` +
    `Chautauqua Home.dc.html` (anonymous event hub, three states, redirects for
    signed-in users, org masthead, footer attribution; login-page demo-credential
    prefill links, seed-conditional).

## Tier 3 — per-page deviations (details in docs/mandates/SYNTHESIS.md + fidelity reports)

Submissions (phone triage actions; decision buttons; detail Speaker card + Reviews;
Save-view modal is currently `window.prompt`) · Contacts (drawer→designed record view;
import wizard; add-to-event modal; New contact + Export CSV CTAs) · Content (4-col
worklist IA; files size column; Task-response modal needs "Mark complete"/"Ask for
more") · Overview (fixed deadline-strip order; Export/New submission buttons; humanize
`ROOM_OVERLAP`; "Place at" rows; Public pages row; New-event modal) · Comms (phone
landing; batched history; template input clipping; per-recipient SCHEDULED/NO-SLOT tags)
· Account (login CTA block; password captions + phone Cancel; not-found copy) ·
EMB still-open items from `docs/mandates/defect-reverify.md` (Format field everywhere
incl. JSON API, day/fields params, time gutter, chromeless framing).

## Tier 4 — features (independently shippable; stop anywhere and main stays green)

15. **Sessionboard importer** (`docs/mandates/steal-mandate.md` §5): Layer 1 CSV/XLSX
    export import w/ dry-run + idempotent external_ref upsert. The one differentiator
    nobody in the field has.
16. Steal-mandate §1–3 (auto-scheduler per-item reasons; anonymization snapshot at
    assignment; hardened embed element). §4 (AUDIT.md) — update it with this round's
    reality in the same commit.
17. **Scale test** (`docs/mandates/scale-mandate.md`): aie seed profile + functional
    and design-at-scale bars.

## Seed & data

18. Seed wipe list must be SCHEMA-DERIVED (hand-list missed pipeline_entry etc. and
    silently broke the remote reseed). A source-scanning test in the DEC-518 style.
19. **Canonical demo "today"** (README §Open decisions): pick one, move seeded CFP
    close_date ~2-3 weeks after it, keep some tasks overdue behind it — so open CFP,
    populated worklists, and coherent countdowns are all true at once (Overview
    currently says "19 things need your attention" — tune to credible).
20. Fix "40 of 3 evaluation plans in", "Unknown uploader", pipeline stray concatenated
    row.

## Test policy (NEW — supersedes any earlier full-suite habit)

Workers run TARGETED tests only (`vitest related` + their area's test files). The FULL
suite runs once per merge-train batch and always on verification/exit waves. Full-suite
invocations must be serialized via the lock wrapper (first mechanical task: add
`scripts/with-test-lock.sh` — mkdir-spinlock on /tmp/chq-test.lock — and route the
train/exit `npm test` through it). `VITEST_MAX_THREADS=2` is set in the environment.
Rationale: concurrent full suites (~1GB/worker × 11) swamped the 16GB machine twice.

## Continuing thread

The DEC-5xx hardening thread (silent-death traps, invariant lock-in, boundary
validation) remains IN SCOPE and should continue as capacity allows — after the tiers
above, never instead of them. The DEC-514 rule stands: the round closes only with a
verification-only exit wave re-measuring everything at a sha containing every fix.
