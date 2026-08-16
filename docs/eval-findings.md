# Eval findings — rebased 2026-08-16 (wave 74, task-w74-e)

Verified against `main`/HEAD `ba170df7` ("scribe wave 74"), MEASURED_SHA
`ba170df7`, derived AT THIS TASK'S OWN RUNTIME (DEC-069 wave-17/wave-37,
DEC-358 rebase rule; this is a DOCS-ONLY lane of a wave-74 CODE wave —
no gate ran, no `docs/verification-log/index/` section filed, per
DEC-069). This wave is a MANDATE HYGIENE task only: it records the
rebuilt IN FLIGHT census and a set of DO-NOT-CHASE rulings (see the new
`docs/eval-findings/15-wave74-receipts.md`); it does not re-derive TIER
0-2 in full and does not re-run the wave-57 GATE-9/GATE-10 falsifying
checks (those sections below are carried unchanged from their own
last-stated runtime).

COMPACTION per DEC-358's rebase rule: the wave-62 header (pinned to
`80a3eac3`, twelve waves stale) is REPLACED by this one. The wave-67
mandate-hygiene pass block that previously sat here (`task-w67-h`, its
seven wave-67 branch scopes and the nine wave-66 OFF-LIMITS names) is
PRUNED — every one of those branches is now an ancestor of `main`
(confirmed via `git merge-base --is-ancestor` at this task's own
runtime) and the scopes they named have long since landed or been
superseded by later waves' own findings. No per-item citation below
this header is deleted; the full TIER 0-2 body, and the GATE-8/9/10
sections, were not re-derived this wave (out of this task's scope) and
are carried unchanged — treat their own file:line citations as of
THEIR last stated runtime, not this one's.

## Recent review-lens findings — re-derived wave 57 (task-w57-e, at MEASURED_SHA `50c3fcc4`)

Four items a reviewer re-filed as open; each re-run directly against the
live tree this task, not inherited from a prior wave's claim:

- **Evaluations CSV export excludes unsubmitted drafts** — CLOSED, read
  directly at `src/server/repo/exports/evaluations.ts:11,156`: imports
  `submittedEvaluationCondition` from `../review/evaluations` and pushes
  it into the query's `conditions` array, same predicate `/plans/:id/
  results` uses (DEC-873).
- **Embed `fields`/`accent` carry** — CLOSED, read directly:
  `src/routes/public/sessions.tsx:203` calls `embedKnobQuery("sessions",
  { fields: activeFieldNames, accent })`; `src/routes/public/
  speakers.tsx:215,303` and `src/routes/public/agenda.tsx:379` call it
  with `{ accent }` only. This is NOT a partial fix — `EMBED_KNOB_TABLE`
  in `src/lib/embed-knobs.ts:41-56` declares `fields` for the `sessions`
  surface only; speakers/gallery/agenda never declared it, so their
  links correctly omit it.
- **Anonymous draft `__trackIds` cap** — CLOSED, read directly:
  `src/routes/public/submit-draft.tsx:74-83` refuses (400, re-rendering
  the form) any `selectedTrackIds` array longer than
  `MAX_SUBMISSION_TRACK_IDS` or containing an entry longer than
  `MAX_TEXT_LENGTH`, before the value ever reaches `saveDraft`'s KV
  write at `:176`. (Membership-against-offered-tracks is deliberately
  still not checked — task-w49-h's ruling, unchanged.)
- **CFP `.zip` accept-vs-hint disagreement** — CLOSED, read directly:
  `src/domain/files.ts:124` (`CFP_FILE_FIELD_KIND`) is the single
  constant both consumers in `src/views/form-render.tsx:124`
  (`accept={...}`) and `:168` (`uploadHintText(...)`) derive from — one
  source, cannot drift.

## V12 DESIGN INTAKE (2026-08-16 morning) — authority now design-frames-v12 (158 frames; 13 sections incl. NEW 13-docs)

Vendored: NEW `Chautauqua Docs.dc.html` + changed Review + DESIGN-RULINGS + README
(all other files byte-identical to v11). verify-frames receipt: 13 sections / 158
frames, all width flags the known +2px border class. Two additions, both USER-
COMMISSIONED features — sequenced AFTER the ALL-PASS lane below:

**A. REVIEW CRITERIA — Scale or Choice (in-place edits to the 03 frames + new
DESIGN-RULINGS §"Review criteria — Scale or Choice"; build to the ruling, it is
complete and opinionated):**
- Criterion gains a TYPE at creation: Scale 1-5 (default, today's behavior) or
  Choice (2-6 organiser-defined options).
- Editor: FieldModal's type-select grammar but options as EDITABLE ROWS (⋮⋮ ·
  label · Remove), "3 of 6" counter, Add-an-option tertiary, Remove DISABLED at
  two (bound in the control, not prose). Deliberate divergence from the CFP
  textarea — one-way, documented in the ruling.
- **Aggregation: Choice is UNWEIGHTED and EXCLUDED from the numeric mean.**
  Results show a distribution ("Strong 2 · Weak 1") in the per-criterion
  breakdown; weighted mean covers Scale criteria only.
- Weight input DISAPPEARS for Choice (not zeroed/disabled). Shares recompute
  over Scale criteria alone. Scorecard overall states its denominator ("Weighted
  mean of the two scored criteria · Fit is recorded, not averaged").
- Scorecard: Choice = STACKED radio row of options, same fieldset/legend + 44px
  contract. Results expanded band: each reviewer's pick as text under the
  criterion, distribution in the footer, band repeats the parent grid per B8.
- Type IMMUTABLE once any evaluation exists (same freeze rule; frozen caption
  now "wording, type and weights fixed for this wave"); options editable until
  freeze. Existing plans untouched (typeless criterion = Scale — no migration).
- REGRESSION SENSITIVITY: this touches scoring/aggregation paths that scored
  91-100 on the interim run — every change needs route tests + the gate-12
  fleet re-verifies scorecard/results geometry + a results-math test (shares
  60/40 not 50/33 with a Choice present). USER RULING: the feature SHIPS in the
  final build — no hold-out. If gate-12 finds it wobbly, FIX FORWARD (>12h of
  runway remain); do not park it.

**B. DOCS SITE (NEW ROUTE /docs — frames 13-docs--00..04 + DESIGN-RULINGS
§"Docs — a new site, and where it stops"). Purpose: submission documentation,
following the eval's main lines, screenshots from the FROZEN app:**
- New user-facing site; current src/routes/docs.tsx serves ONLY /docs/api which
  STAYS TOOLS_CSS chrome (DEC-382 not revised) — the API reference renders as a
  labelled LEAVING LINK ("Leaves the docs — an operator surface", ↗ muted).
- IA grouped BY ROLE, not by screen: Getting started / Running an event / Your
  contacts / For reviewers / For speakers / Running the software.
- Measures: prose 680, screenshots 900 (the ONE sanctioned measure break);
  phone: figures edge-to-edge, caption inset. Frames: index (1600), article
  (1600/640/390), element library (1600).
- CONTENT: follow the eval's main lines — one article per area family (CFP +
  submissions; review; speakers + tasks + content; agenda + publish; contacts +
  pipeline + comms; embeds + public pages; running the software = deploy/seed/
  auth). Write from the product as it IS (frozen build), house voice, captions
  carry the point.
- **SCREENSHOT RULES (verbatim contract, build the shoot as a SCRIPT):** real
  app at 1600×900 · seeded data only (DevFlow Conf 2027) · full frames not
  crops · caption carries the point · NO drawn annotations · re-shoot every
  release. The shoot runs against the FROZEN deployed build at freeze time —
  docs SHELL + articles can build now with placeholder figure slots; the
  screenshot script fills them at freeze.

**SEQUENCING (user): ALL-PASS lane items 1-22 FIRST → then A + B-shell in
parallel → gate-12 fleet (all-PASS target, now including 03 criterion frames +
13-docs shell) → FREEZE → scripted screenshot shoot + docs content finalize →
final deploy (carries docs) → final official eval run → submission held for user.**


## ALL-PASS PUSH (USER DIRECTIVE 2026-08-16 morning) — fix EVERY remaining MINOR/BROKEN before the next fidelity fleet; the goal is a fleet verdict as close to all-PASS as possible. THIS LANE PRE-EMPTS ALL OTHER WORK. Freeze + final eval run follow the fleet.

**A. FIDELITY residue (gate-10/11 + delta-6 still-open set):**
1. §09 settings residue M1/M2/M4/M5/M7/R2 — field widths beyond dates, footer
   grammar, portal toggles, embed card anatomy (measures in fidelity-gate10/
   group3.md + gate11/group3.md).
2. New-contact modal to frame 08--16: email carries WHY required (matched/merged),
   modal closes by naming what it does NOT do (directory ≠ event).
3. FieldModal residue: dialog title per frame (not "Edit field"), operator tokens
   read as words (not raw eq/ne/in), card width 520 → 560.
4. **RESOLVED by design agent (wave-78): 732/756 are CONTENT boxes inside the
   standard 820 container** — the frames pad internally (820−2×44=732 home;
   820−2×32=756 builder). The frames are NOT aberrant and the measure does NOT
   change. THE REAL FIX: keep HOME_MEASURE/container at 820 and add the frame's
   internal horizontal padding so the CONTENT box lands at 732 (home hub) and
   756 (CFP builder reading column). Closure evidence = content-box width, not
   container width.
5. **FLEET METHOD RULE (add to every future audit brief): compare LIKE boxes** —
   a frame scan yields the CONTENT box; measure the app's content box (text run),
   not its declared container, before calling a deviation. The 820-vs-732 and
   820-vs-756 "reopens" at gates 9-11 were this artifact.
6. Home CTA dark-on-dark hover: .chq-home-action-primary must keep its on-brand
   label on hover (add .chq-btn or scope theme.ts a:hover away from it). VERIFY
   with computed style — this was still live at gate-11.
7. Status-cell hover ring: v11 literal is an OUTSET 0 0 0 2px #CFC7B7 — align
   (currently inset per DEC-383); update the DEC.
8. Breaks editor: add the frame's Done control; drop the extra Location row
   (frame 06--02 has label/start/minutes three-up only).
9. Settings deep-link ?section=<x>&edit=1 must arrive EDITING (resources currently
   read-only until Change clicked).
10. API-tokens row in Your data EDIT view (revoke currently unreachable there) —
    VERIFY gate-11 filing landed; fix if not.
11. "Import 1 rows" plural — verify the shared plural helper reached it.

**B. EVAL-run minors (product-actionable set from the 93.8 run):**
12. Seed: synth generator reuses the fixture title "Your AI Pair Programmer Is
    Lying to You…" minting the SES-002/SES-032 identical-title conflicting-status
    pair — make synth titles unique (contaminated 3 areas, 3 runs straight).
13. Seed: Sam Whitfield's two seeded reviews carry byte-identical comment text —
    vary seeded evaluation comments.
14. Seed: reviewer assignments overlap broadly (Sam track-wide on 3 plans) —
    narrow to distinct, non-overlapping seeded scopes.
15. Deadline day-boundary: close saved 30 Apr 23:59 renders "CLOSES THU 29 APR"
    on the hub — every countdown/day label must resolve in the EVENT timezone.
16. Saved-embed accent: builder saves #2563eb but /embed/e/<id> renders no accent
    — saved-embed.tsx:143 passes accentOverride; find where EmbedShell drops it,
    fix, and render-test a non-default accent end-to-end.
17. Tracks-and-rooms add: success + simultaneous "ONE THING NEEDS ATTENTION"
    banner (DEC-856 w76 plausibly fixed this — VERIFY with a click-through, close
    with evidence).
18. Pipeline DECLINED column: first card renders TWO fit badges + TWO rationale
    paragraphs under one name (card bleed/merge — likely a render-key or
    grouping bug; screenshot in runs/2026-08-16T06-09-31 CRM evidence).
19. Public CFP form: add an in-page error summary + per-field messages on submit
    (currently native browser bubbles only; portal/admin forms already have the
    pattern — reuse it).
20. Version history v1/v2 identical minute timestamps — VERIFY DEC-158 w77's
    seconds grammar covers portal file-version rows; fix if not.
21. Contacts/Speakers initial load: skeleton shows with no accessible label —
    add the aria-live "Loading" status to PageSkeleton per the v11 first-paint
    spec's a11y intent.
22. Organizer add-co-presenter flow: state the email difference explicitly
    ("sends a portal invite" vs portal's "No email goes to them") — copy-only,
    one sentence.

**Out of scope for this lane (roadmap, judge feature-asks):** scorecard criterion
field types (dropdown/Accept-Maybe-Reject custom criteria) · account-linked
cross-device CFP drafts · bulk-export grouping by session/type. Do NOT build
these before the deadline.

Closures need measured evidence as always. When this lane is dry: gate-12 fleet
(all-PASS target) → freeze → final deploy → final official run.


## DELTA-PROBE 6 (waves 64-72 churn; chautauqua-research/fidelity-delta6/report.md; sha b85dffb1, integrity CLEAN)

**10/10 WORKS, zero BROKEN.** Measured closures to PRUNE: 1b import disposition
(merge PATCHes updated:1 / import-as-new creates — judge-critical, click-verified) ·
search submit real 40x40 on-viewport button, pointer-click submits both surfaces ·
invite dialog = real ModalFrame with DEC-238 receipt vocabulary (no "unknown") ·
people grid headers/data exact-aligned 310/534/722 · breaks flagged band = dashed
differential + suffix (wave-66 ruling; "greyed" superseded) · comms expansion heads
+ real template names + 1 caption · overview B8 property-scoped 0.12s with real
hover deltas · drawer footer inside 1440 AND 1600 · remind receipt "Sent: 2.
Skipped: 0. Remaining: 0." · FieldModal far-left Delete + sentence · portal preview
Back link 200 · role-blocked bounce states why. NOTE for wave hygiene: no
user-DELETE path exists (users API = GET/POST/reset) — fine for product, but probe
reverts need D1; not a defect.


## INTERIM RUN 2026-08-16T06-09 — **93.8 @ 93.5% coverage, NEW BEST** (was 90.3; matches the 140-turn diagnostic's predicted ceiling exactly). LOSS-MINE + FINAL-FREEZE LANE

Per-area: AIA 100 · EMB 100 · CRM 94.4 · CFP 93.5 · ABS 91.1 · CNT 90.7 · SPK 88.7.
**Cluster verdicts by the judges themselves:** push-to-event defect GONE · task
targeting "created for all N" GONE · bulk-send count mismatch GONE · headshot
rectangles GONE. The correctness campaign converted directly into score.

**FINAL-FREEZE LANE (highest value first; final full run fires after these):**
1. ~~Cluster 1b~~ **CORRECTION (orchestrator, wave-68 review): 1b IS BUILT** —
   DEC-663 wave-64 amendment landed HOURS AFTER the interim run's deploy
   snapshot (6719a2dc): findImportDuplicateCandidates (last-name candidates,
   chunked), mergeLines disposition through resolveImportUpsert, and the
   wizard's per-row 'Import as new'/'Merge into <candidate>' radio group.
   11/11 import merge+plan tests green at current main. The judge's SPK major
   was measured against the PRE-wave-64 build. REMAINING: runtime click-verify
   at the final-freeze probe (wizard step 2 shows the disposition for a
   same-name-different-email row; merge path patches, not creates).
2. ~~Auto-schedule un-flagged double-bookings~~ **RESOLVED BY ANALYSIS
   (orchestrator, wave-71): NO ENGINE BUG.** The invite-status hypothesis is
   REFUTED: pushContactsToEvent mints inviteStatus='none' (push.ts:80), which is
   IN SCHEDULING_PARTICIPANT_STATUSES (acceptance.ts:148), and both the placer
   (domain/schedule.ts speakerIndex + speaker_double_booked reason) and the
   renderer (rows.ts:216, DEC-974 — in the interim build) see those speakers.
   The judge's "double-booked Priya" was TWO DIFFERENT CONTACT ROWS (seed Priya
   vs the CSV-minted alternate-email Priya) — the engine correctly keys by
   contactId; distinct rows are not provably one person. Root cause IS cluster
   1b (now built: pre-import disposition w64) + vestigial near-dup seeds (now
   removed, DEC-823 w70). NO further fix; do NOT invent a same-name soft-clash
   heuristic without a design frame. Expect this major to vanish on the final
   run via the 1b warning + cleaned seeds.
3. **Public search submit "fix" is WRONG**: the off-screen 1x1 button defeats
   real pointer clicks (judge's Playwright click timed out AGAIN; only Enter
   works). An offscreen submit is worse than an overlapped one — make the
   button visibly clickable (or make the magnifier icon the submit control).
4. **Contact drawer clipped at right edge** (2 areas, both runs' screenshots):
   Save button + helper text cut off at viewport edge — regression from recent
   drawer work; measure at 1440 AND 1600.
5. **Embed accent color not applied in rendered embed** (EMB minor): builder
   saves #2563eb, /embed/e/<id> renders no accent. Wire the knob through.
6. **Track-add confusing validation state** (AIA minor): success + simultaneous
   "ONE THING NEEDS" error box on tracks-and-rooms panel.
7. **SEED HYGIENE (cheap, contaminated 3 areas AGAIN — do in seed.ts):**
   (a) SES-002/SES-032 identical-title conflicting-status pair — make statuses
   coherent or retitle (P3 #30, still unaddressed);
   (b) seeded duplicate contact rows (two Priya, two Marcus, PARKER/Parker) are
   INTENTIONAL CRM-dedup fixtures — but they bleed into ABS/CNT/SPK judgments;
   consider moving the dupes to a dedicated fixture pair NOT sharing names with
   the hero speakers;
   (c) seeded reviewer assignments overlap broadly (Sam track-wide on 3 plans) —
   judges read it as noise; narrow the seed assignments.
8. Speaker-blocked admin routes: silent redirect to /portal — add an access
   message (CNT minor, both runs).
9. Version history v1/v2 identical minute-granular timestamps (CNT) — same
   seconds-precision fix as history entries (gate-8 P3 #22 family).
10. Portal vs organizer co-presenter email asymmetry (ABS minor): portal add
    sends nothing (honest line), organizer add sends portal invite — judges read
    the asymmetry as a gap; consider offering the invite send on portal add too
    OR stating the difference in the organizer flow.

**NON-ACTIONABLE (recorded so nobody chases):** SBEK-PORTAL-BIO-01 is the eval's
OWN marker — SPK-S2 writes it into Priya's bio via the portal mid-run, then EMB
judges flag it as residue; it is not in our seeds (grep confirms). Reseed clears
it between runs; unavoidable within a run. · ABS "scorecard editor numeric-only"
major asks for configurable field TYPES (dropdown recommendations) — a real
feature, out of scope for the final hours; noted as roadmap, not a freeze item.
· turn-cap cannot_judge items unchanged (CFP-04/16/18, CNT-10/14, CRM-11).
· "12 of 19 placed are public, 7 held back" banner LANDED and now says exactly
that (AIA minor is the judge disliking the policy, not a silent withhold — the
withholding-list detail in gate-10 lane item 19 remains nice-to-have).

**Eval budget: spend ≈$490 of $650 after this run. Final full run reserved.**


## GATE-11 SWEEP VERDICTS (fidelity-gate11/group{1,2,3}.md; DEPLOYED sha 6719a2dc, hotfix8 9b18f7ff on top; integrity CLEAN all three)

**Scoreboard: 21 CONFIRMED CLOSED / 2 reopens (both HOTFIXED same hour) / handful of
new smalls.** Every overnight closure claim was independently measured; zero eval-hack
drift found. Confirmed closed and PRUNED from open lists: saved-view delete E2E ·
scorecard gutter 60px + real fieldsets · DEC-354 advisory · DEC-596 assigned-reviewer
denominator · out-of-queue named refusal · DEC-892/158 history diff + working Restore
(identical-restore 400) · DEC-760 both scopes both surfaces · /plans/:id/progress
measure (DEC-989, unexpectedly closed) · DEC-746 subset targeting (2-of-2 assignments
measured) · P3#21 column collapse · DEC-936 rollup ("Mixed" + per-submission detail) ·
DEC-899 server placed% · DEC-701 occupied-slot click lands+flags · DEC-238 preview==
send==history ("14 sent" consistent) · Sessionboard step-2 (hand-map imports fine) ·
embed Turn-off confirm+blast radius · DEC-290 opt-in (no eventId in body) · DEC-829 ·
co-presenter widths 256/256/322 · DEC-151 back-carry · designed disabled-embed blank ·
search submit fixed · reset-password facts + Copy + 20px mono · TYPE-THE-NAME confirm
weight (case-insensitive gate) · invite flow verb/chips/Copy/last-time line · M10-1
co-presenter Remove confirms · M08-2 leaked string gone. B8 tokens: SSR buttons +
SPA .chq-btn/input family CONFIRMED at 120ms property-scoped with reduced-motion 0ms.

**ORCHESTRATOR HOTFIX8 (9b18f7ff, deployed 21e5f4db):** DEC-902 header grid var moved
to the role=table wrapper (header was a SIBLING outside .chq-settings-people-list —
undefined var, labels stacked vertically, visibly worse than pre-fix) · portal-preview
Back link /admin prefix (bare /settings 404s live; test pin updated to working path).

**SWARM LANE — new smalls from the sweep (all need measured closure):**
1. Remind result line renders literal "Skipped: unknown." — remind envelope has
   failed[] but no skipped count; client prints "unknown". Either count skips in the
   envelope or render only what exists. (group1)
2. Comms batch history row: TEMPLATE cell renders "—" after a template-based send
   (NEW regression) + row omits the skipped count DEC-238 standardized. (group2)
3. API-tokens row MISSING from Your data edit view — revoke unreachable there (NEW,
   group3). Deep-linked ?section=portal&edit=1 shows resources read-only until
   Change clicked (group3). "Import 1 rows" plural (group3).
   **"Import 1 rows" plural — CLOSED wave 67 (task-w67-h, `main` `123f8ab2`,
   this task's own runtime).** Every cited site
   (`app/src/pages/contacts/ImportWizard.tsx:138,488,525`) renders through
   `countOf` (`src/domain/count-copy.ts:20-22`, re-exported for the SPA at
   `app/src/lib/plural.ts:5`), which pluralizes; no site hand-composes the
   phrase. Do not re-file. (The other three items in this row — API-tokens
   row missing, deep-linked resources read-only — remain open, untouched by
   this task.)
4. Breaks flagged band: class + suffix land but bg/label BYTE-IDENTICAL to normal
   bands — the grey treatment never renders (group2). Plus no Done control, extra
   Location row vs frame 06--02.
5. Photo/Headshot deliverable kind STILL OPEN (FILE_KINDS files.ts:15) — P3 #20.
6. 07 history expansion band still open (RECIPIENT/RESULT heads, refs); col heads +
   right-flushed search CLOSED, caption 3x→2x (finish to 1x).
7. FieldModal residue: title "Edit field" vs frame, raw eq/ne/in operator tokens,
   footer Save+Cancel only (no far-left Delete), width 520 vs 560. (group1)
8. Dark-on-dark CTA hover PRECISED: a:hover was narrowed to :not(.chq-btn) but
   .chq-home-action-primary lacks .chq-btn — add the class or scope the selector.
   12-home 820-vs-732 + CFP 820-vs-756 rulings STILL unfiled. Overview button
   family + nav links still transition-less (B8 gap); overview primary no hover bg.
9. STILL OPEN unchanged: §09 M1/M2/M4/M5/M7/R2 · new-contact modal vs 08--16 ·
   invite still inline (dialog form factor).


## GATE-10 SWEEP VERDICTS (fidelity-gate10/group{1,2,3}.md; snapshot d3c0c518, isolated servers 8894-6, integrity CLEAN all three)

**Verdicts: 2 PASS (04, 11) · 3 MINOR (01, 05→08, 10) · 5 MAJOR (02, 03, 06, 07, 09)
· 1 BROKEN (saved views).** Method validated to the decimal against gate-9 numbers.

**P0 BROKEN (functional, found by click-through):**
- **Saved views can NEVER be deleted**: `ViewTabs.tsx:218` — `pendingDelete` is only
  ever set to null, so the delete affordance never arms; DELETE /api/v1/views/:id and
  its ConfirmDialog are DEAD CODE. Wire the trigger; render-test that the confirm
  opens; this is also a DEC-941-class miss the new scan must catch (dead confirm ≠
  present confirm).
- **Sessionboard import step-2 trap**: mapping UI omits `externalId`
  (SessionboardImportPanel.tsx:47) while the server REQUIRES it and only auto-maps
  when the mapping is EMPTY (import.ts:91) — hand-mapping ANY column guarantees
  "Missing external id (Record ID)" + 0 rows imported. Verified both ways live. Add
  externalId to the mapping choices (or always-auto-map it) + a test importing WITH a
  hand-set mapping.

**REOPENS (measured on d3c0c518; check post-snapshot commits before re-fixing):**
1. ~~Scorecard rail gutter 36 vs 60~~ — swarm commit 2304bbd6 (DEC-939 w57) landed
   AFTER the snapshot; main now reads gap:60px. VERIFY at gate-11, else closed.
2. `/plans/:id/progress` STILL no measure (x=34 w=1532, ProgressPanel.tsx:118).
   **CLOSED-WITH-RECEIPT wave 62 (task-w62-j, `main` `80a3eac3`):**
   `app/src/pages/review/ProgressPanel.tsx` now carries the `chq-measure`
   token on both the loading branch (`className="chq-page chq-review-page
   chq-measure"`, `:122`) and the loaded, non-embedded wrapper
   (`wrapperProps` at `:133`, same class string, comment at `:131` names the
   820px token explicitly). No unclamped 1532px root remains on this
   component. This wave did not re-run a render measurement (docs-only, no
   gate per DEC-069) — the class is present in source; a future lane should
   confirm the rendered width before restating this row PASS in a gate
   verdict.
3. 12-home HOME_MEASURE still 820 (home.css.ts:21) vs frames 732@434 — needs the
   ruling the gate-9 lane asked for; PLUS new: theme.ts:172 `a:hover` paints the
   "Submit a talk" primary's LABEL #3C471F on the #4E5C31 fill = dark-on-dark hover
   (a v11 tier violation: hovered primary must darken the FILL, label stays on-brand).
4. 07 history tab: ALL THREE clauses still absent (0 column heads, 0 filter chips,
   search own-row x=80 w=820 vs right-flushed chip row) + caption triplicated.
5. 09 people HEADER row kept `1fr 170px 190px auto` (settings.css:414) while the data
   rows moved to `minmax(0,1fr) 170 190 200` — header labels sit ~200px off their
   columns (Role@x814 over rows' scope@x802). Finish the fix orchestrator started.
6. Portal co-presenter inputs at intrinsic 188.2px (unclassed, portal edit.tsx:318) —
   the R-A bare-page fix never reached the portal form; class them.
7. §09 residue M1/M2/M4/M5/M6/M7/R1/R2 reproduce unchanged (field widths, footer
   grammar, portal toggles, embed card anatomy — see group3.md for measures).

**V11 BASELINE (quantified gaps, ordered by lane priority):**
- **Transitions: literally zero** — every element on every audited surface computes
  `transition: all 0s`; secondary buttons + comms rows + overview controls have NO
  hover state at all; where hover exists the COLORS already match B8 (#EFEBDF rows,
  #3C471F primary). So lane item (1) is purely additive tokens — low regression risk.
- **ConfirmDialog**: one weight, no type-the-name anywhere (embed/resource/contact
  deletes all render inputs:0); worse, THREE destructive actions fire with NO confirm:
  embed "Turn off", tracks "Remove", admin co-presenter "Remove".
  **PARTIAL CLOSED-WITH-RECEIPT wave 62 (task-w62-j, `main` `80a3eac3`):**
  two of the three now open `ConfirmDialog` — tracks/rooms Remove
  (`app/src/pages/settings/TracksRoomsPanel.tsx:790`, DEC-941 comment at
  `:128`, `ConfirmDialog` rendered at `:790` with `confirmLabel="Remove"`)
  and the admin co-presenter Remove
  (`app/src/pages/submissions/SubmissionDetailPage.tsx:1849`, DEC-941
  comment at `:367`, `ConfirmDialog` rendered at `:1849` with
  `confirmLabel="Remove participant"`). The embed "Turn off" site is
  UNTOUCHED by this receipt — stays open, do not mark closed.
- **Invite flow vs 09--18/19/20**: inline strip not a dialog; primary "Send invite"
  (must be "Create the account"); reveal 12px mono, no Copy, no last-time line; 409
  lacks "Open <name>'s row". Reset (09--24) omits both facts though the server DOES
  end sessions and skip email — copy-only fix.
- **FieldModal (02)**: works but ~6 v11 frame items short (group1.md list); saved-view
  delete BROKEN above sits on the same surface.
- **Breaks modal vs 06--02**: title "Breaks" not "Breaks on <day>"; BOTH mandated copy
  lines missing; out-of-window break clamps at full opacity (frame: kept-but-flagged
  grey); 2×2 add grid vs frame's 3-up 270/108/94; rows concatenate time-first.
- **ProgressPanel scopes**: both exist + DEC-760 hidden-when-zero VERIFIED live, but
  "Remind laggards (N)" renders only on the standalone page (!embedded,
  ProgressPanel.tsx:150) — the two scopes never share a surface as the frame requires.
- **/portal/preview**: exists but lacks Not-shown-here chips, Back-to-settings, and
  Download-disabled resource rows.
- **New interaction bug**: armed click-to-place cannot land on an OCCUPIED agenda slot
  by mouse (the card intercepts the pointer; keyboard + drag both work) — v11 drag
  spec says occupied targets accept and flag the clash.

**RULINGS NEEDED (file in DESIGN-RULINGS or design-standard-brief):**
- Status-cell hover ring renders INSET (DEC-383) vs v11's literal outset shadow —
  pick one.
- CFP builder content 820@390 vs frame 756@422 (−64 residue after the measure-class
  fix) — align or rule.

**CONFIRMED CLOSED (measured; prune from open lists):** results cols 210/190 · files
26px scoping + 900/190/108/92/150 · worklist 28/710/168/200/152/182 · detail pair
1.35:1 · compose step-2 blank arrival + at-control merge-field 400 + per-recipient
banner · plan-editor per-field 400s · auth inputs 780×48 + h1 28px (painted ink
222.0 = frame) · people-row DATA grid + guard dedupe · contacts drawer sticky bar ·
overview Open alignment · co-presenter add/remove loop incl. lead-protection 400 ·
DEC-760 hidden-not-disabled · 11--07 reset frame verified LIVE frame-exact.

SWARM: P0 BROKEN items first, then reopens 2-7, then v11 baseline order. Closures
against design-frames-v11 with measures.


## PROD-LIKE LOAD TEST (2026-08-16 overnight; chautauqua-perf worker on REAL D1, 2,030 submissions / 202k rows; full report chautauqua-research/perf-remote/report.md)

Public surface: ALL PASS with margin at 2k scale (15-98ms adjusted vs 150ms).
No errors, no timeouts, no unbounded growth anywhere. Root cause of everything
slow: worker→D1 round-trip amplification (~10-30ms per query over the wire vs
~0.1ms locally) — CONFIRMED against prod itself read-only: event overview ~192ms
median at only 30 submissions, so latency is ROUND-TRIP-COUNT-driven, not
scale-driven. Local perfbox numbers hid this entirely.

**P1-PERF (judge/user-visible high-frequency writes, stable across cold+warm
runs — audit each route's sequential query chain; batch write-side effects with
db.batch, parallelize validation reads):**
- submission PATCH (description edit): **~533ms adjusted** (every field save)
- schedule slot PUT: **~450ms** (every agenda drag/tap placement, agenda.ts:47)
- rating PUT: **~200ms** (every scorecard score click)
- task assignment check-off: **~140ms**

**P2-PERF (multi-query authed reads 95-353ms; wave-batch like overview.ts's
DEC-370 Promise.all pattern — overview itself is already batched and bounded
by per-wave RTT + session-auth queries):** reviewer queue (~155) · plan progress
(~160-167) · plan results (~100-135) · portal home (~107-121) / portal submission
detail (~107-353, high variance) · onboarding grid 800×5 (~142-225) · files
library (~117-145) · event overview (~250-262).

**P3-PERF (informational, do NOT burn lanes):** bulk status 1000 ids ~890ms and
schedule.ics 150 ids ~450ms are API extremes — the SPA sends ≤1 page of ids and
.ics is capped at 300; the bulk path is ALREADY set-based+chunked (ID_CHUNK_SIZE
~90; cost = chunk-count × RTT, not N+1). The 50/100ms budgets are LOCAL-calibrated;
remote runs need a separate budget profile rather than "fixes" to meet local
numbers. PUBLIC_BASE_URL is load-bearing on deployed origins (resolveBaseUrl
fails loudly; bulk-email 500s without it) — now on the deploy parity checklist.

Perf env kept alive for post-fix re-verification (config: g10base/wrangler.perf.jsonc).
NO-REGRESSION RULE applies: perf fixes must not change route semantics; every
P1-perf closure needs a before/after measurement on the perf env AND green route
tests.


## GATE-8 LOSS-MINE, ITEMIZED (runs 2026-08-15T07-46 [89.0] + T13-02 [90.3 final], both vs prod) — CORRECTNESS LANE

Every major-severity judge defect across BOTH runs traces to four clusters. These are
real-organizer correctness bugs (user directive: fidelity + correctness focus); fixing
them is justified on product grounds alone. Evidence: `killmysaas-evals/runs/<ts>/
report.json` → areas[].defects + items[].

**P1 CLUSTERS (all four produced MAJOR defects). STATUS wave-67: 1a/1b/2/3/4 ALL
LANDED (DEC-290 opt-in attach, DEC-663 dedup-blindness, DEC-829 roster
visibility, DEC-746 subset picker, DEC-238 shared dedupe plan) — no P1 remnant
survives; the "THREE WAVES UNCLAIMED, TOP PRIORITY" banner this section
carried is PRUNED (DEC-358 wave-67 amendment — the banner was a claim about a
stale snapshot, not about main):**
1. **CSV import: event coupling + dedup blindness** (hit in CRM AND SPK AND CNT — one
   cluster, three areas' judgments contaminated). (a) The wizard REQUIRES "Session
   title for this batch" and silently attaches every imported org-level contact to a
   synthetic accepted session on the current event — importing into the DIRECTORY must
   be possible with NO event side effects (event attach = explicit opt-in step).
   **Part (a) CLOSED-WITH-RECEIPT wave 62 (task-w62-j, `main` `80a3eac3`):**
   `app/src/pages/contacts/ImportWizard.tsx` now gates the event-attach body
   fields behind an explicit `attachToEvent` boolean state (declared `:108`,
   read at the submit-body spread `:382` — `...(eventId && attachToEvent ?
   { eventId, sessionTitle: sessionTitle.trim() } : {})` — and the validation/
   UI gates at `:366,465,478,664,675`), per DEC-810; importing with the
   checkbox left off carries no `eventId`/`sessionTitle` and creates no
   synthetic session.
   **Part (b) CLOSED-WITH-RECEIPT wave 67 (task-w67-h, `main` `123f8ab2`,
   this task's own runtime):** `findImportDuplicateCandidates`
   (`src/domain/contacts-parts/duplicates.ts:170`) is a name+company
   possible-duplicate matcher, consumed by BOTH the dry-run planner,
   `planImportRows` (`src/server/repo/contacts/import.ts:634,672,722` — the
   candidate set is computed and attached to each plan row so the wizard can
   surface a "possible duplicate" disposition before any write), and the
   commit path, `applyImportRows` (`:353-366` — re-derives the identical
   candidate set to validate a caller-supplied `mergeLines` entry). The route
   accepts the merge-into-vs-import-as-new disposition as
   `mergeLines: {line, contactId}[]` (`src/routes/api/contacts/import.ts:116-146`,
   DEC-663 wave-64 amendment comment at `:116`). Dedup is therefore NOT
   email-only and a pre-import possible-duplicate disposition already exists.
   (b) Dedup matches exact email only; same-name+company with a new address mints
   duplicate rows with no pre-import warning — surface a name+company match as a
   pre-import "possible duplicate" disposition (merge-into / import-as-new choice).
2. **Push-to-event success but contact not findable in target event** (CRM major,
   final run): "Add to an event" confirmed "Marcus Okafor was added as an accepted
   speaker" for DevFlow Conf 2027, then /admin/speakers in that event does NOT show
   him. Root-cause and fix; add a route test proving add-to-event → speaker roster
   visibility (and the dialog's success line should deep-link the created row).
3. **Task creation cannot target a subset**: New task ALWAYS "Created for all N
   accepted speakers" (SPK major + CNT minor, both runs). Add assignee scoping
   (all-accepted default, per-speaker multi-select). NOTE: reconcile with v11 — no
   frame covers an assignee picker; keep it inside the existing modal grammar and file
   a design-gap note in design-standard-brief.md if a frame is needed.
4. **Bulk-send reporting untrustworthy**: "Send 36 emails" → history entry "6 sent"
   listing ≥9 recipients (SPK major, final run). Root-cause the count (suspect: the
   1-hour dedupe/throttle skips are uncounted or mislabelled). The fix is the v11
   standard result line `{sent, skipped, remaining}` applied to comms history rows +
   send results — sent must mean sent.

**P2 QUICK WINS (recurring minors, independent of v11 lane):**
5. Public search submit button unclickable — `#chq-pub-search-q` input overlays it;
   reproduced on sessions AND agenda surfaces in both runs. Fix the stacking/hit area.
6. `SBEK-PORTAL-BIO-01` residue string in seed_contact_0001's public bio (seed
   hygiene — scrub the marker from seed.ts, it renders on prod).
   **CLOSED wave 67 (task-w67-h, `main` `123f8ab2`, this task's own runtime):**
   `grep -rn SBEK-PORTAL-BIO-01` under `src/` and `scripts/` returns nothing;
   the string survives only in `docs/` (this file, the findings archive, and
   the rubric that names it as a marker). Matches the standing NON-ACTIONABLE
   ruling below (SPK-S2 writes it into the bio live via the portal mid-run;
   it is not a seed value). Do not re-file as a seed-hygiene item.
7. Speaker headshots render as blank navy rectangles on public speakers list/gallery/
   detail (3 speakers with uploaded photos) — the data exists, the render path fails.
8. OFF-toggled saved embed serves a BLANK page at its permalink — render a minimal
   "This embed has been turned off" body instead of white nothing.
9. `/dev/mailbox` 404s (operator-doc'd path, tried both runs) — either mount the dev
   mailbox viewer or fix the operator docs; judges read the docs.
   **RECLASSIFIED wave 67 (task-w67-h, `main` `123f8ab2`, this task's own
   runtime): NOT A SWARM LANE.** The route exists
   (`src/routes/dev/mailbox.tsx`) and is mounted behind `guardDevMailbox`
   (`src/server/app.ts:90-103`), which 404s unless `DEV_MODE==='1'` and then
   redirects/403s by role (DEC-005/DEC-546). A judge running against a
   deployed build without `DEV_MODE` set gets the DESIGNED 404 — this is an
   operator/deploy-doc gap (the docs should say the route is dev-only), not a
   product defect. Moved out of the swarm SPARK/product list; an operator
   lane should update the deploy docs, not a code lane.
10. Agenda: stale ROOM & SPEAKER CONFLICT badge after the clash is resolved +
    header "% placed" inconsistent (84%→79% with identical counts) — recompute on
    state change.
11. Assigned reviewer's submission detail says "Reviews · 0 of 0 in" (assignment not
    reflected in the denominator until a review lands).
12. Out-of-queue reviewer gets bare "Submission not found" — keep the 404-shape but
    say "not in your queue" when the submission exists but isn't assigned.

**P2 PROMOTION (user directive 2026-08-15: ALL correctness issues get fixed —
clusters first, then everything):**
13. **History Restore has no visible effect** (CNT, final run): Restore on the
    earlier history entry was clicked and the abstract still contained the later
    edit's sentence. Either restore is broken or the UI never refetches — root-cause
    it; a control that reports nothing and changes nothing is broken either way.

**P3 — COMPLETE REMAINING CORRECTNESS SET (user directive: document + mandate ALL;
fix after P1 clusters and P2; each needs measured closure):**
14. Co-presenter identity inconsistent across views: portal shows "Marcus Okafor —
    CO-PRESENTER" while organizer submissions list + review results render the
    participant set differently — one identity rendering per person everywhere.
15. Deadline day-boundary wording: close saved as 30 Apr 2027 23:59 but the public
    hub renders "CLOSES THU 29 APR · 259 DAYS LEFT" — the countdown/day label
    crosses the timezone boundary. Align every surface on the event timezone.
16. Reviewer scope layering: assigning a narrower "One submission" scope neither
    supersedes nor warns about the reviewer's existing broader track-wide assignment
    on the same plan — the effective queue changes silently. Warn or merge scopes.
    **CLOSED wave 67 (task-w67-h, `main` `123f8ab2`, this task's own runtime),
    by DEC-354's advisory.** `src/routes/review/plans-reviewers.ts:21` (`void
    DEC_354; // POST /plans/:id/reviewers (amendment, wave 61): scopeAdvisory
    computed below -- never a refusal, never a silent supersede`) and `:66`
    ("broader one is an advisory, never a silent supersede and never a
    refusal") — the layering is neither silent nor a supersede; it is a
    named advisory by design. Do not re-file.
17. Reviewer progress header "Round 1 of 1" while the event has six plans — the
    denominator is wrong or the copy claims a rounds model that doesn't exist.
    **CLOSED wave 67 (task-w67-h, `main` `123f8ab2`, this task's own
    runtime).** Every surface routes the round label through one function,
    `roundLabel` (`src/domain/evaluation/criteria.ts:362`), consumed by
    `app/src/pages/review/ReviewerQueue.tsx:530` and
    `app/src/pages/review/Scorecard.tsx:427` — one source, cannot drift; no
    surface hand-composes "Round N of M". Do not re-file.
18. Scorecard a11y: the two numeric 1-5 criteria rows are exposed near-identically
    and the accessibility tree DEDUPES them into one set — give each criterion a
    distinct accessible group/name (fieldset/legend or labelled radiogroup).
19. Publish-flow withholding is silent: 7 of 19 placed sessions were absent from
    the public agenda because of per-session content gating — publishing must SAY
    "N placed sessions are not public yet (unapproved content)" with the list.
    **PARTIAL, now OWNED wave 67 (task-w67-h, `main` `123f8ab2`, this task's
    own runtime).** The COUNT is already reported:
    `src/routes/agenda.ts:158-163` (`GET .../agenda/publish` response shape
    `{placed, public, heldBack}`) and `app/src/pages/Agenda.tsx:275-280`
    (toast reads "Schedule live — N of M placed sessions are public." plus
    "K held back: content not approved." when heldBack>0). Only the LIST of
    withheld sessions is still missing. `task-w67-d` owns the list this wave
    — moved to the "Wave 67 in flight" block below, do not re-file.
20. Deliverable-kind taxonomy lacks Photo/Headshot while the Files library filters
    by a Headshot type — a headshot request must be mis-tagged today. Add the kind.
    **DO-NOT-CHASE ruling wave 62 (task-w62-j, `main` `80a3eac3`):** WEAKENED by
    design, not closed. `src/routes/files.ts:72-77` (`LIBRARY_KIND_TOKENS =
    [...FILE_KINDS, HEADSHOT_KIND]`, comment names DEC-773) deliberately keeps
    the upload-time `FILE_KINDS` vocabulary (submission-files upload route)
    separate from the library `?kind=` filter token, which already accepts
    `'headshot'`; `HEADSHOT_KIND` itself lives in
    `src/server/repo/files-library.ts:32` (and is re-declared for the SPA at
    `app/src/pages/content/types.ts:42`), a repo module this wave does not own.
    `src/server/repo/profile.ts:207-242`
    (`completeProfileTaskForContact`) already closes a "profile"/headshot task
    the moment the profile is saved, independent of the deliverable-kind
    taxonomy. A future lane revisiting this item must coordinate with whichever
    lane owns `files-library.ts`'s `HEADSHOT_KIND` before touching it.
21. Speakers dashboard per-task filter narrows nothing visible ("Showing 16 of 16 ·
    task X" with all 8 columns still shown) — filtering by task should collapse to
    that task's column (or rows with it), not just retitle the header.
22. History entries indistinguishable: two same-author edits logged with identical
    timestamp (minute-granular) and identical description — add seconds + a
    changed-fields summary so Restore has something to aim at.
23. Add-to-event duplicate guard: for a contact already on the event the dialog
    says "already on this event — 2 sessions" and still mints another session on
    confirm — that path needs an explicit "add ANOTHER session" confirm, not a
    relabel.
24. Contact drawer scoping clarity: org-level record mixes event-scoped rows
    ("THIS EVENT" role/year) into what reads as a cross-event record, and the save
    affordance is ambiguous — label the event-scoped block explicitly.
    **CLOSED wave 67 (task-w67-h, `main` `123f8ab2`, this task's own
    runtime).** The event-scoped block is its own titled `FieldGroup` with
    the split named in the caption and in the save copy
    (`app/src/pages/contacts/ContactDrawer.tsx:701-703` — title
    `{currentEventName ?? 'On this event'}`, caption "These facts belong to
    this event only — everything above is this person's org-wide record."),
    pinned by `app/src/pages/contacts/ContactDrawer.render.test.tsx:473-491`.
    Do not re-file.
25. Comms recipient dedupe: recipient selection is submission-scoped so one person
    appears N times (Priya twice for SES-001/SES-003) in a people-email — dedupe
    recipients by contact for speaker-audience sends (one email per person).
    **ADJUDICATED DO-NOT-CHASE wave 67 (task-w67-h, `main` `123f8ab2`, this
    task's own runtime) — not a defect.** DEC-238's wave-15 amendment,
    restated at `src/routes/comms/send.ts:100-112`: compose renders a
    PER-SUBMISSION subject, so a speaker with two accepted talks legitimately
    receives two different messages — dedupe here would silently drop a
    message the speaker is owed. Identical-subject sends DO collapse, at
    stage 1, via `dedupeKey(email, subject)` (`:107`). Do not re-file as a
    dedupe gap.
26. Participation status coherence: roster shows CONFIRMED (SES-001) + NOT INVITED
    chips per submission while the speaker-record header shows a single NOT
    INVITED — define the person-level rollup and make both surfaces agree.
27. Public session/agenda cards omit speaker job title/company that speaker detail
    renders — CHECK AGAINST v11 frames first (the session-tag meta line is ruled);
    if frames omit it, this is a forfeit note, not a fix.
28. Back-to-Agenda loses context: returning from a session detail lands on the
    default first day, dropping the day/filter the visitor was on — preserve via
    query params (?day=), consistent with the ?ids= hydration pattern.
    **CLOSED wave 67 (task-w67-h, `main` `123f8ab2`, this task's own
    runtime), DEC-151 wave-59.** `detailCarry`
    (`src/routes/public/detail.tsx:21`) re-encodes day/q/trackId/format/
    roomId through the existing `embedKnobQuery` encoder (`:10,22`), and
    `BackLink` (`:32`, consumed at `:66,136`) renders the carried querystring
    onto the back link. Do not re-file.
29. Agenda "Highlight a track" highlights while the sessions list's same-looking
    track control FILTERS — the split is designed (frames call it Highlight) but
    verify the control labels state their verb; if both just say the track name,
    label the agenda one "Highlight".
    **CLOSED-WITH-RECEIPT wave 62 (task-w62-j, `main` `80a3eac3`):**
    `src/routes/public/agenda-controls.tsx:180,198,209` — the public agenda's
    track control already states its verb: the visible label reads "Highlight
    a track" (`:180`), the empty-option copy repeats it (`:198`), and the
    action button itself reads "Highlight" (`:209`) rather than a bare track
    name. The requested verification is satisfied; do not re-file.
30. Seed near-duplicate submissions (SES-002 vs SES-032, identical title, different
    speaker, conflicting statuses Pending/Declined): if intentional CRM-dedup
    fixture, file the DEC saying so and make the statuses coherent; judges read it
    as data corruption in THREE areas' runs.
    **DO-NOT-CHASE ruling wave 62 (task-w62-j, `main` `80a3eac3`):** DOES NOT
    REPRODUCE against the current seed. `scripts/seed.ts:133-160`
    (`SYNTH_TOPICS`, 27 entries) maps 1:1 index-for-index onto
    `synthTitle(i)` (`:254-258`, `i % SYNTH_TOPICS.length === i` per the
    comment at `:162-165` since `additionalCount === SYNTH_TOPICS.length`),
    so every synthesized submission title is distinct by construction; the
    three hand-authored fixture talk titles in
    `docs/fixtures/sample-data.json` ("Taming 40-Minute CI: Incremental
    Builds at Monorepo Scale", "Your AI Pair Programmer Is Lying to You:
    Verification Patterns That Scale", "Docs That Answer Back:
    Retrieval-Grounded Documentation Sites") do not collide with any
    synthesized title either. Whatever the judge observed as SES-002/SES-032
    was not produced by a title collision in this seed shape; a live
    re-observation against the actual judge run is required before spending
    a lane on this item — do not file a DEC assuming intentional duplication.

**Budget note (user, 2026-08-15): eval ceiling raised to $650** (spend ≈$440).
Plan of record: ONE interim full official run after the P1 clusters land, ONE
final full run on the finished build as the submission number. AIA-only re-run
SKIPPED as redundant (same-day 100.0 measurement exists).

**Already covered by the V11 lane (do NOT double-file):** Remind-laggards(0)
active-no-op (DEC-760 hidden-not-disabled) · skeleton flash "0 files · 0 B" (250ms
first-paint spec) · reminder-throttle visibility (result-panel spec).

**NOT actionable, recorded so nobody chases them:** turn-cap cannot_judge items
(ABS-10, CFP-11/13/16/18, CNT-10/14, CRM-03/04/11) · AIA judge-process death (area
was 100.0 same-day morning run) · deliberate forfeits ABS-14/CFP-16. Same-day
area variance is ±3-7 (ABS 98.1→85.4, EMB 82.9→100 on one build) — do NOT treat a
single-run area dip as a regression without a defect citation.


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

**SWARM LANE (remaining, with the fleet's proven root causes) — STATUS RE-DERIVED
wave 57 (task-w57-e), each row read directly against the tree at MEASURED_SHA
`50c3fcc4` this task's own runtime; branch names, never wave numbers:**
1. **Delete-confirm scan is BLIND to generic apiDelete calls** — OWNED, `task-w56-a`
   (`72ecc759`, "DEC-941: fix delete-confirm scan blindness, guard three unconfirmed
   deletes"), committed, NOT YET an ancestor of `main`. Do not re-file; do not
   re-derive the scan fix until this branch lands or an independent lane re-reads it.
2. **02: CFP builder regressed to chq-measure-table** — NOT-A-DEFECT, adjudicated
   wave 56 (DEC-989 amendment): `docs/design/README.md:409,413,423,425` — the
   frames' own width IS the drawing width (820), and the CFP builder already
   conforms. Do not re-chase this row against a 756/732 ruler.
3. **11: auth h1** — CLOSED by measurement (28px at both `src/routes/auth.css.ts:65`
   and `src/views/bare-page.css.ts:37`, wave-56 closure, unchanged this reading).
   The two carried rhythm numbers (404 block 166 vs 126; body→links 46.5 vs 26.5) are
   OWNED, `task-w57-a` this wave — this task did not re-run a render measurement to
   confirm the rhythm numbers themselves closed (no gate in a docs-only lane); the
   CSS at `src/routes/auth.css.ts:74-84` now states `h1->body ~19px, body->links
   ~26px` explicitly, which reads consistent with a closure but is not itself a
   pixel measurement — next lane to touch this row should re-run the render sweep
   before restating it CLOSED.
4. **03 residue**: plan-editor 400 field messages + `/plans/:id/progress` max-width —
   OWNED, `task-w56-e` (`b581dd8a`, "Review surface: DEC-124 save err.fields walk,
   DEC-989 ProgressPanel measure, widen page-measure scan"), committed, NOT YET an
   ancestor of `main`. Scorecard rail gutter 36 vs 60 — OWNED, `task-w57-b`
   (`2304bbd6`, "Scorecard grid gap: 36px -> 60px, exact-sum identity with
   --chq-measure-wide (DEC-939 wave-57)"), committed, NOT YET an ancestor of `main`.
5. **07**: history tab column heads/filter chips/right-flushed search — OWNED,
   `task-w56-d` (`0259ef82`, "DEC-603: build Comms History tab to its drawn desktop
   frame"), committed, NOT YET an ancestor of `main`.
6. **09**: re-checked sub-clause by sub-clause this wave, not carried whole. The
   shared shell exists and is consumed broadly: `app/src/pages/settings/
   SettingsEditForm.tsx` renders a `.chq-settings-edit-footer` with
   `-destructive`/`-secondary`/`-primary` slots (`app/src/pages/settings/
   settings.css:964-980`), and `SettingsEditForm`/`SettingsField` are imported by
   `CallForPapersPanel.tsx`, `EventSettingsPanel.tsx`, `PeopleRolesPanel.tsx`,
   `PortalSettingsPanel.tsx` and `TracksRoomsPanel.tsx` (five B10 panels, grepped
   directly). Field widths beyond dates: a scan-lock test exists and asserts against
   the real stylesheet, `app/src/pages/settings/settings-field-width.test.ts` (B10
   "field width follows content, not the column" — content-sized grid tracks, no
   `1fr`/`%` on a paired field). Portal toggles: `showResources` is a real bound
   control at `app/src/pages/settings/PortalSettingsPanel.tsx:47,54,62,298`. NOT
   re-checked this wave (do not treat as closed or open — undetermined): footer
   *grammar* (exact wording, as opposed to the shell/slots existing) and "embed card
   anatomy". Carry only those two forward.
7. **12-home: measure 820 vs frames' 732** — NOT-A-DEFECT, adjudicated wave 56
   (DEC-989 amendment, same ruling as row 2): `docs/design/README.md:409,413,423,425`.
   Do not re-file.
8. **05**: .zip accept-list policy — CLOSED wave 54 (DEC-879), re-confirmed this
   wave: `src/domain/files.ts:124` (`CFP_FILE_FIELD_KIND`) is the single source both
   `src/views/form-render.tsx:124` and `:168` derive from — see "Recent review-lens
   findings" above for the full receipt. Do not re-file.
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
10. [`eval-findings/10-wave68-receipts.md`](eval-findings/10-wave68-receipts.md) — Wave 68 mandate-hygiene receipts (task-w68-e)
11. [`eval-findings/11-wave69-receipts.md`](eval-findings/11-wave69-receipts.md) — Wave 69 mandate-hygiene receipts (task-w69-f)
12. [`eval-findings/12-wave70-receipts.md`](eval-findings/12-wave70-receipts.md) — Wave 70 mandate-hygiene receipts (task-w70-g)
13. [`eval-findings/13-wave71-receipts.md`](eval-findings/13-wave71-receipts.md) — Wave 71 mandate-hygiene receipts (task-w71-j)
14. [`eval-findings/14-wave72-receipts.md`](eval-findings/14-wave72-receipts.md) — Wave 72 mandate-hygiene receipts (task-w72-p)
15. [`eval-findings/15-wave74-receipts.md`](eval-findings/15-wave74-receipts.md) — Wave 74 mandate-hygiene receipts (task-w74-e; wave 73 filed no receipts file)

Any citation of the form `docs/eval-findings.md #N` or `docs/eval-findings.md
Section X` refers to content now living in one of the files above; the
mandate-item numbers and section letters embedded in the prose are
unchanged (grep `docs/eval-findings/*.md` for the item/section token).

11. [`eval-findings/14-wave72-receipts.md`](eval-findings/14-wave72-receipts.md) — Wave 72 mandate-hygiene receipts + rebuilt in-flight census (task-w72-p)
