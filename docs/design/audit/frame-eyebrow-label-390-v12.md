# Frame drawn-eyebrow ledger, phone (width:390) — DEC-976 wave-27

Instrument: `test/frame-eyebrow-label.scan.test.ts`. This ledger names the
pack's fourth word-population that no prior instrument graded: a bare
`text-transform:uppercase` span/div — a section eyebrow, a table column
head, a status micro-label — carrying no control face (footer/anchor/
painted-span geometry) and no following input-shaped box. It MEASURES AND
RATCHETS ONLY this wave; no product byte and no CSS were changed.

## Population: 62 eyebrows across 12 of 13 `docs/design/*.dc.html` files

Derived at test time (`readdirSync`, never hand-listed, DEC-808), from
**phone (width:390/height:844) frame extents only** — the same frame-
enumeration idiom `test/frame-control-label.scan.test.ts` already uses,
ported rather than cross-imported. `Chautauqua Speakers.dc.html` contributes
zero rows (no qualifying eyebrow in its phone extents); every other design
file contributes at least one.

An eyebrow candidate is a `<span|div style="...">TEXT</span|div>` whose
style carries `text-transform:uppercase`, whose TEXT contains no `<`, `>`
or `{{`, and is `>= 2` chars after trim. Before this bare grammar reaches
population size 62, 26 further candidates are dropped by the two
disjointness rules below (88 raw candidates → 62 population).

## Disjointness argument against all four sibling ledgers

1. **Caption ledger** (`test/frame-caption-ledger.scan.test.ts`) — that
   ledger's own grammar excludes `text-transform:uppercase`
   ("an eyebrow/label chip, not prose"); this ledger's grammar *requires*
   it. Disjoint by construction; asserted directly (`disjointness: ... shares
   no (fileName, line) with the caption ledger population`) against the
   live `ALL_CAPTIONS` export — 0 overlapping rows.
2. **Phone control-label ledger** (`test/frame-control-label.scan.test.ts`)
   — that ledger's population is FOOTER text nodes (inside the docked-
   footer `<div>` signature), `<a min-height:44px>` anchors, and painted
   `<span>`s carrying a control face (`min-height` + `border-radius` +
   `border:1px`/`background:`). This ledger's own DISJOINTNESS rule (a)
   drops any candidate whose OWN style carries that same control-face
   triple. Asserted directly against a fresh call into that ledger's own
   imported `labelsInFrameText` over the identical phone extents — 0
   overlapping rows.
3. **Desktop control-label ledger**
   (`test/desktop-control-label.scan.test.ts`) — that ledger's frames are
   selected by the pack's non-390 card signature
   (`border-radius:6px` corners, width read off the same line, never 390).
   This ledger's frames are selected by the phone signature
   (`width:390px` + `height:844`). The two frame-selection predicates are
   mutually exclusive on the same line (a line cannot carry both
   `border-radius:20px; width:390px; height:844px` — the phone card corner
   radius — and `border-radius:6px` — the desktop card corner radius — for
   the same declaration), so no eyebrow in this ledger's population can
   ever sit inside a desktop-ledger frame. Asserted directly: every
   population row's `frameLine` is independently re-checked against the
   phone frame-line predicate.
4. **Field-label ledgers** (in flight this wave, not yet landed) — both
   require an input-shaped box (`border:1px solid #BAB6A6` with a
   `border-radius`) immediately after the caption. This ledger's
   DISJOINTNESS rule (b) drops any candidate followed, within its own
   sibling markup (a 400-character forward window, capped at the START of
   the next eyebrow candidate so a short, densely-packed sibling group can
   never leak an unrelated later field's box into an earlier eyebrow's
   window — a leak the fixture non-vacuity test caught and pinned), by
   exactly that input-box grammar. 26 of the 88 raw candidates are dropped
   this way — the field-label ledgers' own population, not this one.

## Per-file breakdown (population size)

| File | Eyebrows |
| --- | --- |
| Chautauqua Account.dc.html | 1 |
| Chautauqua Agenda.dc.html | 1 |
| Chautauqua Comms.dc.html | 3 |
| Chautauqua Contacts.dc.html | 4 |
| Chautauqua Content.dc.html | 3 |
| Chautauqua Docs.dc.html | 1 |
| Chautauqua Home.dc.html | 4 |
| Chautauqua Overview.dc.html | 7 |
| Chautauqua Public and Portal.dc.html | 20 |
| Chautauqua Review.dc.html | 7 |
| Chautauqua Settings.dc.html | 9 |
| Chautauqua Submissions.dc.html | 2 |
| **Total** | **62** |

## Grades (re-measured wave 33, task w33-f — the digit-collapsed skeleton join)

Wave 27's original UNRESOLVED bucket was never joined at all — every
digit-bearing miss was classified UNRESOLVED by the presence of a digit
alone, with no join ever run against it (this doc said so outright, in the
paragraph this section replaces). Wave 33 runs the SAME digit-collapsed
skeleton join the desktop control-floor ledger built at wave 29
(`collapseDigitsToSkeleton`, hoisted from
`test/desktop-control-floor.scan.test.ts` into the shared
`test/frame-source-corpus.ts` so both ledgers import the one sentinel,
DEC-613) over all 16 digit-bearing misses, then grades whatever it still
cannot resolve on its own merits.

