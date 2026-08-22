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

## Grades

- **MATCHED**: 43 — the eyebrow's text occurs verbatim (case-folded,
  comment-stripped, entity-decoded, whitespace-collapsed) in the non-test
  `app/src/**`/`src/**` corpus.
- **UNRESOLVED**: 18 — the join's static substring test cannot verify a
  value composed at render time from live data. 16 rows carry a digit (a
  date, a `DFC-NNN` ref, a count) and are classified UNRESOLVED by that
  discriminator alone; 2 digit-free rows were independently inspected and
  confirmed composed, and are named individually (`NO_DIGIT_COMPOSED` in
  the test file, each citing the composing source expression):
  - `Chautauqua Agenda.dc.html:161` "Two sessions in this slot" —
    `{capitalizeFirst(spellCount(slot.sessions.length))} {plural(...)} in
    this slot` (`app/src/pages/agenda/PhoneAgenda.tsx`).
  - `Chautauqua Content.dc.html:406` "Notes on the slides" —
    `` Notes on the {DELIVERABLE_LABELS[activeKind].toLowerCase()} ``
    (`app/src/pages/content/DeliverableDetail.tsx:595`).
- **DIVERGES**: 0. This wave's own first measurement (`v12m-w27-e`) had
  classified `Chautauqua Comms.dc.html:303` "Insert a field · open" as a
  real, unfixed DIVERGES row — the frame draws this as a static header row
  above the merge-field list panel when the panel is open, and
  `app/src/pages/comms/InsertFieldMenu.tsx` renders a trigger button
  (`Insert a field ▾`), a live count hint (`{fields.length} available ·
  dropped in at the cursor`), and the `role="menu"` item list itself, but
  no header text at all above the item list. That subject is SETTLED,
  per `src/decisions-data/DEC-993.md`'s own wave-12m amendment: the closed
  `Insert a field ▾` trigger IS the ruled shape, and the frame's
  permanently-open merge-field palette is a recorded, settled divergence,
  not a live copy gap this lane owes a fix for. Moved into
  `SETTLED_EXCLUSIONS` in `test/frame-eyebrow-label.scan.test.ts` (DEC-993
  wave-28 amendment) and dropped from the DIVERGES count accordingly.
- **SETTLED**: 1 — `Chautauqua Comms.dc.html:303` "Insert a field · open",
  per `src/decisions-data/DEC-993.md`'s wave-12m amendment as described
  above; excluded from DIVERGES by the ledger's `SETTLED_EXCLUSIONS` table,
  never counted as a live product gap.

MATCHED + UNRESOLVED + DIVERGES + SETTLED = 43 + 18 + 0 + 1 = 62 =
population, asserted directly in the test suite. `src/decisions-data/
DEC-993.md`'s wave-12m amendment is the ruling that moves the one
population row this ledger's first measurement had misclassified from
DIVERGES to SETTLED.

## Ratchets

- `FRAME_EYEBROW_DIVERGENCE_CEILING = 0`
- `FRAME_EYEBROW_UNRESOLVED_CEILING = 18`

`FRAME_EYEBROW_DIVERGENCE_CEILING` re-measured on branch `v12m-w28-b`
(DEC-993 wave-28 amendment) by forcing it to `-1` and reading the printed
offender list back: empty, once `Chautauqua Comms.dc.html:303` moved into
`SETTLED_EXCLUSIONS`. `FRAME_EYEBROW_UNRESOLVED_CEILING` is unchanged from
its `v12m-w27-e` measurement — the SETTLED move touches only the DIVERGES
side. Both two-sided
(`test/campaign-ratchet-two-sided.scan.test.ts` verified green); both
registered in `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` with a
principle reason (DEC-099) — a newly measured, previously-uncounted
population must not move the campaign's own exit-gate goalposts
mid-convergence, the same disposition already given to
`DESKTOP_FLOOR_DIVERGENCE_CEILING`/`DESKTOP_FLOOR_UNRESOLVED_CEILING`.

## Next population, deliberately not built here

The **desktop** half of this same grammar (non-390 card frames, the same
uppercase/control-face/input-box disjointness rules) is the natural next
lane. It is not smuggled into this ledger — this file's population is the
phone (width:390) extents only, exactly as this task's scope names.
