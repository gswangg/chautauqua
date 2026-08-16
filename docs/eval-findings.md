# Eval findings — rebased 2026-08-15 (wave 50, task-w50-i)

Verified against `main`/HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`
("scribe wave 50"), MEASURED_SHA `87cee8b9`, derived AT THIS TASK'S OWN
RUNTIME (DEC-069 wave-17/wave-37, DEC-358 rebase rule) by running, in
order: `git merge --no-edit main` (worktree cut directly from `main`'s
tip — reported "Already up to date"); `npx tsx scripts/ref-state.ts`;
`git for-each-ref --format='%(refname:short) %(objectname:short)'
refs/heads` (46 live branches) plus `git merge-base --is-ancestor <ref>
HEAD` for every one, run individually (never a `.git/refs/heads/*` glob,
never the `.git/packed-refs` `refs/heads/main` line). `ref-state`'s
receipt, verbatim: DEC-644 three-sha boundary — HEAD `87cee8b9`; newest
first-parent product-code-bearing sha `c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`;
ancestors of HEAD: `main`, `manual-qa`, `task-custodian-w68-4`,
`task-w47-a`, `task-w47-g`, `task-w47-h`, `task-w48-a`, `task-w48-c`,
`task-w48-f`, `task-w50-e`, `task-w50-h`, `task-w50-i`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`. NON-ancestors: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`,
`task-w49-a` through `-h`, `task-w50-a`, `task-w50-b`, `task-w50-c`,
`task-w50-d`, `task-w50-f`, `task-w50-g`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a` through `-j`. **The pinned mandate
(`32921050`, wave 47/task-w47-h) is now confirmed an ancestor of HEAD** —
every wave-47 branch (`-a` through `-h`) landed since that pin; see the new
TIER 0 "Landed since the wave-47 boundary" subsection.

COMPACTION per DEC-358's rebase rule: the wave-47 header is REPLACED by
this one, not prepended (three waves stale: it predated wave 48's battery
sections and every wave-49 lane). No per-item citation is deleted, only
re-homed/compacted. Re-glob receipt (programmatic, this runtime): every
backtick-quoted file-path citation in this document (169 distinct paths)
was resolved against the working tree by exact path or, where a citation
uses a bare filename inside a list, by unique basename match; **all 169
resolved to a real file — zero false "exists" claims carried forward.**
No "does not exist" claim is currently carried in this document (the two
prior absence claims, `localhost:8799` and `TBD`, were themselves CLOSED
by wave-46/task-w46-f and are cited as closures, not re-asserted as
absences needing re-globbing).

**This wave's own addition — folding the wave-47/48 range in.** All seven
wave-45 CONFIRMED-DEFECT rows the wave-47 header carried as IN FLIGHT are
now CLOSED: every `task-w47-a`..`-g` owning branch is a confirmed ancestor
of this HEAD, and this task independently re-ran each item's falsifying
check against the live tree (not inherited) — see the new TIER 0
subsection below, which also folds in wave-48's three landed gate
sections (`0240` build+test+bundle, `0242` perf-smoke, `0244`
render-sweep) and reconciles `0240`'s two filed OPEN ITEMS against the
current tree. Wave 49's eight lanes and wave 50's non-scribe siblings are
NOT ancestors of this HEAD — named as OWNED-BUT-UNMERGED in IN FLIGHT
below, per this task's own boundary (a discharge status this lane did not
itself verify is never restated as closed).


## V11 DESIGN INTAKE (2026-08-15) — authority now design-frames-v11 (153 frames)

Vendored: 7 changed `.dc.html` + DESIGN-RULINGS.md (support.js/README byte-identical
to v10). Frames rendered to `chautauqua-research/design-frames-v11/`, verify-frames
receipt: 12 sections / 153 frames, 10 width flags ALL the known-benign +2px border
class. **16 net-new frames, zero removed, one in-place edit.** V11's theme: explicit
interaction/component STATES + frames for flows that were implemented but never
designed. Everything below is design authority now; the v10 co-presenter spec
(section below) still stands unchanged.

**A. Cross-cutting state specs (frames 01--05 "States" and 01--06 "Loading", both
1600 reference sheets, + new DESIGN-RULINGS sections). This is NET-NEW work — the
SPA today has ZERO `transition:` declarations and no unified hover tiers:**
1. **Button hover tiers** — each tier darkens in its own family, NOTHING moves (no
   lift/shadow/scale/border-width change): Primary `#4E5C31`→hover `#3C471F`→active
   `#33401A` · Secondary `#EFEBDF`/1px `#CFC7B7`→`#E4DFD2` border `#BAB6A6`→`#DCD6C6`
   · Tertiary link olive→`#3C471F`+underline · Destructive tertiary `#565A4B`→
   `#1B1D17`+underline. Disabled = `#8E8A7A` on `#DDD8C8`, NO hover, cursor:default.
   Transition `background-color` ONLY at 120ms — never `all`.
2. **Motion spec** — 120ms ease-out (colour), 180ms ease-out (appear-in-place),
   220ms cubic-bezier(0.2,0,0,1) (geometry); exits at HALF duration. NEVER animate:
   optimistic writes (rollback must be distinguishable), rows arriving, numbers,
   the focus ring, print paths, behind-modal. `prefers-reduced-motion`: geometry →
   90ms opacity fade, colour → 0ms.
3. **Pending** — four slow ops only (bulk send, CSV import, upload, auto-schedule):
   the button IS the progress indicator ("Sending 12 of 23…", cursor:progress), it
   is the ONLY disabled thing, <300ms show nothing, never fake percentage, result
   panel reports (button never says "Sent!").
4. **Loading/first paint** — chrome draws immediately, only rows wait; <250ms show
   nothing (useDelayedFlag's 250ms default already implements this); ALWAYS six
   skeleton rows at final row height, `#EFEBDF`, varied widths on title col only,
   NO shimmer/pulse. Verify PageSkeleton/DelayedLoading against this.
5. **Rows/cells** — fill for row hover; status cells that carry their own fill take
   a `0 0 0 2px #CFC7B7` RING on hover, never a second fill (speakers grid).
6. **Inputs** — hover darkens border to `#8E8A7A` only; focus = 2px olive outline +
   `#4E5C31` border; read-only `#EFEBDF` fill takes NO hover; no label recolour.
7. **Drag** — dragged item opacity:0.6 full-size (no rotation/scale/shadow), origin
   leaves `#EFEBDF` well with 1px dashed `#BAB6A6`, valid target = agenda free-slot
   vocabulary (`#EFF1E4`/dashed `#A9AE94`), occupied targets ACCEPT and flag the
   clash, every drag has a keyboard equivalent.
8. **Touch** — no sticky hover; :active on touchstart; `-webkit-tap-highlight-color:
   transparent`.

**B. New frames for implemented-but-undesigned flows (each was shipped from code
inference; now framed — reconcile implementation to frame):**
- **ConfirmDialog two weights** (09--21/09--22): reversible = sentence + verb-carrying
  primary ("Turn it off", NEVER "Confirm"/"OK") + what survives; irreversible adds
  TYPE-THE-NAME confirm (portal resource, event delete, contact merge). Dialog names
  the blast radius from real data. Current ConfirmDialog.tsx has ONE weight and no
  type-to-confirm — extend it; this also governs the two DEC-941 dialogs still owed
  (gate-9 lane item 1).
- **Settings invite flow, 3 frames** (09--18/19/20): primary reads **Create the
  account** (POST /api/v1/users creates immediately — no invitation exists); created
  screen shows one-time password mono 20px + Copy + "Closing this dialog is the last
  time you see it"; states the email_log.event_id gap honestly (org with no events
  gets a working account and NO email); rejected duplicate offers "Open <name>'s row".
  **Do NOT design/build a pending-invitation state — the schema has none.**
- **Reset a password** (09--24, PeopleRolesPanel): same reveal-once shape as invite;
  states sessions are ended everywhere + resetting sends NO email.
- **Portal resource add** (09--23): modal, File/Link as exclusive chips, delete via
  irreversible confirm.
- **Sessionboard import** (09--25): 3 steps in ONE modal; step 2 shows per-entity
  counts + dispositions; states nothing writes until step 3, Sessionboard read-only.
- **Track colour** — swatch LEFT of name in edit rows, captioned "how a track reads
  on the agenda and the public pages".
- **CFP FieldModal** (02--10): conditional visibility reads as a SENTENCE ("Only
  show this question when… Format is Workshop"), off-state stated; value control
  follows trigger kind; **a hidden question is never required** (modal says so);
  header carries blast radius ("47 people have already answered"); delete far-left
  through irreversible confirm.
- **New contact** (08--16): email carries WHY required (matching/merging); modal ends
  naming what it does NOT do (directory ≠ event; Add to an event is separate).
- **Breaks editor** (06--02): rows with Remove + three-up add row; states a break
  blocks EVERY room at once, and out-of-window breaks are kept-but-flagged.
- **Portal preview** (10--24, /portal/preview DEC-747): read-only banner + "Not shown
  here" chips section + "to see a real speaker's portal you would have to be them";
  resource Download disabled; Settings row copy = "Open as a speaker", never
  "sign in as".
- **CFP not_yet_open** (10--25): same card measure as closed state, leads with the
  opening date ONLY when one is set (seeded form has none → "The call for papers is
  not open yet", no invented date); offers last year's sessions.
- **Portal · Resources 390** (10--26).

**C. In-place edit (only one):** Review ProgressPanel (03 frames) — TWO reminder
scopes: "Remind laggards (N)" (anything outstanding; disabled when empty) and
"Remind the N not started" (scored nothing; per DEC-760 HIDDEN not disabled when
zero). Both report the standard `{sent, skipped, remaining}` line.

**D. Corrections in DESIGN-RULINGS:** the password-reset section now acknowledges
the implementation (`src/routes/auth-reset.tsx`) — the four 11--05..08 frames are a
re-skin; use `loginStatusLine()`'s existing "Your password has been changed. Sign
in with it." string and confirm the real token lifetime before writing any duration
into copy.

**SWARM LANE (priority order): (1)** A1+A2 tokens as shared CSS (hover tiers +
motion durations + reduced-motion) applied product-wide; **(2)** ConfirmDialog
second weight + the two DEC-941 dialogs land AS the new spec; **(3)** invite/reset
password frames (PeopleRolesPanel was just re-worked — reconcile, don't regress the
grid fix); **(4)** FieldModal conditional-visibility copy + hidden-never-required;
**(5)** remaining B items; **(6)** C reminder scopes; **(7)** A3/A4 pending+skeleton
verification. Closures need MEASURED evidence against design-frames-v11.


## V10 DESIGN INTAKE (2026-08-16) — authority now design-frames-v10 (137 frames)

One-section handoff: the PORTAL CO-PRESENTER form (DEC-604's unframed bare stack) is now
framed — composed INSIDE /portal/submissions/:id/edit (one view, not a route), existing
participants listed FIRST, add-form second, submit is SECONDARY (the page's primary stays
Save changes). Three mandatory copy facts: "No email goes to them — tell them yourself" ·
co-presenters stay unpublished until the organiser publishes ("repeated per row, muted") ·
window line "You can change this until the form closes on <date>" REPLACES the old
"Edits are live on the public pages straight away" sub-line (which contradicted fact 2).
Desktop 1600 frame (10--23): names two-up, email + 190px role select paired, footer
right-flushed Cancel + Save changes; Add co-presenter left-aligned natural width.
Duplicate = server-only rejection in the standard error shape (frame 10--22). SWARM:
build portal edit to these two frames.


## GATE-9 SWEEP VERDICTS (fidelity-gate9/group*.md; orchestrator fixed the BROKEN + 4 regressions, dd72356b deployed + migration 0044)

**Verdicts: 3 PASS (04/06/08) · 2 MINOR (01/10) · 6 MAJOR · 1 BROKEN (03, now FIXED).**
Orchestrator already fixed+deployed: seeded-plan day-label BROKEN (healing migration
0044, prod PATCH 200 verified) · bare-page input fill (188px collapse, R-A) · files-table
26px shared-class pin (05 regression) · notes-rail min-width (05) · reviews col fits the
recusal label variant.

**SWARM LANE (remaining, with the fleet's proven root causes):**
1. **Delete-confirm scan is BLIND to generic apiDelete calls** — `apiDelete<{...}>(`
   defeats the literal `apiDelete(` match; TWO sites ship unconfirmed destructive
   deletes: SubmissionDetailPage.tsx:704 (Remove co-presenter) and Agenda.tsx:208.
   Fix the scan to match `apiDelete` bare + add the DEC-941 ConfirmDialogs.
2. **02: CFP builder regressed to chq-measure-table** (commit 5bbea7ee conflated
   full-bleed chrome with content measure) — frame 02--04 draws 756 @ x422; restore the
   reading class.
3. **11: auth h1 back to 36px** (frame 28px, re-break of a gate-4 closure) — my bare-page
   fix sets 28px; VERIFY it took across 404/password/expired-claim. Plus carried rhythm
   items (404 block 166 vs 126; body→links 46.5 vs 26.5 from min-height:44px links).
4. **03 residue**: plan-editor 400s drop per-field messages (UI says only "Invalid
   plan"); scorecard rail gutter 36 vs 60; /plans/:id/progress has NO max-width (1532).
5. **07**: history tab still lacks column heads, filter chips, right-flushed search.
6. **09**: 9 remaining (per group3 report — field widths beyond dates, footer grammar,
   portal toggles, embed card anatomy).
7. **12-home: measure 820 vs frames' 732** (home.css.ts:21 HOME_MEASURE) — the frames
   draw 732 consistently; align or file a ruling.
8. **05**: .zip accept-list policy DEC still open.
Also recorded: 01-overview all four MAJORs closed (MINOR now) · 10-public MINOR ·
04/06/08 full PASS with clean functional click-throughs · v9 reset flow verified live
end-to-end minus frame 07 (needs minted token).


## Structure of this document (decomposed, wave 52 — task-custodian-w52-5)

This file was a single 1022-line append-only log and a recurring merge-
conflict hotspot (four conflicts across waves). It is now an index; every
section that used to live inline here is its own file under
`docs/eval-findings/`, in reading order, so unrelated waves editing
different tiers no longer collide on the same file. No content moved
across a tier/section boundary and no line was deleted — this is a pure
split, verify against git history if a citation seems to have moved.

1. [`eval-findings/01-user-filed.md`](eval-findings/01-user-filed.md) — USER-FILED P1
2. [`eval-findings/02-standing-rules.md`](eval-findings/02-standing-rules.md) — Standing rules (still bind)
3. [`eval-findings/03-tier0-landed.md`](eval-findings/03-tier0-landed.md) — TIER 0: landed-since-boundary re-verifications
4. [`eval-findings/04-tier0-dismissed.md`](eval-findings/04-tier0-dismissed.md) — TIER 0 (continued): dismissed / stale / do-not-re-file
5. [`eval-findings/05-tier0-verification-render.md`](eval-findings/05-tier0-verification-render.md) — TIER 0 (continued): verification-log & render-sweep closures
6. [`eval-findings/06-in-flight.md`](eval-findings/06-in-flight.md) — IN FLIGHT: owned by a branch, do not re-file
7. [`eval-findings/07-tier1.md`](eval-findings/07-tier1.md) — TIER 1: open items
8. [`eval-findings/08-tier2.md`](eval-findings/08-tier2.md) — TIER 2: unverified, candidate for re-check
9. [`eval-findings/09-mobile-queue.md`](eval-findings/09-mobile-queue.md) — Mobile / phone queue

Any citation of the form `docs/eval-findings.md #N` or `docs/eval-findings.md
Section X` refers to content now living in one of the files above; the
mandate-item numbers and section letters embedded in the prose are
unchanged (grep `docs/eval-findings/*.md` for the item/section token).
