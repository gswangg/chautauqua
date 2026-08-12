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

## APPENDED: real sbek harness results (run 2026-08-12T18-00-39, official kit, Opus judge)

**Context for reading the score**: Overall 66% at 80.8% coverage — BUT the run hit a
deployment fault, not a code fault: three D1 migrations (0019 join-table uniqueness,
0020 email_batch, 0021 external_ref) were missing from remote, so EVERY write touching
the new ON CONFLICT indexes 500'd (add speaker, CSV import commit, add co-presenter,
add-to-event, status→Accepted). Those scenario chains died and dragged ABS/SPK/CNT/AIA/CRM
scores down. The migrations are now applied and the write path is verified healed —
**do NOT chase "Internal server error" reports from this run; they are fixed.**
A clean re-run happens after this round.

**Real code findings from the run (add to the tiers):**
- **Reviewer comments are write-only (judge called it MAJOR)**: scorecard captures
  free-text comments but no organizer surface OR API returns them — submission detail
  has no evaluations section, Results shows numerics only. (Fidelity's Review report
  says the same: organiser landing needs inline evaluations per DEC-596/mock.)
- **Public itinerary does not persist (judge called it CRITICAL, EMB-10/11)**: checking
  "Add to itinerary" then reloading loses the selections while the page claims "Your
  picks are saved in this browser and survive a reload" — data loss + dishonest copy.
  localStorage `chq_itinerary_<slug>` per the design README; verify the SSR checkbox
  wiring actually writes/reads it.
- CNT-06: upload control states no accepted-type/size constraints (covered by Tier-1
  native-controls work — include help text per mock).
- 34 PARTIAL verdicts largely trace to the write-500 chain breakage and to items this
  mandate already covers (EMB params, Format, gallery fields); re-run will re-judge.

Per-area (for calibration only, deflated by the fault): CFP 82% · ABS 50% · SPK 57% ·
CNT 52% · AIA 88% · EMB 72% · CRM 76% (of judged weight).

## APPENDED: user manual-QA findings — prod desktop Overview (2026-08-12)

1. **Event switcher looks foreign to the design system** (refines Tier-1 #8): even
   granting that multi-event needs a switcher the mocks didn't draw, a bordered native
   `<select>` in the header reads as not belonging. Keep the switching capability
   (CFP-17 requires it) but restyle it as a design-system control — event name in the
   shell's specified type (13px/600) with a quiet affordance (chevron + styled popover
   or menu), no native select chrome. It must sit ON the single-row shell, not in a
   second band.
2. **Font weights on Overview don't quite match the design system**: audit every text
   role on the page against the README typography table (overview headline 44px/700/
   -0.042em; section labels 11px/700/0.12em uppercase; row titles 600 with tight
   tracking; metadata 400–600 Muted; deadline values 30px/400 with ONLY the nearest at
   700). Add the type-scale to a shared stylesheet token set rather than per-component
   numbers so drift can't recur; extend the DEC-421 render-sweep type invariant to
   assert computed weights on Overview's key roles.
3. **Seed must populate the overdue-tasks section** (refines DEC-591's "a day's work"):
   the mock's §01 shows three named overdue tasks (headshot 4 days late, slides 2 days,
   release 1 day). SEED_NOW placement must yield ≥3 overdue speaker tasks with staggered
   lateness so Overview §01 renders rows and "Remind" is exercisable — the user
   explicitly wants this comparable against the mock.

## APPENDED: user manual-QA — Submissions desktop (2026-08-12)

4. **Title-row actions are stacked vertically** (agent-missed): "Forms" and "New
   submission" render stacked instead of the design's single action row beside the h1
   (`Forms · Export CSV · New submission`). Fix the toolbar row layout while adding the
   missing Export CSV.
