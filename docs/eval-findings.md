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

43. r2-Comms: KEEP: shell fix, template clipping fix, phone landing existence. FIX:
    phone step-bar letter-stacking (unchanged from r1 — give steps real min-width or
    horizontal chip strip); VERIFY DEC-603 batched history actually landed (decision
    committed, implementation absent in snapshot 259c0a4 — per-recipient rows, no
    drill-in); phone landing content (summary line, Draft-in-progress card, Recent
    sends per mock); Body textarea width = Subject width (185px vs 569px bug);
    Edit/Delete → 44px controls; per-recipient SCHEDULED/NO-SLOT tags + "N have no
    slot" advisory in Preview; make Templates/History bookmarkable routes; phone
    fixed-shell here too.

44. r2-Overview (source-verified): KEEP the many fixes (tokens, switcher, fixed phone
    shell, DEC-652 suggestions, humanized copy, buttons). FIX: (a) **"Remind all 9"
    sends only the 5 ROW_CAP'd rows — functional honesty bug**; send a server-side
    all-overdue scope (or taskIds beyond the cap) and add the "N more overdue"
    indicator per the §04 pattern; (b) .chq-overview-row-actions-stacked must actually
    be column (conflict action lines run together); (c) deadline strip: FIXED column
    order (CFP/Tasks/Review wave N/Doors), bold-nearest only — remove the sort; (d)
    mount modals at root via ModalFrame + real typography on chq-modal-title/sub and
    chq-field (current New-event ALL-CAPS is inherited by accident); (e) "Review wave"
    needs its number; (f) resolve "· min ·" (derive duration from session format or
    drop clause) + implement "waiting N days"; (g) Public pages as the mock's single
    summary row; (h) verify the four identical "Place at 9:00" suggestions are
    room-distinct.

45. r2-Contacts: KEEP: CTAs, 4-step import w/ Review, stage names, duplicates tab,
    a11y-operable enroll. FIX: **merge diff must render ALL differing fields (Title/
    Labels/Notes never appear — DEC-266 combine/append unverifiable) with the design's
    fixed-primary + per-field keep mechanic and footer**; **add-to-event needs the
    ROLE control (Speaker/Reviewer/Guest) — currently absent, role hardcoded**, drop
    the explanatory sentence, unclip Title; drawer → read-only record view (history +
    action bar already exist — reorder page around them); directory search to toolbar,
    "Where they work" to sidebar, drop FIELD/OPERATOR/VALUE row; import: split
    choose-file/match-columns steps or keep CTA above fold, unclip phone step tabs;
    pipeline card captions ("Added N days ago", "No reply · N days" bold past 30,
    declined reason); bulk-email FormRow (labels above, full measure); dedicated phone
    screens per mock.

46. (User QA + orchestrator-verified, fullPage evidence) **Public /sessions: unscheduled
    sessions render BROKEN** — all row content (title/speaker/chips/description) is
    crammed into the ~90px time-gutter column, wrapping word-per-word, row body empty.
    Scheduled rows render correctly. Likely grid misplacement: rows without a time
    cell flow content into the gutter column — give unscheduled rows an explicit empty
    gutter cell (or full-width layout) so content lands in the body column. Add a
    render-sweep assertion: no text container narrower than 200px on public surfaces.
47. **Seed abstracts: replace the synthetic filler.** Most public sessions show "A
    synthetic seed submission proposing… Generated for local development…" — visible
    to judges on the most public surface. Every seeded session needs a real,
    fixture-quality abstract (the 'Taming 40-Minute CI' abstract is the model; source
    from docs/fixtures/sample-data.json or write 2-3 sentences each in its voice).
    Fold into the DEC-591 seed rework.

## APPENDED: USER PRIORITY DIRECTIVE + clash capacity (2026-08-12 late)

48. **PRIORITY ORDER FOR ALL REMAINING DESIGN WORK (user directive): DESKTOP FIRST.**
    Polish the desktop surfaces to "really polished" before spending further waves on
    mobile enhancements. Mobile P0s already filed (phone-agenda visibility, tab-bar
    shell) still count as bugs, not enhancements — fix those; but net-new mobile
    refinement (subscreens, card layouts, wizards) queues BEHIND desktop polish.