This wave's DIVERGES count differs from wave 27's by ruling, not by
re-derivation: see DEC-993 (SETTLED) and the DEC-099-adjudicated
`docs/design/DEVIATIONS.md` §5 pointer below for the two rulings that
together govern this bucket.

- **MATCHED**: 44 (up from 43) — the eyebrow's text occurs verbatim
  (case-folded, comment-stripped, entity-decoded, whitespace-collapsed) in
  the non-test `app/src/**`/`src/**` corpus, OR its digit-collapsed
  skeleton occurs verbatim in the digit-collapsed corpus. The one newly
  resolved row: `Chautauqua Settings.dc.html:458` "In 6 days" — the app
  draws the identical clause with a live day-count digit, which the
  skeleton pass turns back into an exact match.
- **UNRESOLVED**: 16 (down from 18) — the join's static substring test
  (skeleton pass included) cannot verify a value composed at render time
  from live data, but each row now names the composing source expression
  individually, rather than being waved through by digit-presence alone:
  - **14 digit-bearing rows** (`DIGIT_COMPOSED` in the test file, down from
    16 pre-skeleton because :458 above resolved and one further row —
    `Chautauqua Public and Portal.dc.html:1019` — turned out to be a real
    DIVERGES, not a composed miss, see below):
    - `Chautauqua Contacts.dc.html:494` "Column 2 of 5" —
      `` Column {phoneColumnIndex + 1} of {header.length} ``
      (`app/src/pages/contacts/ImportWizard.tsx:1096`).
    - `Chautauqua Content.dc.html:381` "Re-uploaded · you asked for changes
      8 days ago" — `` {statusLabel}{statusNeedsCauseClause ? ' · you asked
      for changes ' + formatRelativeDays(...) : ...} ``
      (`app/src/pages/content/DeliverableDetail.tsx:446-452`).
    - `Chautauqua Overview.dc.html:274` "Tue 12, 10:00 · Room 2A" —
      `` {formatDayLabel(conflict.day)}, {clockHHMM(conflict.startMin)} ·
      {publicRoomLabel(conflict.roomName)} ``
      (`app/src/pages/overview/AgendaWorkSection.tsx:130-133`, whose own
      comment cites this exact frame line).
    - `Chautauqua Public and Portal.dc.html:374` "12–14 May 2027 · Moscone
      West" — `eventDatesLine(event)`
      (`src/routes/public/shell.tsx:228-230`,
      `` `${formatEventDayRange(...)} · ${event.location}` ``).
    - `Chautauqua Public and Portal.dc.html:624` and `:1318` "On this
      session · 1" — two-sibling-node composition, not a single string:
      `<span>On this session</span><span
      class="chq-portal-session-count">{participants.length}</span>`
      (`src/routes/portal/edit.tsx:362-363`); a text-content-only join can
      never assemble two sibling DOM nodes into one string.
    - `Chautauqua Public and Portal.dc.html:1076`, `:1126`, `:1149`
      "Submitted · DFC-048/049/050" — `` SUBMITTED &middot; {props.ref} ``
      (`src/routes/public/submit-views.tsx:856`), the same composing
      expression rendered against three different fixture refs across the
      confirmation page's three states.
    - `Chautauqua Review.dc.html:286` "Wave 2 · AI Engineering · round 1" —
      `scorecardEyebrow` (`app/src/pages/review/Scorecard.tsx:503-507`,
      `[plan.name, planTrackScope(...), planNamesRound(plan.rounds) ?
      roundLabel(...) : null]`).
    - `Chautauqua Review.dc.html:419` "Review · Wave 2" —
      `` `REVIEW · ${routeEnvelope.planName}` ``
      (`app/src/pages/review/ReviewerQueue.tsx:657`).
    - `Chautauqua Settings.dc.html:461` "Questions · 8" —
      `` `Questions · ${list.length}` ``
      (`app/src/pages/settings/CallForPapersPanel.tsx:128`).
    - `Chautauqua Submissions.dc.html:361` "DFC-033 · lightning talk, 10
      min" — two-sibling-node composition: `<p
      className="chq-detail-eyebrow" data-ref={detail.ref}>{eyebrowText}</p>`
      (`app/src/pages/submissions/SubmissionDetailPage.tsx:1207-1209`) with
      the ref prefix drawn by a phone-only CSS `::before` keyed off
      `data-ref` (`app/src/pages/submissions/detail.css:1292`) — a
      text-content-only join can never assemble a CSS-generated prefix into
      one string.
    - `Chautauqua Submissions.dc.html:375` "Reviews · 3 of 3 in" —
      `` Reviews &middot; {evaluations.filter((ev) => ev.submittedAt !==
      null).length} of {assignedReviewers} in ``
      (`app/src/pages/submissions/SubmissionDetailPage.tsx:1383`).
  - **2 digit-free rows**, unchanged from wave 27 (`NO_DIGIT_COMPOSED` in
    the test file):
    - `Chautauqua Agenda.dc.html:161` "Two sessions in this slot" —
      `{capitalizeFirst(spellCount(slot.sessions.length))} {plural(...)} in
      this slot` (`app/src/pages/agenda/PhoneAgenda.tsx`).
    - `Chautauqua Content.dc.html:406` "Notes on the slides" —
      `` Notes on the {DELIVERABLE_LABELS[activeKind].toLowerCase()} ``
      (`app/src/pages/content/DeliverableDetail.tsx:595`).
- **DIVERGES**: 1 (up from 0), adjudicated per `docs/design/DEVIATIONS.md`
  §5 "Pending adjudication (not yet blessed — sweep should verdict)" —
  see that citation repeated below, in this same bullet's own continuation,
  so this row's adjudication does not depend on a nested bullet a scanner
  would treat as a separate paragraph. Real, unfixed, measured by the
  skeleton pass surfacing a row the digit rule had previously mis-swept
  into UNRESOLVED without ever checking whether a composing expression
  could actually produce it. Row: `Chautauqua Public and Portal.dc.html:1019`
  "DevFlow Conf 2027 · closes 16 Aug" — no composing expression can ever
  produce this exact string, for any data state. The frame draws ONE
  eyebrow joining the event name and the CFP close date, directly above the
  "Submit a talk" H1. `src/routes/public/submit-views.tsx:585-597` renders
  THREE separate header elements instead: a date·venue meta line
  (`eventDatesLine(event)`, `chq-cfp-meta`), the event name as a large
  title (`chq-cfp-title`, DEC-986 wave-40 amendment moved the literal
  `<h1>Submit a talk</h1>` OUT of this header and into the body column),
  and a separate uppercase sub-line reading the FIXED literal `` Call for
  papers · closes {formatEventDateTime(...)} `` (`chq-cfp-sub`, :592-595).
  `event.name` never reaches the sub-line position at all — the app
  substitutes the fixed literal "Call for papers" for the event name in the
  eyebrow-equivalent position, a genuine wording gap, not a live-data miss
  the join technique is merely blind to. **Not fixed in this lane** — fix
  capability is file-scoped to this ledger and this audit doc; DEVIATIONS.md
  is out of this task's file-scope to edit, and this lane never makes
  design decisions, so the row is recorded here, with full frame + code
  citations, for the next `docs/design/DEVIATIONS.md` sweep to log into its
  §5 and verdict — this paragraph is not a claim that DEVIATIONS.md already
  carries the entry, only that this is where it belongs and who should log
  it (DEC-099).
- **SETTLED**: 1 — `Chautauqua Comms.dc.html:303` "Insert a field · open",
  per `src/decisions-data/DEC-993.md`'s wave-12m amendment; excluded from
  DIVERGES by the ledger's `SETTLED_EXCLUSIONS` table, never counted as a
  live product gap. Unchanged this wave.

Row-count accounting (DEC-808, DEC-976): MATCHED + UNRESOLVED + DIVERGES
(the one row adjudicated above) + SETTLED (per DEC-993) = 44 + 16 + 1 + 1 =
62 = population, asserted directly in the test suite.

## Ratchets

- `FRAME_EYEBROW_DIVERGENCE_CEILING = 1` (up from 0)
- `FRAME_EYEBROW_UNRESOLVED_CEILING = 16` (down from 18)

Both re-measured on branch `v12m-w33-f` (DEC-808 amendment) by forcing each
to `-1` and reading the printed offender rosters back, never arithmetic and
never carried forward from the prior wave's numbers. Both two-sided
(`test/campaign-ratchet-two-sided.scan.test.ts` verified green); both
registered in `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` with a
principle reason (DEC-099) — a newly measured, previously-uncounted
population must not move the campaign's own exit-gate goalposts
mid-convergence, the same disposition already given to
`DESKTOP_FLOOR_DIVERGENCE_CEILING`/`DESKTOP_FLOOR_UNRESOLVED_CEILING`.
`test/open-divergence-ledger.scan.test.ts`'s own `OPEN_DIVERGENCE_CEILING`
is unaffected by the new DIVERGES row above: it is adjudicated in this
file per the paragraph above, so it opens no new OPEN row on that ledger
(verified green, unchanged from its pre-wave-33 measurement).

DEC-099: the DIVERGES row this wave measured is a real, unfixed product gap
recorded for a later lane, not a claim this ledger's own ratchet resolves
it -- the adjudication above only prevents it from double-counting as a
second, unadjudicated OPEN row on a sibling ledger.

## Next population, deliberately not built here

The **desktop** half of this same grammar (non-390 card frames, the same
uppercase/control-face/input-box disjointness rules) is the natural next
lane. It is not smuggled into this ledger — this file's population is the
phone (width:390) extents only, exactly as this task's scope names.