5. **Named native-select instances for the Tier-1 sweep**: the Submissions table's
   track filter and sort dropdowns (same foreign-to-the-system look as the header event
   switcher). Also restore the design's VISIBLE saved-views tab row (`Needs triage /
   All submissions / …`) instead of the collapsed "▶ Views" disclosure — already noted
   by the fidelity agent, elevated here per user QA.

## APPENDED: user manual-QA — Submissions PHONE view (2026-08-12) — ELEVATE TO TIER 2

6. **The Submissions phone view was never actually redesigned — treat it as a Tier-2
   surface, not a Tier-3 detail.** User verdict: "very little of the submissions phone
   view looks like the mock — very neglected." Specifics: the desktop toolbar (search +
   five status chips + track select + sort select + Columns) is stacked vertically down
   the 390px screen instead of the mock's single horizontally-scrolling chip strip
   (`overflow-x:auto`, `flex-shrink:0` chips, per README phone pattern); rows are
   squeezed table rows, not the mock's cards with Accept / Decline / Read actions;
   no fixed footer. Rebuild this view to the mock (`02-submissions--01` frame), same
   priority class as the portal rebuild.

## APPENDED: user manual-QA — CFP form builder (2026-08-12) — ELEVATE TO TIER 2

7. **The CFP form builder diverges structurally from the mock — rebuild, don't tweak**
   (user-confirmed on prod: "very different"). Target = `02-submissions--04` frame +
   its phone twin: breadcrumb ("Submissions / CFP form"), received-count strip, the
   QUESTION LIST as the page's primary content (flat rows with drag handles: label,
   kind, required, condition — not a spreadsheet table below a settings card),
   Preview button, styled date controls (not native), phone variant with Save/Preview
   fixed footer. Current page leads with a "01 — SETTINGS" card and buries the fields
   editor below the fold. Same priority class as the portal and submissions-phone
   rebuilds.

8. (User-confirmed, refines Tier-3 Submissions) New-submission modal: agent's MINOR list
   stands (Close link, button order, subtitle, "Abstract" label) — ALSO match the
   mock's placeholder text in every field, and audit placeholders across all modals
   while there (mocks specify them; prod largely omits them).

9. (User re-flagged — STRONGER than item 5's phrasing) **The Views control is poorly
   BUILT, not merely unintuitive**: expanding "▼ Views (1)" renders a half-anchored
   box that OVERLAPS the filter toolbar (evidence:
   chautauqua-research/fidelity/02-submissions/supporting--01-views-disclosure-expanded.png)
   — neither a popover nor tabs, colliding with adjacent controls. Replace the whole
   mechanism with the mock's visible VIEW tab row (`Needs triage · All submissions ·
   Accept queue · All track, unread · Save current as view`) — a first-class row above
   the toolbar, not a disclosure. Delete the floating box entirely.

## APPENDED: user manual-QA (2026-08-12, continued)

10. **Seed must include a review round IN MOTION** (refines DEC-591; user + fidelity
    agent both blocked on this): ≥3-4 reviewers on the active plan with mixed progress
    — some complete, some partial, some not started (so "Remind the N not started" is
    real), unscored items in the seeded reviewer's queue (so the scorecard's empty
    state and "Score this" CTA render), and enough submitted evaluations for the
    organiser progress/results tables to look like the mock. Without this, the entire
    Review surface can't be compared or demoed.
11. **BUG: nav active-state only follows clicks, not the URL.** Navigating directly to
    a route (deep link, refresh, back button) does not highlight the corresponding nav
    tab; only clicking the tab does. Derive active state from the router location
    (NavLink/useLocation), never from click state — fold into the shared-shell rebuild
    (Tier 1 #8) with a render-sweep assertion: every route's nav highlights its tab on
    DIRECT load.

11b. ROOT CAUSE for item 11 (user-diagnosed): the nav active check is EXACT string
     matching that breaks on trailing slashes — `/admin/review/` underlines the Review
     tab while `/admin/review` does not. Fix by normalizing the pathname (strip
     trailing slash) or using prefix/route matching, in ONE place in the shared shell.
     The render-sweep assertion from item 11 must test BOTH slash variants of every
     route. (Historical note: trailing-slash handling also caused the original
     unreachable-/admin 307 loop — normalize once, at the shell, forever.)

10b. (User-confirmed vs mock, refines items 10 + Tier-2 #12) The organiser Review
     landing must be rebuilt as the mock's three-region page — plans list w/ progress
     bars + Export CSV, INLINE reviewer-progress table w/ remind action, INLINE ranked
     results w/ Accept/Decline — confirmed unimplemented, not data-starved. AND the
     seed should provide THREE evaluation plans in mixed states (one closed/complete,
     one open mid-wave, one future) so the rebuilt plans list renders like the mock.

## APPENDED: interaction spec — plan-editor criteria (2026-08-12, orchestrator-drafted, user-reviewed)

Governs the add/edit-criterion flow inside the Tier-2 Review plan-editor rebuild (the
mock shows criteria but not their editing flow; prod's invented flow is unintuitive):
- A criterion = label + optional one-line guidance + relative integer weight (1-5).
  Scale is PLAN-WIDE, never per-criterion.
- Editing is INLINE rows in the plan editor (form-builder fields pattern) with an
  "Add criterion" tertiary link — no dialog. Soft cap ~7 with honest caption.
- Weights are relative; render the computed share beside each ("Weight 3 · 30%").
  Section caption: "Scores average by weight." Never force sum-to-100.
- **Criteria FREEZE at the first submitted review** (anonymization-snapshot precedent).
  Locked rows state the reason: "Locked — N reviews scored against these criteria."
  Changes after that = new wave. Delete follows the same rule.
- New plan prefills three editable defaults (Relevance / Depth / Speaker readiness,
  equal weights) instead of an empty list.
- Scorecard renders each criterion as label + guidance + rating pills; overall is the
  computed weighted mean, displayed not editable.
- Seed: plans carry 3 criteria with DISTINCT weights so weighted ≠ naive mean.

## APPENDED: user QA — Speakers onboarding grid treatment (2026-08-12)

12. **Strip the grid back to the mock's density; keep the capability, fix the form**:
    (a) DELETE the per-cell "View response" buttons — render a quiet "Response" text
    link (styled like the mock's "File" link) ONLY on completed form-task cells;
    nothing on pending cells; file-kind tasks keep "File" only. (b) Remove email
    addresses from grid rows — speaker line is "Company · has account" per mock;
    emails live in the contact drawer. (c) Move Add speaker + Import CSV onto the
    title action row with New task + Remind (no floating band above the title).
    Rationale: the mock's affordance rule is conditional-and-quiet; prod's 84
    mostly-dead buttons destroy scanability the grid exists to provide.

## APPENDED: sbek re-run (84.3%) — NEW defects only; knowns confirmed & omitted (2026-08-12)

13. **CSV import dedupe broken with dishonest reporting (MAJOR)**: report said "Created
    1, updated 2, skipped 0" but duplicates were actually created; dedupe is strictly
    by email so a re-import under a different address silently duplicates a person.
    Fix: name+company fuzzy check surfacing an inline "possible duplicate" choice, and
    result counts that match what actually happened (count AFTER commit, not intent).
14. **Pipeline "+ Enroll" contact dropdown programmatically inoperable (MAJOR)**: judge
    failed 8 consecutive selection attempts though options existed in the DOM — custom
    dropdown lacks real select semantics. Same family as agenda a11y: every interactive
    control must be operable via the accessibility tree.
15. **Plan "Rounds" field is largely decorative (MAJOR)**: rounds=2 only unlocks
    per-round criteria overrides. Fold into the Review rebuild: either rounds carry
    real semantics (waves w/ dates + assignments, per the multi-wave mock) or the
    field goes.
16. **"TBD" room column leaks to the public agenda** verbatim; and auto-schedule
    doesn't attempt to resolve pre-existing conflicts (fine — but say so in its result
    copy: "existing clashes left in place").
17. Bulk-reminder honesty AGAIN, new instance (content-area dialog: "Send 11
    reminders" → "sent to 0 contacts"): whatever the send path counts, the toast must
    count actual sends — one shared result-reporting helper for ALL reminder/send
    flows.
18. Small trues: speaker headshots absent from the Files area; portal upload task has
    no completion signal after upload (stayed PENDING); Content lands on "Changes
    requested" view by default showing "0 submissions" (default to All/Needs-decision);
    pipeline board flashes "0 people · Loading…" before data (suppress empty-state
    until loaded); seed must not mark a submission Accepted while it sits in an open
    blind round (DEC-591 refinement).

19. (User QA, Comms + app-wide) **Button styles are inconsistent** — the system defines
    exactly THREE tiers (primary #4E5C31 filled/700; secondary #EFEBDF + #CFC7B7
    border/600; tertiary olive text/700) and surfaces mix paddings, radii, and hybrid
    styles beyond them. Fix like ModalFrame (DEC-651): ONE shared button vocabulary
    (chq-btn tier classes), migrate every button to it, and lock with a source scan —
    no inline button styling, no per-page button CSS. The 44px phone floor applies to
    every tier (the ~22px Edit/Delete links in phone Templates are the worst case).

20. (User QA, generalizes item 18's pipeline flash) **One loading-state policy,
    app-wide**: fast operations flash "Loading…" for a frame and read as flicker
    (seen: Comms search; pipeline board). Rule: loading indicators appear only after a
    ~250ms delay (CSS animation-delay or timer), and empty-states never render while a
    load is in flight. One shared helper/class, applied everywhere a list fetches.

21. RETRACTION (user-verified live): the Contacts drawer "dim backdrop doesn't cover
    full page height" finding is a SCREENSHOT ARTIFACT — fixed-position overlays
    render viewport-only in fullPage captures. The backdrop is fine in a real browser.
    Do NOT change it. (General note for verification agents: never judge
    fixed-position elements from fullPage screenshots; use viewport captures.)

22. (User QA) Contacts directory: the search field is misplaced — prod buries it mid-page
    (below the KPI strip and "Where they work") instead of the mock's toolbar position
    directly under the title between the 1px rules (the standard toolbar pattern every
    other list page uses). Part of the Directory layout rebuild (table + sidebar,
    item in SYNTHESIS Tier 3): search belongs first, filters beside it.

23. (User QA) Third named instance for the Tier-1 native-file-input sweep: the Contacts
    "Import from CSV" modal's raw "Choose File" control. The sweep (item 7) must cover
    ALL file inputs: Content deliverable zones, Settings resources, CSV import, portal
    headshot — one styled file-picker component, scan-locked like buttons/dialogs.

24. (User QA — DOWNGRADES the fidelity pass's "best frame" verdict) **Contact merge
    must be the mock's dedicated PAGE, not a modal.** The agent scored merge MINOR on
    content fidelity (struck-through discards etc. are right) but prod presents it as
    a modal-over-list; the mock (08-contacts merge frames, desktop + phone) designs a
    full-screen surface — appropriate to an irreversible decision. Rebuild the
    container: route to a merge page from the Duplicates tab, keep the faithful
    KEEP/DISCARD content, mock's footer actions. User verdict: "does not track the
    mock well" — implementer should compare frame-by-frame, not inherit the MINOR
    rating. (Note: DEC-629 made merge set-based since the fidelity pass — re-verify
    the UI against the mock AFTER that change too.)

25. (User QA, orchestrator-verified w/ screenshot) **Bulk-email modal form layout is
    unbuilt**: labels render BESIDE inputs at drifting baselines ("Body" floats at its
    textarea's bottom-left), inputs have arbitrary non-matching widths, half the modal
    is dead space. Apply the system form pattern — labels above, inputs at the modal's
    full measure — ideally as a shared FormRow within ModalFrame (DEC-651) so every
    dialog's form inherits it. Keep the existing honesty captions.

26. (User priority signal) The user CONFIRMS the fidelity pass's Settings verdict:
    **Settings is the most divergent surface in the app** — treat Tier-2 item 13
    (content-row redesign, the two MISSING sections "Call for papers" + "People and
    roles", phone subscreens instead of accordions, the tab-bar overlap) as the top
    remaining Tier-2 priority after the agenda desktop rebuild.

27. (User QA — strengthens the fidelity PARTIAL) **Public sessions page
    (/e/:slug/sessions) is more divergent than "partial"**: missing the entire
    right-rail sidebar (Your Schedule panel + Call for Papers card), missing per-row
    "Save" itinerary buttons, and row anatomy drifts from the mock. Rebuild to the
    10-public-and-portal sessions frame — this is also where the itinerary-persistence
    CRITICAL (EMB-10/11) lives, so fix surface and storage together.

## APPENDED: design pack v4 vendored (2026-08-12 evening) — SUPERSEDES v2

`docs/design/` is now **v4**. Changed: Review, Speakers, Contacts, Content + README.
The README gained two NORMATIVE sections that supersede earlier mandate items:
- **"Review criteria — interaction rules"** — supersedes the earlier criteria spec
  append (same content, refined: mock weights 3/2/1 with the 4.5-vs-4.33 panel copy;
  "Start a new wave" from locked criteria; honest soft-cap copy). New Review frames
  cover criteria/template creation — implement from the mock, not memory.
- **"Speakers grid — interaction rules"** — supersedes mandate item 12: status cells
  are visible CONTROLS (shared shape, hover ring, footer caption); conditional quiet
  "Response" link only on completed form-kind cells; per-person "Remind ‹name›" links
  — **requires adding optional `contactIds` to BOTH `POST
  /events/:eventId/onboarding/remind` (tasks.ts:444) AND its /remind/preview sibling**
  (identical scoping, same {sent,skipped,remaining} shape, keep dedupe window + cap);
  response modal has exactly ONE action ("Reopen this task"); grid scrolls
  horizontally below ~1060px; row identity "Company · has account", no emails.
Full-resolution screens/ now include fullscreen phone captures — fidelity checks can
compare phone frames pixel-for-pixel.

## APPENDED: LIVE REGRESSION on main (2026-08-12 evening) — FIX FIRST

28. **P0 REGRESSION: authenticated /admin 500s — DEC-636's framing middleware throws
    "TypeError: Can't modify immutable headers" at src/server/framing.ts:35** when it
    stamps X-Frame-Options onto ASSET responses, whose headers are immutable in
    workerd. Every logged-in admin asset load 500s; logged-out requests redirect
    before hitting it, so shallow checks pass. Fix: clone the response before mutating
    when headers are immutable (try/catch set → new Response(res.body, res) → c.res =
    clone). The same hazard exists for ANY response-decorating middleware (DEC-658
    no-store, security headers) — audit them all and add a regression test that
    exercises header-stamping over an ASSETS-served response in workerd mode.
    (Verified fix shape on a snapshot: patch restores authed /admin to 200.)

29. **ANTI-PATTERN, fix globally: tests locking in anti-design copy.** NotFound.tsx
    keeps "Page not found" (vs the mock's "That page isn't here") because a render
    test asserts the WRONG string — with a code comment declaring the test the source
    of truth. RULE: where a test contradicts docs/design v4 copy, THE TEST IS WRONG —
    update the assertion to the mock, then fix the component. Sweep for other
    instances. Also: unify the SPA NotFound and server not-found.tsx to the mock's
    copy/links (event-name eyebrow — the data is already in the header context).
30. r2-Account dispositions: demo prefill DONE (keep); still open — login "NO
    ACCOUNT?" CTA block + event-named subheading, phone password Cancel + fixed
    footer, label/placeholder minors. (Password desktop caption FIXED.)

31. r2-Home: hub verdict mostly-faithful; six SMALL fixes: (a) remove stray "⚙"
    literal before the footer GitHub mark; (b) add the "API docs" right-aligned footer
    link (/docs/api); (c) remove the extra "Speakers" button from the open-CFP row —
    design shows ONE action; (d) date formats to the mock's British pattern
    ("12–14 May 2027", "CLOSES SUN 16 AUG · N DAYS LEFT" — no commas, no repeated
    month); (e) spell out small counts in the tagline ("One call for papers"); (f)
    text-decoration:none on .chq-home-signin and .chq-home-footer-link. Redirects,
    masthead, grouping, privacy filter all verified CORRECT — do not disturb.

32. r2-Speakers dispositions: KEEP (fixed): single-band shell, conditional Response
    link, no emails, segmented Kind picker. FIX against v4 rules: overdue cells need
    the shared control shape (ink-outlined bold caps, NOT bare text) + hover ring on
    all three states + footer caption; per-person "Remind ‹name›" links (w/ the
    contactIds API change on remind+preview); response modal action label → "Reopen
    this task" (v4 rejected "Ask for more") AND fix its data binding — completed form
    responses render as em-dashes (REAL BUG); one-line row identity; grid scrolls in
    its own container not the page; phone tab bar to fixed bottom + 44px pills;
    New-task Kind labels per mock (Upload/Form/Acknowledge), styled date; roster phone
    screen still missing entirely.

## APPENDED: SECOND P0 REGRESSION on main — FIX FIRST (2026-08-12 night)

33. **P0: REVIEWER ROLE IS FULLY BROKEN.** Reviewer login → every /admin/* route
    renders a BLANK PAGE: the shared shell's badge counts unconditionally fetch the
    organizer-only /api/v1/events/:id/overview → 403 → unhandled TypeError
    (undefined.length) in the SPA → empty body. 3/3 deterministic. TWO fixes, both
    required: (a) the shell fetches role-appropriate data only (no organizer
    endpoints for reviewers); (b) THE CLASS: an API error in shell/page data may
    NEVER yield a blank page — fail loudly with a rendered error state (this is the
    third undefined.length blank-page bug: Overview DEC-370, now the shell). Add a
    render-sweep assertion: every route × every role renders non-empty or a designed
    error/role-boundary state. **Run the per-role render sweep EARLY in the next
    wave, not only at exit — two P0s (this + framing headers) shipped mid-round and
    only outside QA caught them.**
34. r2-Review dispositions: KEEP (resolved, done well): organiser three-region landing
    (DEC-632/633), inline Accept/Decline results, DEC-596 evaluations expansion.
    STILL TO BUILD: plan editor + the ENTIRE v4 criteria spec (freeze state verified
    absent on a closed 20/24 plan); results table needs SPEAKER + TRACK columns and
    the blended SCORE shape; visible Edit affordance on plan rows; de-duplicate the
    reviewer-progress section headers; mock copy ("Remind the 4 not started" as
    tertiary, three-state DONE/NOT STARTED/N TO GO, full page summary, page-level
    Export results CSV).

35. **REGRESSION, near-P0: WAITLIST IS GONE APP-WIDE.** Submissions filter chips have
    no Waitlisted; the detail decision toggle offers only Pending/Accepted/Declined
    (verified on a pending item). The mock ships a WAITLISTED row + Waitlist action,
    and the EVAL RUBRIC exercises waitlisting. Restore the status across filter chips,
    decision buttons, bulk actions, and any status vocabulary that dropped it. Add a
    closed-vocabulary test so a status can't silently vanish again.
36. **The phone tab bar has been moved to the TOP as position:static on multiple
    surfaces** (Speakers, Content — likely one shared component). This "fixes" overlap
    by abandoning the core phone pattern. Implement the README's actual shell: fixed
    bottom five-item tab bar + fixed header + inset overflow-y:auto body. One shared
    component, all page families.
37. r2-Content dispositions: KEEP: CNT-D1 navigation fix, SIZE column, default view.
    FIX: worklist columns to SESSION/SPEAKER/LATEST FILE/STATUS with Approve + OPEN
    actions (Ask-for-changes lives on the session screen per README); session detail
    rebuild (shared version list + one scoped note thread, "Send note only", Download
    all); "Unknown (unknown)" uploader STILL present on SES-001 v2 despite DEC-601 —
    finish it; files-library stat + chips + Download-all; remove or mock-conform the
    undocumented Deliverables/Headshots tabs.
38. r2-Submissions dispositions: KEEP: views chip row, Export CSV, form-builder
    rebuild + working Preview, real Save-view modal, decision buttons + Speaker +
    Reviews sections. FIX: phone triage cards (still desktop-table at 390 — mock
    rebuild pending); detail page structure to mock (AWAITING TRIAGE indicator,
    Prev/Next + position, content controls OUT of the decision panel per "two
    screens", history section w/ visible entries, reviews as name + computed score +
    comment); RECONCILE quick-add fields: keep Track/Format capability (eval CNT-D6)
    but to mock grammar (radios, styled select, mock field set otherwise); Save-view
    subtitle echoes ACTUAL active filters + sharing becomes the mock's opt-in
    checkbox; "Columns: <state>" label; "DECLINE QUEUE" no-wrap; combined name field
    per mock.

39. r2-Settings dispositions: KEEP: the two new sections, inset scroll fix,
    copy-snippet fix, styled file inputs. THE KEY REBUILD: desktop Settings becomes
    the mock's READ-ONLY SUMMARY pattern (text values + "Edit the form"/"Change"/
    "Replace" drill-ins) instead of landing in edit-everything forms. ALSO: converge
    the rail to the mock's 7 sections (re-merge Your data; Portal+Resources as one
    "Speaker portal" section; RESTORE the "Public pages" section — simple live-page
    list w/ View + Embed code — with the Embeds builder reachable from it, not
    replacing it; Sessionboard import may stay as an extra section but introduced
    honestly); People-and-roles gains SCOPE display + a Change action; render
    Markdown in wiki resources (raw "##" showing — bug); phone subscreens per mock
    (URL-addressable), not accordion.

40. **ROOT-CAUSED QUICK WINS (r2 Public/Portal — each comes with its fix):**
    (a) EMB-10/11 CRITICAL solved: /schedule's inlined itinerary script throws
    `MAX_ITINERARY_IDS is not defined` (constant lost in SSR serialization) before
    localStorage ever writes — define the constant in the emitted script; add a
    browser test that toggles + reloads + asserts persistence.
    (b) Sign-out demotion: `button[type=submit]` specificity beats .chq-btn-tertiary —
    fix the cascade so tertiary wins.
    (c) `<a class="chq-btn">` renders underlined everywhere — add anchors to the base
    button rule + text-decoration:none.
    (d) /portal/edit Track fieldset: apply the public form's chq-cfp-option styling +
    DEC-579's "Tracks * · Choose all that apply" copy (missed here).
    (e) Format chip markup missing on /agenda + /schedule (present on /sessions).
41. r2-Public/Portal dispositions: KEEP: DEC-602 phone lists, DEC-590 worklist,
    DEC-604/605, hotel-stay fix, styled CFP. REBUILD/REPLACE: portal home must REPLACE
    the old page (remove pipe nav, welcome banner, and the letter-wrapping My
    Submissions table — the worklist + "Your session" card + footer identity IS the
    page); portal session detail to the mock (Accepted badge, code+format+track line,
    date-room, Abstract, Slides card); sessions desktop right-rail + per-row
    Save/Saved; phone CFP 2-step wizard; schedule Remove-button treatment.

42. r2-Agenda: **Tier-0 items 1 and 2 substantially CLOSED — do not disturb** (cards
    are buttons w/ accessible names; DEC-652 keyboard placing verified end-to-end;
    olive-only borders; ghosting gone). REMAINING: (a) NEW REGRESSION — phone agenda
    invisible: the unconditional display:none over the ~20 chq-phone-* classes is only
    re-enabled for .chq-phone-agenda in the ≤700px media block; extend the override to
    the full family (DOM is complete and correct). (b) Card content now HARD-CLIPS
    (conflict cards hide their caption): size cards to content or add a designed
    truncation w/ the full text on the card's accessible name (already there) — no
    silent mid-glyph cuts. (c) Focus should land on Cancel/first placement cell when
    placing mode opens (currently <body>). (d) Conflict layout: prefer the mock's
    full-column treatment or justify the split pair as a deliberate decision in a DEC.
