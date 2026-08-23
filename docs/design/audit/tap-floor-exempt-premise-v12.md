# tap-floor-exempt receipt premise audit (DEC-393 wave-30 amendment; second floor-grammar tier wave-34; three predicate-less families wave-36; two more floor-grammar tiers wave-40)

Instrument: `test/tap-floor-exempt-premise.scan.test.ts`. Population: every
real `/* tap-floor-exempt: ... */` (or JSX `{/* ... */}`) comment under
`src/**` and `app/src/**` (excluding `*.test.ts(x)` and this campaign's own
scan-library directories, `app/src/phone-tap-target-scan/` and
`app/src/phone-overflow-scan/`, whose prose ABOUT the token is not a real
receipt — verified by hand against `app/src/phone-tap-target-scan/
undeclared.ts`'s literal `<reason>` grammar placeholder). Measured: **98
receipts** — 19 `composition`, 11 `inline-*`, 68 `other` (by the reason's own
first word).

Wave 34 gave the instrument a SECOND floor-grammar tier, derived from the
sheet's own rules (never a hand-listed selector allowlist, DEC-367/DEC-808):
a companion co-styled with an `img` element selector in the same CSS rule
(the pack's own idiom for pairing a real `<img>` with its no-photo fallback,
e.g. `.chq-foo img, .chq-foo-fallback { ... }`) satisfies the 44px hit-box
floor through its OWN resolved width/height (or min-width/min-height) rules
reaching >=44px on BOTH axes — independent of `display:flex` /
`align-items:center` / padding, which a replaced-content box (no text to
centre or pad around) has no reason to declare. Re-measured by forcing both
ceilings to `-1` and reading the roster back: `FALSE-PREMISE` 1 -> **0**;
`UNVERIFIABLE-PREMISE` unchanged at **86**.

## Wave 36 (task w36-f, DEC-393 wave-36 amendment): three more predicate-less families

Of the 86 `UNVERIFIABLE-PREMISE` receipts above, 68 were filed under `other`
solely because `classifyFamily`'s first-word regex recognised only
`composition` and `inline-*` — every other reason word fell to `other` by
construction, whether or not its premise was actually checkable. This wave
adds three more recognised families, all with a real predicate, none of
them restructuring `composition`/`inline-*`:

- **`modifier`** (5 receipts — two in src/views/theme.ts, two in
  src/routes/docs-site.css.ts, one in src/views/error-states.css.ts).
  The reason names a BASE class the receipted selector composes onto.
  Routed through the EXISTING companion floor-grammar tiers unchanged — no
  new grammar, just a family label the instrument now recognises.
- **`scoped`** (2 receipts — app/src/pages/contacts/contacts.css and
  app/src/pages/submissions/detail.css). The reason names a CONTAINER
  class. Same companion predicate as `modifier`/`composition`.
- **`render-gate`** (6 receipts, all `app/src/pages/agenda/agenda.css` —
  `:280`, `:440`, `:478`, `:534`, `:693`, `:777`). The claim is "the
  component never mounts at phone width," a claim about runtime behaviour
  the companion floor-grammar has nothing to say about. Gets its own
  two-tier predicate (`judgeRenderGate`), BOTH tiers required to reach
  VERIFIED: (i) the reason names a real receipt test file that exists on
  disk and mentions the gated component by name; (ii) FALSIFICATION — the
  receipted selector's own class token must NOT appear in either
  machine-written 390 roster (`docs/design/audit/
  admin-390-interactive-offenders-w27.md`,
  `docs/design/audit/public-390-interactive-offenders-v12.md`). An element
  the live 390 sweep actually rendered contradicts "never mounts here" by
  construction, so that grades FALSE-PREMISE, never a silent pass.

Re-measured by forcing both ceilings to `-1` and reading the roster back:

- All 6 `render-gate` receipts resolve **VERIFIED** — `agenda-render-gate.
  receipt.test.ts` exists and names `DayGrid`/`SessionCard` per receipt, and
  none of the six selector tokens (`chq-day-grid-cell-btn`,
  `chq-day-grid-noroom-btn`, `chq-day-grid-cell-btn-clash`,
  `chq-day-grid-clash-item`, `chq-session-card`,
  `chq-session-card-conflict`) appears in either live 390 roster.
- 4 of the 5 `modifier` receipts resolve **VERIFIED** (`.chq-btn` and
  `.chq-docs-nav-link` are both real, floored companions present in
  markup); `src/views/error-states.css.ts:46` stays **UNVERIFIABLE-PREMISE**
  — its reason names element types (`input`/`select`/`textarea`/`fieldset`),
  not a `.chq-*` companion class, so the companion predicate has nothing to
  resolve.
- 1 of the 2 `scoped` receipts resolves **FALSE-PREMISE**:
  app/src/pages/contacts/contacts.css names
  `.chq-contacts-drawer-actions` as the container that "only ever renders
  `<button>` children," but that container's own merged CSS (base rule +
  its phone-media override, plus the two compound `.chq-contacts-
  drawer-actions .chq-btn(-tertiary)` rules) declares no min-height and no
  horizontal padding of its own — it is a pure flex layout wrapper; the
  actual 44px floor lives on its `.chq-btn` children one level down, which
  this instrument's companion predicate does not follow transitively. This
  is a REAL predicate-grammar defect in the receipt's own premise (not an
  instrument bug): the receipt's *prose* is almost certainly still true
  (the container never renders a bare anchor — the button children carry
  their own floor via `.chq-btn`), but the *specific class it names* as
  "the floor" does not itself carry one. Per the task's own instruction,
  this is recorded here with the offending selector named; product CSS is
  NOT touched in this lane. **SUPERSEDED wave-39 (task w39-a):** this
  row was the campaign's last unowned non-zero exit-predicate ceiling, so
  it was repaired in place rather than left as a permanent roster row —
  see the "Wave 39" section below. `app/src/pages/submissions/detail.css:278`
  stays **UNVERIFIABLE-PREMISE** — its named container
  (`.chq-detail-participant-row-actions`) is already part of the
  receipted selector itself (a compound `.chq-detail-participant-row-actions
  .chq-link-button` rule), so no companion DISTINCT from the receipted
  selector can be resolved, the same "no companion named" shape every
  other `composition`/`inline-*` row of that detail hits.