49. **Clash capacity is capped at two (user-found): a room slot cannot take a third
    talk.** This violates J9 warn-never-block: any occupied slot must accept another
    placement with a loud warning. Audit all three paths: (a) keyboard placing mode —
    DEC-652 only turns FREE cells into Place buttons, so the accessible path cannot
    create any clash: occupied cells need a "Place here — will clash with N sessions"
    button too; (b) drag path — verify a third drop isn't rejected; (c) conflict
    RENDERING assumes exactly two (split half-width pair) — must handle N sessions in
    one slot (stack within the cell, count in the caption: "Three sessions in one
    room"). findConflicts/domain layer: verify N-way conflicts are detected and
    counted, not just pairwise-first.

50. (User QA) **Nav exception badges ("1 CLASH", "N LATE") go stale — they don't clear
    when the underlying condition is resolved.** Badge counts appear to be fetched
    once at shell mount and never invalidated. Fix: re-derive badge data after any
    mutation that can change it (placement/unplacement, task completion, reminder
    flows) — simplest correct rule: refetch shell badge counts on every route change
    AND after any successful mutating API call. Add a test: resolve the seeded clash →
    badge disappears without a full page reload. (Design rule at stake: "badge only
    when something is wrong" — a stale badge is a false alarm, the worst kind.)

48b. CORRECTION to item 48 (user, explicit): **ALL mobile work — including the
     already-filed mobile bugs (phone-agenda visibility, tab-bar shell, phone
     wizards) — is LOWER priority than desktop work.** Sequence strictly: desktop
     polish to done, then mobile. No mobile carve-outs.

51. (User QA — OVERRIDES r2's MINOR verdict) **Form-builder rows must match the mock's
    anatomy, not just its list-ness**: one-line rows — handle · field name + one-line
    CAPTION under it ("Shown on every public page" / "Up to 1,200 characters" /
    "Creates or matches a contact" / "Passed to the venue team only") · kind ·
    REQUIRED/OPTIONAL · Edit/Delete INLINE right. Remove the ↑↓ arrows (drag handle
    is the reorder affordance) and the second action line (rows are ~2.5× mock
    height). Built-ins: single "Speaker name and email · Built in" row (not split
    First/Last/Email), quiet built-in treatment instead of LOCKED pills, "Abstract"
    naming, mock's field order. Add the footer "Public link · <url> · Copy" row.
    Dates in the strip as "16 Aug 2026" style; Opens must show the seeded open date
    (seed currently leaves it blank — DEC-591 tie-in).

52. (User QA + orchestrator-verified) **Review landing button/layout grammar**: section
    actions belong ON the rules, not in floating bands. (a) Title row gets "Export
    results CSV" + "New plan" top-right beside the h1 — delete the lone New-plan band;
    (b) "Remind laggards" becomes the mock's right-aligned TERTIARY link on the
    REVIEWER PROGRESS rule, copy "Remind the 4 not started"; (c) merge the fragmented
    headers (kill the stray "Round 1 of 1" line and the WHO HAS SCORED sub-header —
    one section, one rule); (d) remove the radio circles from plan rows (mock rows are
    not radio-selected; if plan selection drives the lower sections, select via row
    click w/ quiet active state); per-row links = Progress · Results · Edit (add
    Edit, move Export to page level); (e) reviewer rows show NAMES (seed reviewers
    b/c/d need real names — DEC-591 tie-in) with DONE / N TO GO / NOT STARTED
    vocabulary, counts on one line. NOTE: three-wave seed from item 10b has landed —
    keep. GENERAL RULE (add to the affordance rules): a filled primary button never
    floats in its own band; primaries live on the title row or a form footer, section
    actions are links on the section rule.

53. (User priority, refines directive 48) **Desktop polish order — work these first**:
    (1) Review plan editor rebuilt to mock WITH the full v4 criteria spec (item 34 —
    user re-confirmed it's untouched); (2) Review landing layout grammar (item 52);
    (3) form-builder row anatomy (item 51); (4) Speakers grid v4 interaction rules
    (item 32); (5) submission detail structure (item 38) + Contacts drawer record
    view (item 45). The P0s (items 28/33) and the waitlist regression (35) still
    precede everything.

32b. Priority evidence for item 32: the USER — who commissioned the design — clicked
     the speaker-grid status pills and could not tell what the click did or why. The
     v4 affordance trio (footer caption, hover ring + control shape, overdue-as-
     control) exists precisely to prevent this; treat item 32 as top-tier desktop
     polish. An interaction that surprises its own designer will certainly surprise a
     judge.

32c. Behavior note for item 32 (user-observed): toggling a COMPLETE cell on a past-due
     task renders "X DAYS LATE" — CORRECT (overdue is derived: pending + past due;
     no third stored state exists, per SPEC). Keep the semantics. The fix is entirely
     presentational: with the v4 control trio in place, the complete→overdue flip must
     read as a state change within one control system, not a punishment. Footer
     caption stays the mock's single line — do not add explanatory clauses (copy rule
     1).

32d. Wording correction to 32c (user): the issue is not that the flip feels punitive —
     it's that "X DAYS LATE" doesn't obviously read as A KIND OF PENDING. The v4 state
     shapes already encode the mapping — complete is FILLED, pending is OUTLINED,
     overdue is OUTLINED (ink, bold caps): the outline is the shared "not done" axis,
     ink/caps is the urgency modifier. Implement the shapes exactly so the family
     resemblance carries the meaning: an outlined overdue cell visibly belongs to the
     same "not done" family as pending.

54. (User QA) **Uploaded content files cannot be deleted — no delete affordance
    anywhere in Content.** A wrong upload (wrong deck, accidentally sensitive file)
    is permanent. The mock under-specifies this; proposed semantics honoring the
    version-chain model: ORGANIZER may delete any version (confirm dialog via
    ModalFrame; chain re-links across the gap; deletion recorded in the file's
    history); SPEAKER may delete only their own LATEST version while its content
    status is still pending review. R2 object deleted too, not just the row.
    Conditional-and-quiet affordance per the rules: a "Delete" tertiary on the
    version row, never on the section.

28-ESCALATION: **Item 28 (framing middleware 500s on immutable asset headers) is STILL
UNFIXED on main after two cycles** — RouteErrorBoundary (the client half) landed but
the middleware itself still throws; every authenticated /admin load 500s on a fresh
checkout. This is the FIRST item of the entire mandate: no deploy can happen until it
lands. The verified fix shape is in item 28 (try/set → clone → retry). Fix framing.ts
AND audit noStoreByDefault + any other header-stamping middleware for the same throw.

55. (User QA + orchestrator side-by-side — SUPERSEDES the directory part of item 45)
    **Contacts directory must be rebuilt as the mock's TWO-COLUMN architecture**:
    LEFT = the table (columns NAME AND EMAIL / COMPANY w/ title line / LABELS as
    small-caps chips / per-row "Open") with pagination; RIGHT RAIL = three stacked
    sections: "Where they work" (company + count per row), "Saved segments" (name +
    rule caption + count, "Save current filters" as the section action on the rule),
    "Possible duplicates · N" (pair + reason + inline Merge / Keep both buttons).
    Tab chips carry counts ("Duplicates · 6", "Segments · 5"); search + "Segment:
    none ▾" sit ON the tab row right. DELETE: the KPI stat trio, the full-width
    Where-they-work section, the FIELD/OPERATOR/VALUE builder, the # SUBMISSIONS
    column. The rail is what makes the page a CRM instead of a list — it's the core
    of the design, not an accessory.

56. (User QA) **The agenda's TBD column renders unconditionally** — it's the null-room
    bucket (sessions with a time but no room), correctly not deletable from Settings
    because it isn't a room. Fix per the conditional-and-quiet rule: render the column
    ONLY when at least one placement is roomless for the visible day; header copy
    "No room yet" instead of the cryptic "TBD" (copy rule: plain names from the app's
    vocabulary). Keep the semantics (time-first placement is a feature). Phone room
    chips: same conditional rule.

57. r3-Account: SPA NotFound FIXED correctly (incl. its test) — but **the server
    not-found.tsx sibling was never touched and test/not-found-handler.test.ts still
    locks the OLD copy** — finish item 29: unify server 404 to design copy + fix that
    test; add the missing "Submissions ›" link to SPA NotFound. Login: the NO ACCOUNT
    block's CSS (.chq-auth-footer*) already exists UNUSED — write the JSX
    (Submit-a-talk + Browse-sessions links) and the event-named subheading. Password:
    build the phone fixed two-button footer (Change it + Cancel); placeholder "At
    least 12 characters" AND raise minlength 8→12 to match (real validation gap).

58. r3-Home: all six item-31 fixes VERIFIED (desktop hub now FAITHFUL; date branches
    unit-tested). One remaining line: phone footer — add the ≤700px rule that drops
    the descriptor clause from .chq-home-footer-text so "Running on Chautauqua" +
    "API docs" share one row per the phone mock. Then Home is closed.

59. r3-Overview: KEEP the four new fixes (deadline order, remind honesty w/ "4 more
    overdue", §04 stacking, dynamic wave number). **FIX THE FIX: splitting needed —
    §02 triage buttons now stack vertically because .chq-overview-row-actions-stacked
    is shared with §04; give §02 an inline-row class and §04 the column class** (the
    class name should describe one behavior each). STILL OPEN (carry): modal mount —
    the scrim's position:fixed only MASKS the header-identity mount; move modals to a
    root ModalFrame portal and give chq-modal-title/chq-field their own typography;
    native date inputs + STARTS/ENDS/TIME ZONE/VENUE labels; §02 "waiting N days"
    clause (kill the dangling dots); Public pages single summary row; duration clause
    (derive from format or drop); VERIFY the four identical "Place at 9:00"
    suggestions are room-distinct (add room name to the suggestion copy: "Place at
    9:00 in Room 2B" — disambiguates AND informs).

60. r3-Content: worklist DEC-692 VERIFIED (keep). FIX: session detail IA rebuild
    (unchanged); finish DEC-601 ("Unknown (unknown)" persists on SES-001 v2);
    implement item 54 delete; PORT the Settings file-input styling to Content's
    chq-file inputs (class present, styles absent); files-library stat + chips +
    Download all; remove/conform Deliverables-Headshots tabs; hide Approve on
    already-approved rows (conditional rule); worklist header copy to decision
    framing ("N need a decision · M re-uploaded") + mock pill names; relative dates
    in LATEST FILE.
61. r3-Speakers: KEEP the three fixes (per-person Remind, Reopen label + caption,
    one-line identity). FIX (carries): overdue cells to the shared control shape w/
    mock's "OVERDUE" label; hover ring all states; footer caption; **the em-dash
    response-binding bug (4/4 fields — completed answers exist but never render)**;
    contain horizontal scroll to the grid wrapper; phone shell (bottom bar + 44px
    pills + compact Remind-outstanding/Filter bar); New-task Kind labels
    Upload/Form/Acknowledge + drop extra fields + styled date; roster phone screen;
    remove desktop Import CSV (phone-roster only); "DUE 10 APR · REQUIRED" header
    format.

62. r3-Agenda: **item 49 desktop CLOSED (keep: N-aware clash Place buttons, verified)**.
    REMAINING, ordered: (a) **phone agenda STILL invisible — the ≤700px override
    re-enables only 11 of 22 chq-phone-* classes**; enumerate ALL (room chips, slot
    time/title/meta, clash wrapper, free labels, footer-armed, FOOTER BUTTONS, sheet)
    AND fix phone-block-visibility.test.ts to assert the override side per class (it
    currently passes through this exact breakage); (b) port N-aware caption to
    PhoneAgenda (line ~170 hardcodes "Two sessions in this slot") and give phone
    occupied slots the place-anyway affordance (49 parity); (c) TBD column: item 56
    still unaddressed (conditional render + "No room yet"); (d) conflict cell design
    call: scrollable-button hides speaker+caption by default — size conflict cells to
    content or add a reveal, and decide lane-split vs mock's full-width card in a DEC;
    (e) focus to Cancel/first cell on placing entry.

63. r3-Public/Portal: itinerary/rail/gutter/portal-home/sign-out/underlines/Track-
    fieldset/Format-chips/abstracts ALL VERIFIED FIXED — keep. REMAINING: portal
    session detail rebuild (mock: Accepted badge, code·format·track line, date-room,
    Abstract, Slides card); **restore multi-submission navigation — portal home links
    only the headline session and /portal/submissions 404s; add each submission as a
    linked row (or an "All your submissions" list) within the worklist page**; header
    subtitle = event + identity per README (drop the welcome sentence); phone CFP
    2-step wizard; headshot stripe texture. DESIGN-PACK NOTE: v4's Track radio art is
    stale vs DEC-579 (checkboxes correct) — update the mock, not the code.

64. r3-Settings: KEEP Public-pages restoration (fix its list: Speaker gallery row per
    mock, pill-styled state) + scope/Change scaffolding. STILL THE KEY REBUILD:
    read-only summary pattern (sections load as label:value rows w/ Edit-the-form/
    Change/Replace drill-ins; forms appear only on drill). Un-diverge: desktop rail =
    static one-document (remove the new desktop drill); merge Your data per mock (4
    export pills + tokens + RESTORE the API-docs link); fold Import-from-Sessionboard
    under Your data (rail = 7); enable Change (role) or hide it (disabled-button
    violates the affordance rule); real per-track scope values; organiser+reviewers
    only in People list; render Markdown in wiki (STILL raw — bug); Tracks-and-rooms
    read-only w/ drill-in edit; phone subscreens as routes + bottom tab bar.

65. r3-Review + r3-Submissions dispositions.
    **THE SINGLE MOST URGENT ITEM IN THIS FILE: the reviewer role is STILL locked out
    (item 33a, third cycle).** The error boundary landed; the ROLE-AWARE SHELL FETCH
    did not — the shell still calls organizer-only /api/v1/events/:id/overview for
    reviewers → 403 → crash card with dead-end recovery (Try again loops, Back to
    Overview re-crashes, /review 404s). FIX NOW: the shell requests badge/overview
    data ONLY for organizer role; reviewers get a role-appropriate shell (no badges or
    a reviewer-scoped endpoint). One conditional. Until this lands, a third of the
    app's personas cannot use it — autograder-fatal AND human-fatal.
    Review keeps: freeze-is-real, weight shares, 3-default prefill, Speaker/Track
    columns. Review carries: item 52 grammar (all of it), typed-criteria → v4 uniform
    rows, "Start a new wave", read-only locked rows, blended score column, names not
    emails, three-state vocabulary.
    Submissions keeps: **WAITLIST fully restored** (chip + toggle + bulk), phone
    triage buttons on pending rows, dynamic save-view subtitle. Submissions carries:
    item 51 builder anatomy (FAILED again — two-line rows, ↑↓ arrows, six locked
    speaker rows vs one combined built-in, "Description", settings block wedged before
    the Public link), share opt-in checkbox, detail structure set, phone fixed-footer
    decisions, co-presenter search layout bug, quick-add combined name field.

66. r3-Contacts: KEEP merge-as-page + FormRow fix. **ROOT CAUSE ORDER: build the
    Labels/customFields UI surface FIRST** (no column, no drawer row, no merge row
    exists anywhere — this blocks item 55's Labels column AND DEC-266 verification),
    then the item-55 two-column directory (still undelivered). Merge page: render ALL
    differing fields (fix the loader — Company shows "—" though the directory has
    values: DATA BUG), fixed-primary + per-field keep, pair counter, "Not a
    duplicate", strikethrough + footer. Add-to-event ROLE control (third cycle
    absent). Drawer read-only mode. Import: step panels or CTA above fold; unclip
    phone chips. Pipeline captions. Duplicates "Keep both".

67. (User QA) **Individual submission detail pages don't use the page width like their
    sibling pages — content leans left with dead space right.** Compare the detail
    mock (02-submissions--02): sections span the same measure/margins as the list
    pages. Fix: unify the detail page's container with the shared admin content
    measure (same max-width + margins as Submissions/Overview), and check the same
    on Content's session detail + Review plan editor while there — one shared
    page-measure token, not per-page widths.

68. r3-Comms: DEC-603 mechanism KEEP (code-verified). FIX (carries, measurements
    unchanged from r2 — this file has absorbed the least of its queue): phone
    step-bar letter-stacking; Body textarea = Subject width (187 vs 571px); 44px
    phone Edit/Delete; phone landing content (summary + Draft card + Recent sends);
    per-recipient SCHEDULED/NO-SLOT tags + advisory; bookmarkable Templates/History
    routes (reload must not reset to Compose); bordered "See the recipients" CTA on
    batch rows; persistent Recent-sends under Compose. SEED: add one multi-recipient
    batch (~23 recipients) + 4 more templates so History/Templates demo like the mock.
