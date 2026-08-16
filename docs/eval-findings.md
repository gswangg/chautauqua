# Eval findings — rebased 2026-08-15 (wave 57, task-w57-e)

Verified against `main`/HEAD `50c3fcc4d63239784fdd237f7340a3f648934e31`
("merge-train w56 repair: portal-edit mock passthrough + Review
frame-citation drift"), MEASURED_SHA `50c3fcc4`, derived AT THIS TASK'S
OWN RUNTIME (DEC-069 wave-17/wave-37, DEC-358 rebase rule; this is a
DOCS-ONLY wave-57 code-wave lane — no gate ran, no `docs/verification-log/
index/` section filed, per DEC-069). This wave is a MANDATE
RE-DERIVATION only: it re-runs the four "Recent review-lens findings"
falsifying checks and the GATE-9 SWEEP VERDICTS census against the live
tree (see the GATE-9 section below) rather than re-deriving TIER 0-2 in
full. **The reflog holds multiple campaigns sharing this DEC corpus and
this task-id namespace** — `task-custodian-w68-4` and `task-w72-a`
through `-j` exist locally as leftover worktrees from an earlier,
already-further-along campaign (reached wave 72) and are NOT part of
this campaign's queue; flagged, not triaged, same as prior waves. Note
for the NEXT rebase: `main` was observed to advance past this
MEASURED_SHA (to `590083ed...`, a direct "Gate-8 loss-mine itemized"
commit) while this task was still reading the tree — normal churn in a
live swarm, not a correction to the sha pinned above, which is the sha
this task's own file:line reads were taken against.

COMPACTION per DEC-358's rebase rule: the wave-50 header (pinned to
`87cee8b9`, seven waves stale) is REPLACED by this one. No per-item
citation is deleted; the full TIER 0-2 body below this header was not
re-derived this wave (out of this task's scope) and is carried
unchanged — treat its own file:line citations as of ITS last stated
runtime, not this one's.

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

**P1 CLUSTERS (all four produced MAJOR defects). STATUS wave-63: 1a/2/3/4 landed
(DEC-290 opt-in attach, DEC-829 roster visibility, DEC-746 subset picker, DEC-238
shared dedupe plan) — 1b below is the ONLY P1 remnant, THREE WAVES UNCLAIMED,
TOP PRIORITY for the next wave:**
1. **CSV import: event coupling + dedup blindness** (hit in CRM AND SPK AND CNT — one
   cluster, three areas' judgments contaminated). (a) The wizard REQUIRES "Session
   title for this batch" and silently attaches every imported org-level contact to a
   synthetic accepted session on the current event — importing into the DIRECTORY must
   be possible with NO event side effects (event attach = explicit opt-in step).
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
7. Speaker headshots render as blank navy rectangles on public speakers list/gallery/
   detail (3 speakers with uploaded photos) — the data exists, the render path fails.
8. OFF-toggled saved embed serves a BLANK page at its permalink — render a minimal
   "This embed has been turned off" body instead of white nothing.
9. `/dev/mailbox` 404s (operator-doc'd path, tried both runs) — either mount the dev
   mailbox viewer or fix the operator docs; judges read the docs.
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
17. Reviewer progress header "Round 1 of 1" while the event has six plans — the
    denominator is wrong or the copy claims a rounds model that doesn't exist.
18. Scorecard a11y: the two numeric 1-5 criteria rows are exposed near-identically
    and the accessibility tree DEDUPES them into one set — give each criterion a
    distinct accessible group/name (fieldset/legend or labelled radiogroup).
19. Publish-flow withholding is silent: 7 of 19 placed sessions were absent from
    the public agenda because of per-session content gating — publishing must SAY
    "N placed sessions are not public yet (unapproved content)" with the list.
20. Deliverable-kind taxonomy lacks Photo/Headshot while the Files library filters
    by a Headshot type — a headshot request must be mis-tagged today. Add the kind.
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
25. Comms recipient dedupe: recipient selection is submission-scoped so one person
    appears N times (Priya twice for SES-001/SES-003) in a people-email — dedupe
    recipients by contact for speaker-audience sends (one email per person).
26. Participation status coherence: roster shows CONFIRMED (SES-001) + NOT INVITED
    chips per submission while the speaker-record header shows a single NOT
    INVITED — define the person-level rollup and make both surfaces agree.
27. Public session/agenda cards omit speaker job title/company that speaker detail
    renders — CHECK AGAINST v11 frames first (the session-tag meta line is ruled);
    if frames omit it, this is a forfeit note, not a fix.
28. Back-to-Agenda loses context: returning from a session detail lands on the
    default first day, dropping the day/filter the visitor was on — preserve via
    query params (?day=), consistent with the ?ids= hydration pattern.
29. Agenda "Highlight a track" highlights while the sessions list's same-looking
    track control FILTERS — the split is designed (frames call it Highlight) but
    verify the control labels state their verb; if both just say the track name,
    label the agenda one "Highlight".
30. Seed near-duplicate submissions (SES-002 vs SES-032, identical title, different
    speaker, conflicting statuses Pending/Declined): if intentional CRM-dedup
    fixture, file the DEC saying so and make the statuses coherent; judges read it
    as data corruption in THREE areas' runs.

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

Any citation of the form `docs/eval-findings.md #N` or `docs/eval-findings.md
Section X` refers to content now living in one of the files above; the
mandate-item numbers and section letters embedded in the prose are
unchanged (grep `docs/eval-findings/*.md` for the item/section token).