Net: `UNVERIFIABLE-PREMISE` 86 -> **75** (11 receipts left the roster: 10
VERIFIED + 1 FALSE-PREMISE); `FALSE-PREMISE` 0 -> **1**.

## Wave 40 (task w40-f, DEC-808): the two named un-resolvable shapes get real tiers

Wave 36's own comment named the exact two receipts its three new families
still could not resolve, and DEC-808 (this task's own citation) restates why:
`src/views/error-states.css.ts`'s `modifier` reason names ELEMENT TYPES
(`input`/`select`/`textarea`/`fieldset`) rather than a `.chq-*` companion
class, and `app/src/pages/submissions/detail.css`'s `scoped` reason names its
OWN compound selector's already-receipted class rather than a distinct
companion. Two more floor-grammar tiers, in `judgeReceipt`:

- **ELEMENT-TYPE tier** (`judgeElementTypeReason`): a reason naming a
  `/`-joined list of bare HTML element types (`(input/select/textarea/
  fieldset)`) resolves **VERIFIED** only when EVERY named type is reached,
  somewhere in the tree, by a selector-list ARM that IS that bare type
  (`input`, `input[type=text]`, `fieldset` — never a descendant chain that
  merely CONTAINS the word, e.g. `.chq-settings-panel fieldset label`, whose
  44px floor belongs to the LABEL, not the fieldset) declaring
  `min-height:44px`. The moment one named type is unreached, the tier does
  NOT resolve the receipt — it falls back to `UNVERIFIABLE-PREMISE`, never a
  silent VERIFIED.
- **SELF-SCOPED tier** (`judgeSelfScoped`): a `scoped` reason that names only
  a token already present in its own receipted selector's `receiptedClasses`
  (so the existing "distinct companion" search finds nothing) is checked
  against ALL of the receipted compound selector's own classes, not just the
  self-named one — a compound selector's OTHER class may carry the real
  floor in a sheet the receipt's own file never touches. VERIFIED the moment
  any receipted class reaches the floor grammar and appears in real markup;
  otherwise **REFUTED to FALSE-PREMISE**, not silently accepted, when none of
  them declare a floor anywhere.

Both tiers ship a positive control (fires correctly on a fabricated case
built for it) and a negative control (does not resolve/silently pass a case
built to defeat it) in the scan file itself.

Forced to `-1` and re-measured standalone — never by arithmetic on a prior
wave's composition, the exact trap this constant already fell into once at
wave-36 (88 - 11 = 77, wrong for the merged tree):

- `src/views/error-states.css.ts:46` **stays UNVERIFIABLE-PREMISE**.
  `input`/`select`/`textarea` are each reached by `theme.ts`'s own bare-type
  phone-media rule (`min-height: 44px`); `fieldset` is reached by NO rule
  anywhere in the tree — a `<fieldset>` is a grouping container, never
  itself a tap target, and the only "fieldset ... 44px" match in the tree
  (`app/src/pages/settings/settings.css`'s `.chq-settings-panel fieldset
  label { min-height: 44px }`) floors the LABEL, one level down, which the
  arm-exact grammar correctly refuses to credit to `fieldset` itself. This
  is an honest gap: the receipt's own premise is broader than the tree
  supports, not an instrument miss.
- `app/src/pages/submissions/detail.css:278` **now resolves VERIFIED**. Its
  receipted selector is the compound `.chq-detail-participant-row-actions
  .chq-link-button`; the reason names only the container (already in
  `receiptedClasses`, so the pre-wave-40 companion search found nothing
  distinct), but the OTHER receipted class — `.chq-link-button` — carries a
  real floor in `app/src/styles.css`'s phone-media block (`min-height:44px;
  min-width:44px; display:flex; align-items:center; padding:0 6px;`), a
  sheet this receipt's own file never touches. (The same file's own
  `v12m-w6-h` comment at `detail.css:1224` had already noted, for a
  DIFFERENT selector, that `.chq-link-button` "carries no floor anywhere" —
  that note predates the `styles.css` phone-media rule above and is now
  stale; not corrected here, out of this lane's scope.)

Net this wave: `UNVERIFIABLE-PREMISE` 77 -> **76** (one row, the self-scoped
one, left the roster). `FALSE-PREMISE` unchanged at **1** — neither new tier
touched it; `TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` and
`app/src/pages/contacts/contacts.css` are `v12m-w39-a`'s, per DEC-099's
single-owner-per-ceiling rule. The population itself has also grown since
wave 36's 98-receipt snapshot (three intervening waves' worth of new/edited
receipts) to **101** total — re-measured directly via the roster, never
inferred from an old total plus a delta.

### The remaining `other`-family receipts: structurally resolvable vs. grounded only in a design authority

Neither new tier touches the `other` family (still gated out before either
tier ever runs, unchanged from wave 30) — its 55 rows are exactly wave-36's
55. This wave read all 55 reasons by hand and sorted them into two buckets,
by whether the reason states a FACT about the tree a future scan could check
(render output, a companion class, an existing sibling rule) versus a VALUE
or SCOPE judgement no scan can settle (a redesign deferred as a follow-up, a
typographic/line-box aesthetic call) — this is a first-pass **heuristic**
read, not a second machine-checked predicate, and is recorded as such:

- **49 of 55 look structurally resolvable** by a future, more specific
  tier — most name a concrete, checkable fact: "renders only `<button>`
  children, never a bare anchor" (≈30 receipts across `comms.css`,
  `contacts-panels.css`, `contacts.css`, `content.css`, `forms.css`,
  `review.css`, `scorecard.css`, `submissions/detail.css`,
  `submissions.css`, `styles.css` — a render-fact claim the same shape
  `judgeRenderGate` already checks for a different premise, just never
  built for "no bare anchor" instead of "never mounts"), "a visually-hidden
  input's operable target is its `<label>`" (`comms.css:158`,
  `content.css:432`, `portal.css.ts:361`, `speakers/task-view.css:284` —
  several already NAME the label's own `.chq-*` class, e.g. `.chq-check-hit`,
  which the EXISTING companion floor-grammar could check today if this
  shape got its own recognised family), "an empty `<th>` spacer, no
  children at all" (`content.css:879`, `settings.css:2583`,
  `styles.css:1444`), and a handful naming a companion this instrument's
  first-word regex simply does not recognise yet (`comms.css:1235`,
  `comms.css:2268`, `contacts-panels.css:997`, `overview.css:148`,
  `overview.css:608`, `review.css:331`, `review.css:1574`,
  `review.css:1793`, `submissions.css:27`, `submissions.css:206`,
  `styles.css:1365`, `styles.css:1388`, `styles.css:1704`,
  `content.css:908`, `theme.ts:538`, `chrome.css.ts:36`).
- **6 of 55 are grounded only in a design/scope authority**, not a
  tree-checkable fact — no scan, however widened, could settle them, because
  the claim is a value or priority judgement: `styles.css:1772` (enlarging
  the colour-swatch grid to 44px "is a distinct visual-redesign task, out of
  scope … tracked as a follow-up"), `styles.css:1948` (the 18px checkbox
  glyph's own size is deliberately unchanged; "enlarging it is a
  system-wide redesign"), `overview.css:564`, `styles.css:2879`,
  `src/routes/public/css/rail.css.ts:671` and `src/routes/public/home.css.ts:
  152` (four aesthetic/typography calls: flooring an inline phrase would
  "break the line box," each without naming a companion an instrument could
  check instead). These six are the honest, un-shrinkable gap — grounded in
  human design judgement (DESIGN-RULINGS.md/DEVIATIONS.md territory), not
  in anything this or any future tree scan could verify true or false.

This sort is NOT built into the instrument (it changes no verdict, no
ceiling) — it is recorded here, by hand, as the honest classification the
task asked for, left open for a future wave to decide which of the 49 are
worth a fourth tier.

## Verdict counts

Wave 40 (task w40-f): re-measured directly (never by arithmetic), the
population has grown to **101** receipts (three intervening waves' worth of
new/edited receipts since wave 36's 98-receipt snapshot).

| Verdict | Count | Meaning |
|---|---|---|
| VERIFIED | 25 | the receipt names a companion (or, for `render-gate`, a gated component) whose premise this instrument can check and which checks out: (1) a real min-height:44px + centred flex (`flex`/`inline-flex`) + non-zero horizontal padding rule (merged across every rule mentioning it), or (2) wave-34's replaced-content tier (co-styled with an `img` element selector, own width/height >=44px on both axes), or (3) wave-36's `render-gate` two-tier predicate (named, existing receipt test that mentions the component; AND the selector token absent from both live 390 rosters), or (4) wave-40's ELEMENT-TYPE tier (every named bare element type reached by a min-height:44px arm) or SELF-SCOPED tier (any of the receipted selector's own classes reaches the floor grammar). |
| UNVERIFIABLE-PREMISE | 76 | this wave's instrument cannot express a check for the receipt — either its reason family (`other`) has no predicate yet, a `composition`/`inline-*`/`modifier`/`scoped` reason names no companion class distinct from the receipted selector itself (and, for `modifier`, names no element-type list either, or names one with an unreached type), or a `render-gate` reason names no existing/component-mentioning receipt test. Per DEC-393 wave-30 clause (c): a roster row, not a silent pass. |
| FALSE-PREMISE | 0 (was 1 through wave 36; repaired wave 39, see below) | the receipt named a companion class (or, for `scoped`, one of its own receipted classes) that is real but does NOT carry the floor-grammar tier this instrument checks for (`app/src/pages/contacts/contacts.css:596`, see wave-36 section above) — a real predicate-grammar defect; the wave-39 section below repairs the receipt in place and the row now resolves VERIFIED. |

## The worked example (built this wave)

`src/routes/public/css/agenda.css.ts` `.chq-pub-agenda-day-footer a` — the
receipt previously argued only typography ("a 44px box would break the line
box"). Rewritten to also name the load-bearing premise: `agenda.tsx`
renders `<DaySwitcher`, whose `.chq-pub-day-pill` anchors
(`src/routes/public/css/agenda.css.ts`, min-height:44px + flex +
align-items:center + padding:0 8px) build their href from the same
`agendaQs(current, {day})` helper with the same `nextDay`, reaching the
identical destination. `test/public-agenda-phone-frames.render.test.ts` gained
a pin asserting `.chq-pub-day-switcher`/`.chq-pub-day-pill` render on a real
`/e/:slug/agenda` request at 390, so the premise cannot rot silently. Now
resolves VERIFIED (see roster below).

## The former FALSE-PREMISE row, now VERIFIED: a second floor-grammar tier closed the predicate-grammar mismatch

`src/routes/public/css/cards.css.ts` `.chq-pub-headshot-link`'s
`composition` receipt names `.chq-pub-headshot-fallback` as the floored
companion. That class's real claim was always a REPLACED-CONTENT sizing one
— the anchor "carries no size of its own"; its `<img>`/
`.chq-pub-headshot-fallback` child is sized to fill a >=44px tile via
width/height rules (`.chq-pub-speaker-list-photo .chq-pub-headshot-fallback`
76px/64px, `.chq-pub-speaker-grid img, .chq-pub-headshot-fallback` 100% of a
>=~106px tile, both co-styled with an `img` element selector in the same
rule) — never the flex+padding grammar this instrument checked before wave
34, because there is no text content to centre or pad around. DESIGN-
RULINGS.md's 44px floor is about the HIT BOX, which a sized replaced-content
box satisfies without flex/padding at all; the gap was in THIS instrument's
grammar, not a real 44px defect. Wave 34 built the second tier the previous
wave named as its first option: a companion co-styled with an `img` element
selector (derived from the sheet's own rules, never a hand-listed
allowlist) is judged on its own merged width/height rules reaching >=44px on
both axes, independent of flex/padding. `.chq-pub-headshot-fallback`'s
merged rules carry an explicit `width:76px; height:76px` (the list-view
size), which alone clears both axes, so the row now resolves VERIFIED. The
new tier is guarded by two negative controls in the scan itself (a
replaced-content companion sized 40px still grades FALSE-PREMISE; a
text-bearing companion with no `img` pairing and no flex/padding still
grades FALSE-PREMISE even when sized >=44px), so it cannot silently pass a
real text-control defect through the replaced-content door.

## Wave 39 (task w39-a, DEC-393 wave-39 amendment): the `scoped` row's premise repaired

`TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` was the campaign's last non-zero
exit-predicate row with no in-flight owner. Its single offender —
`app/src/pages/contacts/contacts.css:596`'s `scoped` receipt above
`.chq-contacts-drawer-actions-right` — was FALSE-PREMISE not because the
receipt's underlying claim was wrong (the row genuinely renders only
`.chq-btn`-classed `<button>` children, never a bare anchor) but because
the receipt named the WRONG class as the floored companion:
`.chq-contacts-drawer-actions`, a pure flex wrapper with no min-height or
padding declaration of its own. The real floor is one level down, on
`.chq-btn`: its shared base rule (`display:inline-flex;
align-items:center; padding:10px 16px`, `app/src/styles.css`) plus this
file's own phone-media override
(`.chq-contacts-drawer-actions-right .chq-btn { min-height:48px; padding:0
16px; ... }`) together clear the 44px floor on both axes.

Repair chosen: **option (a)** — re-point the receipt's `scoped to` clause
at `.chq-btn`, the selector that actually carries the floor, rather than
teaching the companion predicate to walk descendants transitively (option
(b)). The receipt at `contacts.css` (immediately above
`.chq-contacts-drawer-actions-right`) now names `.chq-btn` as the
companion; re-measured by forcing the ceiling to `-1` and reading the
roster back, the row resolves **VERIFIED** and the FALSE-PREMISE count
drops to **0**. `TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING` (77) is
unaffected — this repair only changed which verdict one already-checkable
row reaches, not which rows this instrument can check.

`TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` moves **1 -> 0**. The sibling
receipt above `.chq-contacts-drawer-actions` itself (line ~581, pinned by
`app/src/styles-tier2-anchor-floor.test.ts` and
`app/src/pages/contacts/contacts-phone-floor.test.ts`) was NOT touched —
its own premise (`.chq-btn` carries the shared phone floor) was already
true.

## Full roster (98 rows)
## Full roster (98-row wave-30 snapshot; NOT regenerated wave-to-wave except for rows a given wave's own task changed — the population is 101 as of wave 40, see "Verdict counts" above; the two rows wave 40 changed are updated in place below, the rest is historical)

| Verdict | Family | File:line | Detail |
|---|---|---|---|
| ~~FALSE-PREMISE~~ **VERIFIED (wave-39)** | scoped | `app/src/pages/contacts/contacts.css:596` | wave-36 point-in-time: companion .chq-contacts-drawer-actions found (6 rule(s), merged) but does not satisfy the 44px-floor grammar. SUPERSEDED wave-39: receipt re-pointed at .chq-btn (the class that actually carries min-height:48px + centred flex + non-zero horizontal padding, merged across app/src/styles.css's base rule and this file's phone-media override); now resolves VERIFIED. |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/agenda/agenda.css:1003` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/content/content.css:76` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/overview/overview.css:429` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/review/review.css:90` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/speakers/speakers.css:1313` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/speakers/speakers.css:1876` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `src/routes/public/css/agenda.css.ts:768` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `src/views/error-states.css.ts:72` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/portal/tasks/views.tsx:314` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts:51` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts:135` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts:480` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:625` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:783` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:924` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:950` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/views/theme.ts:620` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/views/theme.ts:670` | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | modifier | `src/views/error-states.css.ts:46` | element-type tier: named element type(s) fieldset are not reached by any rule declaring min-height:44px anywhere in the tree |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:158` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:228` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:250` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:670` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:1235` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:2268` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts-panels.css:295` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts-panels.css:997` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts.css:581` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:23` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:143` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:432` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:504` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:671` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:761` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:879` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:908` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/forms/forms.css:348` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/forms/forms.css:361` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css:148` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css:564` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css:608` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:316` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:331` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1268` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1303` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1533` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1574` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1691` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1793` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/scorecard.css:98` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/settings/settings.css:2583` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/speakers/task-view.css:284` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:269` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:378` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:731` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:27` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:206` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:403` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:620` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:1157` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:997` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1365` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1388` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1444` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1704` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1772` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1948` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:2879` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/portal/portal.css.ts:102` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/portal/portal.css.ts:359` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/css/chrome.css.ts:36` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/css/rail.css.ts:671` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/home.css.ts:152` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/views/theme.ts:538` | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| VERIFIED | scoped | `app/src/pages/submissions/detail.css:278` | self-scoped tier: the receipted selector's own class .chq-link-button declares the 44px floor (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/agenda/agenda.css:1121` | companion .chq-phone-footer-actions declares min-height:44px + centred flex + non-zero horizontal padding (merged across 4 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/content/content.css:60` | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/overview/overview.css:404` | companion .chq-overview-link-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 9 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/overview/overview.css:457` | companion .chq-overview-link-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 9 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/speakers/speakers.css:2034` | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/speakers/speakers.css:2071` | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/docs-site.css.ts:215` | companion .chq-docs-article-title declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/portal/portal.css.ts:265` | companion .chq-portal-standalone-link declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/public/css/agenda.css.ts:584` | companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/public/css/agenda.css.ts:817` | companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/public/css/cards.css.ts:239` | companion .chq-pub-headshot-fallback is a replaced-content box (co-styled with an img selector) whose own width/height rules put both axes at >=44px (merged across 4 rule(s)) and appears in real markup |
| VERIFIED | inline | `src/routes/public/css/agenda.css.ts:796` | companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/routes/docs-site.css.ts:98` | companion .chq-docs-nav-link declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/routes/docs-site.css.ts:513` | companion .chq-docs-nav-link declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/views/theme.ts:461` | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/views/theme.ts:486` | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css:280` | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-cell-btn does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css:440` | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-noroom-btn does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css:478` | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-cell-btn-clash does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css:534` | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-clash-item does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css:693` | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions SessionCard; tier (ii): .chq-session-card does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css:777` | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions SessionCard; tier (ii): .chq-session-card-conflict does not appear in either live 390 roster |

