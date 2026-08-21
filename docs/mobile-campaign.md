# v12 mobile + fidelity campaign mandate

The campaign goal: every screen matches its v12 frame on desktop AND phone.
Authority: docs/design/*.dc.html (v12 geometry), DESIGN-RULINGS.md (rulings),
DEVIATIONS.md (user overrides). This file is the campaign mandate the planner
works from, tiered.

## TIER 0 (2026-08-19 meta-probe, VERIFIED reds — work these before all else)
docs/probes/metafid-phoneA-2026-08-19.md (clusters A) AND docs/probes/metafid-phoneB-ssr-2026-08-19.md (clusters B+SSR) were round 1. ROUND 2 SUPERSEDES their open rows: docs/probes/metafid-round2-2026-08-20.md — work its WAVE A (docks) then WAVE B (tokens+layouts). ROUND 3 SUPERSEDES round 2's own backlog in turn: docs/probes/metafid-round3-2026-08-20.md records Wave B CLOSED and Content DONE, and this file's own "Meta-fidelity round 3 ... CURRENT RED SET" section below records round 3's three-item red set as now CLOSED as well — the "two CRITICALS in B are being fixed by a META lane" sentence this paragraph used to end on described that in-flight state three probe rounds ago and is stale; there is no META lane still in flight against WAVE B today. The two disproportionate root fixes plus the S1 breaks and S2 structure rows live in docs/probes/metafid-phoneA-2026-08-19.md, NOT the desktop file (docs/probes/metafid-desktop-2026-08-19.md contains no S1/S2/negative-margin/section-action rows at all — verified by grep, DEC-967 wave-154 amendment). Both root fixes there are already CLOSED: app/src/pages/comms/comms.css`.chq-comms-head-actions > .chq-pill {` (bordered-control cancelled-padding removed) and app/src/pages/settings/settings.css`.chq-settings-section-action {` (44px phone floor added). Work phoneA's remaining open S1/S2 rows next.

## Tier 0 — fidelity on landed work (verify first, then fix)

The v12 speakers redesign and the wave-1 phone clusters (Contacts, Comms,
Submissions, Content) were implemented by pre-campaign lanes. Audit them
against their frames BEFORE building new work on top:
- Speakers desktop: grid weight inversion, column-head aggregates
  ("7 of 12 done", name links to task view), single "Edit tasks" control,
  bulk bar (Remind these / Not needed for these), the NEW task page in both
  states ("One task, every speaker" / "One task · still waiting" — answers
  table, export, reminder history, per-row standing notes), speaker detail
  (per-session participation menus in Sessions rows, tasks tracks
  1fr 132px 96px 150px), dense/roomy token pairing.
- Wave-1 phone clusters at 390: every width:390 frame in their .dc.html.
File a finding per divergence; fix findings as worker tasks.

## Tier 1 — remaining phone clusters (implement to frame)

Phone frames (width:390) per file: Settings 9 · Public and Portal 14 ·
Review 5 · Home 3 · Account 2 · Speakers 2 · Agenda 1 · Overview 1 · Docs 1.
Cluster boundaries: app/src/pages/<cluster>/** for SPA pages; src/routes/
(portal/, public/, docs-site, root, auth) for SSR surfaces. The SHELL lane
(admin nav/header phone chrome, page padding, drawer behavior — app/src
App shell + app/src/styles.css + src/views/theme.ts) is its OWN task; page
tasks must not touch shell files and instead record shell needs as findings.

## Tier 2 — cross-cutting sweeps (after T1 lands)

- 44px-floor sweep at 390 across every interactive element (measure, don't
  grep — the ruling names two evasion modes).
- Density-pairing audit: dense tokens only in matrix cells; roomy everywhere
  a row is a real target; colour/weight identical per pair.
- Horizontal-overflow probe at 390 on every page.
- Disabled-token compliance (two legal uses) at phone sizes.

## Hard rules (every role, non-negotiable)

- NEVER `git push`. NEVER deploy. NEVER `wrangler` with `--remote`. Local
  commits/merges only — the user reviews before anything leaves the machine.
- Port 8878 and everything under ~/.claude/jobs/ are OFF LIMITS. Dev servers
  for probes run on free ports above 9100 and are killed by PID (never by
  name) before the probe finishes.
- Desktop is FROZEN: phone work lives in max-width media blocks (DEC-385
  single-direction); desktop pins stay green; a desktop-affecting change is
  legal only when a v12 desktop frame demands it.
- Workers run TARGETED tests only; the full suite runs at merge-train
  batches and verification waves.
- macOS zsh: never write bare `==`/`===` tokens in shell commands.

## Wave-1 handoff findings (pre-campaign lanes; planner must schedule)

Shell lane (T1, blocking several page frames):
- Phone page scaffold: frames draw header (flex-shrink:0) / body (flex:1,
  overflow-y:auto) / pinned footer inside the 390 viewport; pages scroll as
  one document today. Needed by: Contacts drawer errand flow, Submissions
  detail decision bar, Content docked bars (Approve N / Download all /
  Ask for changes).
- Bottom tab bar: CSS exists (styles.css:390-402) but Submissions reports
  nothing renders the five-item nav; reconcile and mount it.
- .chq-drawer phone inset 16px (now 20px 26px; sticky-bar negative margins
  at styles.css:1128-1145 are paired to the 26px and must move with it).
- Drawer back-link header (`‹ Contacts` 44px) — ModalFrame affordance.
- .chq-header phone slot treatment (selection counter "2 of 318").
- .chq-page-title phone size (Files H1 wants 25px at 390).
- Global: .chq-table td:first/last-child 16px inset stacks on .chq-main's
  gutter at 390 (32px total) for every card-stacking table; comms
  neutralized its own two tables; fix globally.

Unclaimed frame: "CFP form · 390" (Chautauqua Submissions.dc.html:468)
renders from app/src/pages/forms/** — no lane owned it. Schedule it.
CLOSED (re-verified wave-140/w15-ff): src/routes/public/cfp.css.ts's
task-w13-k terminal phone block builds the frame's step dock (`.chq-cfp-actions`
IS the sticky dock band, no second `data-chq-phone-dock` declaration needed
per its own comment) and fixes the 290px-vs-358px column-budget root cause
via `main.chq-measure:has(.chq-cfp-body) { padding-inline: 0; }` (single
gutter owner, DEC-385) — this also closes round-2 WAVE B's "CFP column
290px vs 358 budget" row.

Feature-shaped gaps (frame draws behavior, not just geometry — schedule as
tasks, or record as DEVIATIONS if the planner judges them out of scope):
- Comms.tsx phone landing: frame draws a DRAFT IN PROGRESS card + "Read the
  draft" over Recent sends, superseding the DEC-621 three-button chooser.
  CLOSED (re-verified wave-140/w15-ff): src/decisions-data/DEC-621.md rules
  the card real (`app/src/pages/Comms.tsx` reads a per-event localStorage
  draft record ComposeWizard writes on step advance) and `app/src/pages/Comms.tsx`'s
  DEC-621 wave-87 amendment comment block ("draftRecord comes from") shows
  the landing renders it from that record, not a `draft={null}` stub.
- Content queue "Select mode" (Select link swaps row verbs for a docked
  bar; header becomes "3 selected · All 5 · Done").
  CLOSED (re-verified wave-140/w15-ff): `app/src/pages/content/ContentApp.tsx`'s
  w1-e/DEC-825 comment block ("phone-only... `2 selected` / `All 5` /
  `Done`. Replaces the summary line") plus its DEC-989 wave-85 comment
  ("Select mode mounts its own docked bar") show the mode and its docked
  bar are both built.
- Import CSV one-column-per-screen pagination (Next column / Skip).
  CLOSED (re-verified wave-140/w15-ff): `app/src/pages/contacts/ImportWizard.tsx`
  implements `toggleSkipLine`/`skipLines` state and a phone pager; its
  companion test file name is
  `app/src/pages/contacts/ImportWizard.phoneColumns.render.test.tsx`.
- Submissions card third action: frame draws bordered "Read"; app has
  borderless tertiary "Waitlist" — design decision needed.
  CLOSED (re-verified wave-140/w15-ff): the design decision landed as
  "Waitlist" (not "Read" or "Wait") —
  `app/src/pages/submissions/SubmissionDetailPage.phone-dock.render.test.tsx`'s
  own comment states "Exactly one Accept control, one Decline, one
  Waitlist (never 'Wait' --" and asserts
  `screen.getAllByRole('button', { name: 'Waitlist' })` has length 1;
  `app/src/pages/submissions/BulkActionBar.tsx` renders the same
  `{ status: 'waitlisted', label: 'Waitlist', primary: false }` action.

Cascade rule (two lanes hit it independently): a stylesheet whose desktop
rules are declared AFTER its max-width block silently kills equal-
specificity phone overrides. content.css and comms.css are fixed and
pinned; sweep the remaining stylesheets for the same exposure.

## User-filed (2026-08-19, morning review — fix agent dispatched, lenses must verify)
- Speakers surfaces show NATIVE focus rings; the design-system :focus-visible
  treatment (styles.css:225) must reach every interactive element there.
- Task view answered tab offered "Open" universally; the response viewer is
  form-only. Per-kind actions: form=Open, file_request=file link, general=none.

## Eval root-cause round (2026-08-19 evening) — swarm follow-ups
- INTEGRITY: src/decisions-data/DEC-986.md (scribe wave 10/11) documents phone-CFP
  fixes that DO NOT EXIST in the tree — cfp-steps-script.tsx:33 still calls
  setStep('2') with no reportValidity(), form-render.tsx:278 still uses singular
  querySelector. (a) Actually implement the phone-CFP step-1 validation dead-end
  fix; (b) correct the false doc; (c) lens: audit scribe-authored DEC docs
  from waves 10-11 for claims not backed by the diff, AND audit css/code
  comments for citations of DECs that do not exist (found: agenda.css cites
  a "DEC-021 delta-2 amendment" that grep cannot find; the 9f12f7ce commit
  body also justified its overlay on a false premise).
- Pre-existing UX bug (portal edit): "Add co-presenter" is a full-page POST that
  silently discards unsaved title/abstract/track edits (a55cce81, by the page's
  own inviting copy order). Schedule a fix (preserve the draft across the POST or
  make the add row-scoped).

## RULED (user, 2026-08-19): D19 cross-event switch — explicit, never silent
The URL write-through in useCurrentEvent.ts:90 stays (page and context move
together; the app keeps its one-event-at-a-time invariant), but the moment a
URL eventId OVERWRITES a different stored context, announce it: a banner
"Switched to <event B> · Back to <event A>" with a one-click return. No
transient/split-view state. Pin: navigating with a URL eventId equal to the
stored context shows no banner; differing shows exactly one, and the return
link restores the prior context.

## Scheduled: D21 stale-while-revalidate cache (swarm task)
lib/api.ts gains an SWR cache keyed on URL + the existing mutation-bump
counter: render last-known data on revisit (no skeleton when a cached
payload exists), refetch in background, reconcile. Respect the bump counter
for invalidation; add cross-page tests (contacts, speakers, submissions).
CLOSED (re-verified wave-140/w15-ff): `app/src/lib/api.ts` declares
`export async function apiGetCached<T>` and `export async function
apiListCached<T>`, both under the file's own `// DEC_013: SWR read cache,
opt-in per call site via apiGetCached/apiListCached.` comment, importing
`DEC_013` from `src/decisions.ts` so the dependency is compile-checked.

## Ruling needed (from the tracks/rooms refusal fix, bbcf8b06)
`discardDirtyAndClose` clears row errors but not the add forms' field errors,
so Done-with-discard parks an add refusal for the next drill-in. Needs a
ruling: does Done-discard also drop an unsaved add draft + its refusal?
CLOSED (re-verified wave-140/w15-ff, DEC-941 wave-125): ruled yes.
`app/src/pages/settings/tracksRooms/useTracksRoomsPanel.ts`'s
`discardDirtyAndClose` function calls `retireAddForms()` (its DEC-856
wave-72 helper) in its body, and the file's own comment above it states
the per-error-state rule directly: "the ONE... already retires both add
forms' field-error maps, drafts, and open/closed state via
retireAddForms()". Pinned by
`app/src/pages/settings/TracksRoomsPanel-done-discard.render.test.tsx`.

## Citation corrections for the doc-integrity lens
- Commit 69baba8d and any comments citing DEC-919 for always-mounted bulk
  bars: correct authority is DEC-752/DEC-825 (DEC-919 is the public filter
  idiom). Sweep code comments for the propagated miscitation.
- Anywhere citing DEC-302 for flag-not-block scheduling: correct authorities
  are DEC-010 waves 66/71, DEC-557 clause (f), DEC-377, SPEC J9 (DEC-302 is
  npm audit advisories).

## RULED (DEC-380 wave-116): agenda 390 dock membership
The open question above is closed. See DEVIATIONS.md §3 ("Agenda 390 phone
dock stays exactly the two frame controls; Publish schedule and Breaks live
in the head's action row (DEC-380 wave-116 amendment)"): the dock stays the
frame's, unchanged (Unscheduled + Auto-schedule only); Publish schedule and
Breaks stay in the head's full-width action row at the 44px floor.

## Worker discipline (meta-observed, 2026-08-19)
- Commit d3f6bf0c staged with `git add -A`, sweeping 23 files from four
  OTHER lanes under an unrelated message. HARD RULE (restated): path-scoped
  staging only, never `git add -A` — a worker commits exactly the files its
  own task touched. Merge trains: attribute d3f6bf0c's swept content to the
  meta fix lane (CFP/agenda/scorecard/docs fixes).
- `git stash` is unsafe in the shared repo (two workers raced stashes);
  stash@{1} "merge-train: planner decision docs" is stranded and needs its
  owner to apply or drop it. Workers: never stash on shared main — commit or
  leave the tree alone.

## Speaker-management score floor (META-OWNED as of 2026-08-20 — engine must NOT duplicate; a meta lane is fixing all three)
Three recurring/new minors keep the area in the high-80s:
1. HEADSHOT METADATA (filed in ALL FIVE eval runs — highest-yield fix in
   the rubric): a portal-uploaded headshot must appear in the record's
   Files table with filename/uploader/timestamp like any other file object,
   not only as an avatar + bare Download link.
2. CSV-merge email overwrite (root-cause needed): merging an imported row
   into an existing contact replaced the contact's org-wide email with the
   imported value — decide/enforce merge field precedence (probably keep
   existing unless organizer picks the imported side; the merge tool's
   pick-a-side idiom exists).
3. Portal dashboard banner shows ONE ambiguous slot for a two-session
   speaker ("you speak Thu 13 May, 09:30 · Main Stage") — enumerate both or
   say "2 sessions".
Also: sweep other short SSR pages for the mid-page-footer defect just fixed
on the home hub (home.css.ts sticky-footer pattern).
CLOSED (re-verified wave-140/w15-ff): `src/routes/docs-site.css.ts`'s
`.chq-docs-shell { display: flex; flex-direction: column; min-height:
100vh; }` carries the same "DEC-383 amendment: sticky-footer idiom,
home.css.ts's .chq-home-shell" comment as the home hub; the portal shell
(`src/routes/portal/portal.css.ts`) also declares `min-height: 100vh;` on
its shell rule. `src/routes/public/shell.tsx` renders no `<footer>` element
at all (grepped for `footer`/`Footer`, zero matches), so the public event
shell has no mid-page-footer surface to sweep — the sweep is complete.

## Cut-2 eval round — new judge-filed items (2026-08-20, root-cause then fix)
1. MAJOR follow-on to the wave-115 merge fix: the import-merge plan's copy
   now promises the stored email is preserved, but OTHER profile fields
   still overwrite silently — either disclose every overwrite in the plan
   (the struck-through old→new idiom exists) or extend preservation; the
   copy and the behavior must agree.
   CLOSED (re-verified wave-140/w15-ff, DEC-936 wave-128): `src/domain/contacts.ts`
   declares `describeImportOverwrites`, whose output feeds
   `app/src/pages/contacts/ImportWizard.tsx`'s `row.overwrites` rendering
   (three call sites: the merge-decision check, the plan row, and the
   struck-through list itself at `{(row.overwrites ?? []).map((ow, i) =>`).
   `ImportWizard.render.test.tsx`'s own comment: "DEC-936 (wave 128):
   describeImportOverwrites now discloses a" [every overwrite].
2. CRM pipeline card detail modal opens EMPTY (heading + buttons, no
   content) until data arrives — needs a loading state or deferred open.
   CLOSED (re-verified wave-140/w15-ff, DEC-678 wave-128): `app/src/pages/contacts/PipelineBoard.render.test.tsx`
   carries `describe('PipelineBoard: card detail modal defers its body
   until the fetch resolves (DEC-678, wave-128 Cut-2 item 2)', ...)`,
   named for this exact item.
3. Speakers/gallery search placeholder says "Search sessions" but filters
   speakers.
   CLOSED (re-verified wave-140/w15-ff): `src/routes/public/speakers.tsx`
   now reads `placeholder="Search speakers…"` at both its call sites.
4. Add-speaker form REQUIRES a session title, so a roster add must invent a
   session; related: "Add <name> to this event" creates a brand-new session
   from the typed title even when an identical one exists. Decide the
   roster-add-without-session story per the frames/DECs.
   CLOSED (re-verified wave-140/w15-ff, DEC-909 wave-128): `app/src/pages/speakers/RosterPanel.tsx`
   renders `<FormRow label="Title" htmlFor="roster-title" optional
   error={fieldErrors.title}>` and its `help` copy states "A title matching
   an existing session joins it instead of creating a new one." Pinned by
   `RosterPanel.render.test.tsx`'s 'adds a speaker with no session title
   typed: the field is optional and the add still succeeds' case, which
   asserts `Session title` closest label reads `Session title · optional`.
5. Bulk-send wizard counts disagree across steps ("17 submissions selected"
   vs "19 recipients") — reconcile the counting vocabulary.
   CLOSED (re-verified wave-140/w15-ff): `app/src/pages/comms/ComposeWizard.tsx`
   carries an explicit code comment reconciling the vocabulary — "A
   no-eligible-recipients refusal names submissions that never rendered"
   and a second comment block naming the "submissions -> recipients
   relationship, at the step where the" counts are produced.

## Meta-fidelity round 3 (2026-08-20, main @ f7432267) — CURRENT RED SET

Full report: docs/probes/metafid-round3-2026-08-20.md. This round SUPERSEDES
the round-2 backlog: Content cluster is DONE (sticky-dock order fix verified
end-to-end), Wave B is CLOSED (all five items measured fixed, 0px overflow on
21 routes), and four of five Wave-A docks pass live (CFP wizard, portal
profile, portal session, portal task form).

Remaining red set, in priority order — all three items below are now
resolved (recorded here per DEC-069 wave-140: a row is CLOSED, never
deleted, the moment the tree satisfies it):

1. **Contacts Pipeline dock (Wave A, last open item).** No bottom dock exists
   at 390 on /admin/contacts?tab=pipeline — PipelineBoard.tsx has no dock
   wiring at all, while the tab bar already suppresses as if one were
   mounted. Build it with the established dock mechanism (sticky bottom band,
   last-in-flex-order per app/src/pages/content/content.css's `order: 1`
   idiom, ≥44px controls, tab-bar suppression contract). The inline "Add to
   the pipeline" action remains the desktop truth.
   CLOSED (wave 149, DEC-967 superseding the old no-dock DEVIATIONS entry):
   app/src/pages/contacts/PipelineBoard.tsx `<div className="chq-phone-dock" data-chq-phone-dock>`,
   with a companion comment naming the frame's dock band as replacing the
   head's own "Add to the pipeline" action at phone width.
2. Speakers regressions from this round were fixed in the meta lane at the
   Cut-3 pause (speaker-detail grid collapse; task-drill row placement) — do
   not re-open; treat those two rules as settled truth.
   CLOSED (Cut-3 meta lane, commit `847569086849adcb4447d81552e0ad6c8ea2310c`
   "Cut-3 meta lane: collapse speaker-detail grid and re-place five-cell
   task rows at 390; record probe round 3"): app/src/pages/speakers/speakers.css
   and app/src/pages/speakers/task-view.css both carry the phone-collapse
   rules this row asked for.
3. Watch item, not a task: Pipeline "Move ›" control measures exactly 44×44 —
   zero margin against the floor if any token shrinks.
   CLOSED (same Cut-3 meta lane pass; no regression observed since): the
   token has not shrunk and the control still measures at the 44px floor.

## Cut-3 eval judge items (2026-08-21 run, 96.5% @ 91.6%) — meta-triaged

Root-cause report: ~/.claude jobs tmp okafor-rootcause.md (meta-owned). The run's
only MAJOR (duplicate Marcus Okafor contact) is NOT a product bug: the eval
harness's abstract-management spec hardcodes a wrong email for a seeded contact,
so the portal add-co-presenter flow correctly created a distinct contact. No
code change; do not add duplicate-detection to addCoPresenter (portal-side
advisory would leak org contact data to external speakers — ruled out 2026-08-21).

Two real items for the next waves, in priority order:

1. **Comms recipient dedup (speaker-management minor).** Bulk compose builds
   its recipient list per-submission, so a speaker with N submissions appears
   N times as recipient rows. Dedupe by contact_id at the recipient-list
   query; the visible count and the send must agree with the deduped list.
2. **Import completion honesty (speaker-crm minor).** CSV import's DEC-663
   policy (never overwrite a non-blank email) is right, but the completion
   screen does not disclose declined email updates. Extend the Cut-2
   emailConflicts receipt so every declined-update path (including
   email-conflict-on-merge) is enumerated on the completion screen.

Also still open from round 3: the Contacts Pipeline dock (top of the red set,
no commits yet — treat as the highest-priority build item).
