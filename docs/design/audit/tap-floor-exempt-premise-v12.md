# tap-floor-exempt receipt premise audit (DEC-393 wave-30 amendment; second floor-grammar tier wave-34; three predicate-less families wave-36; two more floor-grammar tiers wave-40; ANCHORLESS-CONTAINER tier wave-44)

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
  markup); `src/views/error-states.css.ts` (line 46) stays **UNVERIFIABLE-PREMISE**
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
  see the "Wave 39" section below. `app/src/pages/submissions/detail.css` (line 278)
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

- `src/views/error-states.css.ts` (line 46) **stays UNVERIFIABLE-PREMISE**.
  `input`/`select`/`textarea` are each reached by `theme.ts`'s own bare-type
  phone-media rule (`min-height: 44px`); `fieldset` is reached by NO rule
  anywhere in the tree — a `<fieldset>` is a grouping container, never
  itself a tap target, and the only "fieldset ... 44px" match in the tree
  (`app/src/pages/settings/settings.css`'s `.chq-settings-panel fieldset
  label { min-height: 44px }`) floors the LABEL, one level down, which the
  arm-exact grammar correctly refuses to credit to `fieldset` itself. This
  is an honest gap: the receipt's own premise is broader than the tree
  supports, not an instrument miss.
- `app/src/pages/submissions/detail.css` (line 278) **now resolves VERIFIED**. Its
  receipted selector is the compound `.chq-detail-participant-row-actions
  .chq-link-button`; the reason names only the container (already in
  `receiptedClasses`, so the pre-wave-40 companion search found nothing
  distinct), but the OTHER receipted class — `.chq-link-button` — carries a
  real floor in `app/src/styles.css`'s phone-media block (`min-height:44px;
  min-width:44px; display:flex; align-items:center; padding:0 6px;`), a
  sheet this receipt's own file never touches. (The same file's own
  `v12m-w6-h` comment at `detail.css` (line 1224) had already noted, for a
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
  built for "no bare anchor" instead of "never mounts" as of wave 40; wave
  44 below builds exactly this tier), "a visually-hidden
  input's operable target is its `<label>`" (`comms.css` (line 158),
  `content.css` (line 432), `portal.css.ts` (line 361), `speakers/task-view.css` (line 284) —
  several already NAME the label's own `.chq-*` class, e.g. `.chq-check-hit`,
  which the EXISTING companion floor-grammar could check today if this
  shape got its own recognised family), "an empty `<th>` spacer, no
  children at all" (`content.css` (line 879), `settings.css` (line 2583),
  `styles.css` (line 1444)), and a handful naming a companion this instrument's
  first-word regex simply does not recognise yet (`comms.css` (line 1235),
  `comms.css` (line 2268), `contacts-panels.css` (line 997), `overview.css` (line 148),
  `overview.css` (line 608), `review.css` (line 331), `review.css` (line 1574),
  `review.css` (line 1793), `submissions.css` (line 27), `submissions.css` (line 206),
  `styles.css` (line 1365), `styles.css` (line 1388), `styles.css` (line 1704),
  `content.css` (line 908), `theme.ts` (line 538), `chrome.css.ts` (line 36)).
- **6 of 55 are grounded only in a design/scope authority**, not a
  tree-checkable fact — no scan, however widened, could settle them, because
  the claim is a value or priority judgement: `styles.css` (line 1772) (enlarging
  the colour-swatch grid to 44px "is a distinct visual-redesign task, out of
  scope … tracked as a follow-up"), `styles.css` (line 1948) (the 18px checkbox
  glyph's own size is deliberately unchanged; "enlarging it is a
  system-wide redesign"), `overview.css` (line 564), `styles.css` (line 2879),
  `src/routes/public/css/rail.css.ts` (line 671) and `src/routes/public/home.css.ts:
  152` (four aesthetic/typography calls: flooring an inline phrase would
  "break the line box," each without naming a companion an instrument could
  check instead). These six are the honest, un-shrinkable gap — grounded in
  human design judgement (DESIGN-RULINGS.md/DEVIATIONS.md territory), not
  in anything this or any future tree scan could verify true or false.

This sort is NOT built into the instrument (it changes no verdict, no
ceiling) — it is recorded here, by hand, as the honest classification the
task asked for, left open for a future wave to decide which of the 49 are
worth a fourth tier.

## Wave 44 (task w44-e, DEC-393 wave-44 clause (a)): the ANCHORLESS-CONTAINER tier

The wave-40 section above named the largest of the two buckets it read by
hand in the `other` family: "≈30 receipts" stating "renders only `<button>`
children, never a bare anchor" — a render-FACT claim about the markup, which
none of the CSS-selector-searching tiers built through wave 40 have anything
to say about (they all search `allChunks`, a flat list of CSS rule
selector/body pairs; this claim is about JSX children, not a companion
selector). This wave adds a fifth tier, `judgeContainerAnchorAbsence`,
gated by a textual predicate (`isContainerAnchorAbsenceCandidate`) over the
`other` family's own reason text — never the family label alone, which
every prior wave's tiers already outgrew — that recognises the shape
("no anchor", "never a bare `<a>`/`<Link>`", "renders only `<button>`
...") while excluding several OTHER shapes the same vocabulary also
produces in this population: the receipted token itself rendering AS an
anchor elsewhere (`theme.ts`'s `.chq-wordmark`, `overview.css`'s deadline-
cell `<Link>`, `portal.css.ts`'s `.chq-wordmark` `<span>` twin), a native-
control label/`htmlFor` association ("the label is the click/tap anchor"),
an ancestor-visibility claim (a `<thead>` set to `display:none`), or a
purely decorative-sizing claim (a checkbox/radio glyph, a colour swatch, a
`.chq-pill`) that says nothing about anchors at all.

Unlike every tier above, this one does not search CSS at all: it walks the
real JSX/TSX **markup corpus** (`test/frame-source-corpus.ts`'s
`enumerateSourceFiles` + `stripComments` — DEC-613, the same enumerator and
comment stripper every frame-label ledger already shares, never a second
copy). It locates the receipted class as a literal `className`/`class`
word, walks it to its own BALANCED matching close tag via a hand-rolled
brace/quote-aware tag scanner (a `[^>]*>` regex would misread the `>` in a
JSX handler like `onClick={() => onSelect(item.id)}` as the tag's own
close; the scanner instead tracks brace depth and quote state
character-by-character, invisible to an embedded `>`), and inspects every
`<a`/`<Link`/`<NavLink` strictly inside. The scanner also recurses into
every visited tag's OWN `attrsText` — this codebase's `<ModalFrame
actions={<>...</>} ...>` render-prop idiom puts real, rendered JSX inside a
`{...}` ATTRIBUTE VALUE, invisible to a walk that only ever jumps forward
by a tag's own end.

VERIFIED when no anchor is found inside, or every one found carries
`.chq-btn`/`.chq-link-button` (this codebase's two floored button-styled-
anchor classes — see `review.css`'s PlanList worked example: "Export
results CSV" `<a className="chq-btn chq-btn-secondary">` and "New plan"
`<Link className="chq-btn chq-btn-primary">`, both `chq-btn`-styled).
FALSE-PREMISE the moment a bare anchor carrying neither class is found
inside — a real 44px-floor gap, and it raises
`TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` rather than being softened into
UNVERIFIABLE, exactly the point of building a real predicate instead of
leaving these 37 receipts in the `other` bucket forever. UNVERIFIABLE-
PREMISE only when the receipted class token appears nowhere in the markup
corpus at all (`app/src/pages/forms/forms.css`'s
`.chq-forms-field-modal-actions-right` receipt resolves this way on the
FIRST pass, before the render-prop recursion above was added — it is only
reachable inside `FieldModal.tsx`'s `<ModalFrame actions={...}>` call).

Forced to `-1` and re-measured standalone (never by arithmetic on the
wave-40 base, the exact trap DEC-808 warns against): bucketing the 55
`other`-family reasons by their own text found **37** stating this
checkable premise — the 32 the task named (across `content.css`,
`review.css`, `submissions.css`, `styles.css`, `detail.css`, `comms.css`,
`contacts.css`, `forms.css`, `scorecard.css`) plus 5 more the same textual
gate legitimately admits (`contacts-panels.css` `:295`/`:997`,
`overview.css`'s deadline-cell receipt, `settings.css`'s `<th>`-only
column-width receipt). All 37 resolve **VERIFIED** against the real
markup corpus, including the `forms.css` render-prop-nested one above.
`UNVERIFIABLE-PREMISE` moves **77 -> 40**. `FALSE-PREMISE` stays **0**: no
bare, unfloored anchor was found inside any of the 37 real containers this
tier can now check — the whole population it resolves was already a true
premise, not a defect this wave discovered.

Both falsifiability controls this tier's siblings all carry ship in the
scan file itself, run through the REAL matcher via dependency injection
(a synthetic `MarkupFile[]` corpus, never a re-implementation): a
container holding only `.chq-btn`-classed buttons resolves VERIFIED; the
same container with one bare `<a>` added resolves FALSE-PREMISE.

## Verdict counts

Wave 44 (task w44-e): re-measured directly (never by arithmetic), the
population has grown to **104** receipts (intervening waves' worth of
new/edited receipts since wave 40's 101-receipt snapshot).

| Verdict | Count | Meaning |
|---|---|---|
| VERIFIED | 64 | the receipt names a companion (or, for `render-gate`, a gated component) whose premise this instrument can check and which checks out: (1) a real min-height:44px + centred flex (`flex`/`inline-flex`) + non-zero horizontal padding rule (merged across every rule mentioning it), or (2) wave-34's replaced-content tier (co-styled with an `img` element selector, own width/height >=44px on both axes), or (3) wave-36's `render-gate` two-tier predicate (named, existing receipt test that mentions the component; AND the selector token absent from both live 390 rosters), or (4) wave-40's ELEMENT-TYPE tier (every named bare element type reached by a min-height:44px arm) or SELF-SCOPED tier (any of the receipted selector's own classes reaches the floor grammar), or (5) wave-44's ANCHORLESS-CONTAINER tier (the receipted class's real markup holds no anchor, or only `.chq-btn`/`.chq-link-button`-classed ones). |
| UNVERIFIABLE-PREMISE | 40 | this wave's instrument cannot express a check for the receipt — either its reason family (`other`) has no predicate yet (and does not match the wave-44 anchorless-container shape either, or matches it but the receipted class is absent from the whole markup corpus), a `composition`/`inline-*`/`modifier`/`scoped` reason names no companion class distinct from the receipted selector itself (and, for `modifier`, names no element-type list either, or names one with an unreached type), or a `render-gate` reason names no existing/component-mentioning receipt test. Per DEC-393 wave-30 clause (c): a roster row, not a silent pass. |
| FALSE-PREMISE | 0 (was 1 through wave 36; repaired wave 39, see below) | the receipt named a companion class (or, for `scoped`, one of its own receipted classes) that is real but does NOT carry the floor-grammar tier this instrument checks for (`app/src/pages/contacts/contacts.css`, see wave-36 section above) — a real predicate-grammar defect; the wave-39 section below repairs the receipt in place and the row now resolves VERIFIED. |

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
`app/src/pages/contacts/contacts.css` (line 596)'s `scoped` receipt above
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
## Full roster (98-row wave-30 snapshot; NOT regenerated wave-to-wave except for rows a given wave's own task changed — the population is 104 as of wave 44, see "Verdict counts" above; the two rows wave 40 changed and the 37 rows wave 44 changed are updated in place below, the rest is historical)

| Verdict | Family | File:line | Detail |
|---|---|---|---|
| ~~FALSE-PREMISE~~ **VERIFIED (wave-39)** | scoped | `app/src/pages/contacts/contacts.css` (line 596) | wave-36 point-in-time: companion .chq-contacts-drawer-actions found (6 rule(s), merged) but does not satisfy the 44px-floor grammar. SUPERSEDED wave-39: receipt re-pointed at .chq-btn (the class that actually carries min-height:48px + centred flex + non-zero horizontal padding, merged across app/src/styles.css's base rule and this file's phone-media override); now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-51)** | composition | `app/src/pages/agenda/agenda.css` (line 1003) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-51: the bare-token companion tier resolves `chq-btn`, named in prose without a leading dot (obeying the desktop-control-floor scan's own comment grammar); companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `app/src/pages/content/content.css` (line 76) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-pill`, merged across every matching rule (the shell's element-qualified `a.chq-pill` rule in `app/src/styles.css`) already satisfying min-height:44px + centred flex + non-zero horizontal padding; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-51)** | composition | `app/src/pages/overview/overview.css` (line 429) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-51: the bare-token companion tier resolves `chq-overview-link-btn`, named in prose without a leading dot; companion .chq-overview-link-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 9 rule(s)) and appears in real markup; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `app/src/pages/review/review.css` (line 90) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-pill`, merged across every matching rule (the shell's element-qualified rule in `app/src/styles.css`), already satisfying the 44px-floor grammar; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `app/src/pages/speakers/speakers.css` (line 1313, now 1322) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-speakers-name-link`, merged across every matching rule, already satisfying the 44px-floor grammar (`.chq-row-title`'s shared base rule in `app/src/styles.css`); now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `app/src/pages/speakers/speakers.css` (line 1876, now 1885) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-pill`, merged across every matching rule (the element-qualified rule speakers renders `.chq-pill` through), already satisfying the 44px-floor grammar; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-51)** | composition | `src/routes/public/css/agenda.css.ts` (line 768) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-51: the bare-token companion tier resolves `chq-pub-day-pill`, named in prose without a leading dot; companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `src/views/error-states.css.ts` (line 72) | wave-30 point-in-time: no companion class named in the reason. SUPERSEDED wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-error-summary-link`, merged across every matching rule, already satisfying the 44px-floor grammar; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `src/routes/portal/portal.css.ts` (line 576) | not in the 98-row wave-30 snapshot (receipt added by task v12m-w40-e: a new `composition` receipt on `.chq-cfp-option`, mirroring `cfp.css.ts`'s identical twin, naming no companion class — added directly as UNVERIFIABLE-PREMISE). wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-cfp-option`, merged across every matching rule (the shared floored `label.chq-cfp-option` wrapper, min-height:46px + centred flex + non-zero horizontal padding), already satisfying the 44px-floor grammar; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | composition | `src/routes/public/cfp.css.ts` (line 158) | not in the 98-row wave-30 snapshot (receipt added by task v12m-w40-e, `.chq-cfp-option`'s own twin of the `portal.css.ts` receipt above, same reasoning, added directly as UNVERIFIABLE-PREMISE). wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class `.chq-cfp-option`, merged across every matching rule, already satisfying the 44px-floor grammar; now resolves VERIFIED. |
| ~~UNVERIFIABLE-PREMISE~~ **VERIFIED (wave-54)** | inline | `src/routes/public/cfp.css.ts` (line 503) | wave-44 point-in-time: the true UNVERIFIABLE-PREMISE survivor of that wave's repair pass — the pending-existing-contact state's "Already have a password? Log in ›" classless-anchor CSS rule, whose own selector's `:not(.chq-btn)` clause makes `chq-btn` a self-token rather than a usable companion. wave-54: the self-floored tier (rung 0) resolves the receipt's OWN receipted class(es), merged across every matching rule in the swept corpus (this rule's own phone-media block, min-height:44px + display:inline-flex + align-items:center + padding:0 2px, `cfp.css.ts:344`), already satisfying the 44px-floor grammar; now resolves VERIFIED. |
| UNVERIFIABLE-PREMISE | inline | `src/routes/portal/tasks/views.tsx` (line 314) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts` (line 51) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts` (line 135) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts` (line 480) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx` (line 625) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx` (line 783) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx` (line 924) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx` (line 950) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/views/theme.ts` (line 620) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/views/theme.ts` (line 670) | no companion class named in the reason (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | modifier | `src/views/error-states.css.ts` (line 46) | element-type tier: named element type(s) fieldset are not reached by any rule declaring min-height:44px anywhere in the tree |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css` (line 158) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css` (line 228) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css` (line 250) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css` (line 670) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css` (line 1235) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css` (line 2268) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts-panels.css` (line 295) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts-panels.css` (line 997) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts.css` (line 581) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 23) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 143) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 432) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 504) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 671) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 761) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 879) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css` (line 908) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/forms/forms.css` (line 348) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/forms/forms.css` (line 361) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css` (line 148) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css` (line 564) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css` (line 608) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 316) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 331) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 1268) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 1303) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 1533) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 1574) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 1691) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css` (line 1793) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/scorecard.css` (line 98) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/settings/settings.css` (line 2583) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/speakers/task-view.css` (line 284) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css` (line 269) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css` (line 378) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css` (line 731) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css` (line 27) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css` (line 206) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css` (line 403) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css` (line 620) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css` (line 1157) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 997) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 1365) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 1388) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 1444) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 1704) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 1772) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 1948) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css` (line 2879) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/portal/portal.css.ts` (line 102) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/portal/portal.css.ts` (line 359) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/css/chrome.css.ts` (line 36) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/css/rail.css.ts` (line 671) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/home.css.ts` (line 152) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| UNVERIFIABLE-PREMISE | other | `src/views/theme.ts` (line 538) | reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c)) |
| VERIFIED | scoped | `app/src/pages/submissions/detail.css` (line 278) | self-scoped tier: the receipted selector's own class .chq-link-button declares the 44px floor (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/agenda/agenda.css` (line 1121) | companion .chq-phone-footer-actions declares min-height:44px + centred flex + non-zero horizontal padding (merged across 4 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/content/content.css` (line 60) | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/overview/overview.css` (line 404) | companion .chq-overview-link-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 9 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/overview/overview.css` (line 457) | companion .chq-overview-link-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 9 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/speakers/speakers.css` (line 2034) | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | composition | `app/src/pages/speakers/speakers.css` (line 2071) | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/docs-site.css.ts` (line 215) | companion .chq-docs-article-title declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/portal/portal.css.ts` (line 265) | companion .chq-portal-standalone-link declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/public/css/agenda.css.ts` (line 584) | companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/public/css/agenda.css.ts` (line 817) | companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | composition | `src/routes/public/css/cards.css.ts` (line 239) | companion .chq-pub-headshot-fallback is a replaced-content box (co-styled with an img selector) whose own width/height rules put both axes at >=44px (merged across 4 rule(s)) and appears in real markup |
| VERIFIED | inline | `src/routes/public/css/agenda.css.ts` (line 796) | companion .chq-pub-day-pill declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/routes/docs-site.css.ts` (line 98) | companion .chq-docs-nav-link declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/routes/docs-site.css.ts` (line 513) | companion .chq-docs-nav-link declares min-height:44px + centred flex + non-zero horizontal padding (merged across 2 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/views/theme.ts` (line 461) | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | modifier | `src/views/theme.ts` (line 486) | companion .chq-btn declares min-height:44px + centred flex + non-zero horizontal padding (merged across 86 rule(s)) and appears in real markup |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css` (line 280) | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-cell-btn does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css` (line 440) | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-noroom-btn does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css` (line 478) | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-cell-btn-clash does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css` (line 534) | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions DayGrid; tier (ii): .chq-day-grid-clash-item does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css` (line 693) | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions SessionCard; tier (ii): .chq-session-card does not appear in either live 390 roster |
| VERIFIED | render-gate | `app/src/pages/agenda/agenda.css` (line 777) | tier (i): app/src/pages/agenda/agenda-render-gate.receipt.test.ts exists and mentions SessionCard; tier (ii): .chq-session-card-conflict does not appear in either live 390 roster |


## Wave 51 (task w51-b, DEC-393/DEC-808): bare-token companion tier drains TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING

Root cause (DEC-393 wave-51): `test/tap-floor-exempt-premise/judge.ts`'s
`mentioned` extraction only ever matched a DOT-prefixed companion
(`/\.(chq-[\w-]+)/g`). The sibling desktop-control-floor scan
(`src/routes/public/cfp.css.ts`, verbatim) forbids a dot-prefixed class name
inside CSS-comment prose: "the desktop-control-floor scan reads comment text
as part of the following rule's raw selector, so a dot-prefixed class name in
prose here would get credited a min-height it never declared". A
`composition`-family receipt obeying that rule therefore names its companion
as a BARE token -- invisible to the dot-only extractor, which routed it to
the generic "no companion class named" UNVERIFIABLE-PREMISE fallthrough even
though the reason genuinely names a real, checkable companion.

Mechanism: `judgeReceipt`'s existing tail (tokenRe / matchingChunks / merged
bodies / flexFloored || widthHeightFloored / present-in-markup) was factored
out into `judgeCompanionFloor`, unchanged in behavior (DEC-613: no second
copy). A new `judgeBareTokenCompanion` tier runs ONLY at the existing
no-companion fallthrough, AFTER `judgeElementTypeReason` and after the
`scoped` -> `judgeSelfScoped` branch, scoped to `family === "composition"`
only, matches bare `chq-[\w-]+` tokens not already dot-prefixed, drops any
token already in `receipt.receiptedClasses`, and resolves the first survivor
through the unchanged `judgeCompanionFloor` path.

The tier is scoped to `composition` only, not every family reaching the
fallthrough: the sibling `inline` family's reasons routinely CITE a class
name in prose (e.g. tying a receipt to its own DEVIATIONS.md §10 entry by the
exempted anchor's class name) without asserting that class is a floored
companion. An unscoped first pass of this tier misread five `inline-in-prose`
citations as companion candidates and produced false FALSE-PREMISE rows: two
in `src/routes/public/cfp.css.ts` (the intro-cta and identity-note
`inline-in-prose` receipts) plus a third `chq-btn-primary` citation later in
the same file, one in `src/routes/public/submit-views.tsx` (the identity-note
JSX comment), and one in `src/views/theme.ts` (the docs Authentication
section's `inline-in-prose` receipt) -- confirmed false, reverted, and the
tier restricted to `family === "composition"` before landing.

Before/after (forced to `-1` and re-measured; the true live baseline at this
wave's HEAD is 37, not the stale 40 the prior ceiling constant carried --
population drift since wave-44's snapshot, re-derived rather than inherited
per DEC-808):

| Verdict | Before (37 UNVERIFIABLE) | After (34 UNVERIFIABLE) |
|---|---|---|
| UNVERIFIABLE-PREMISE | 37 | 34 |
| VERIFIED | 66 | 69 |
| FALSE-PREMISE | 0 | 0 |

Three rows moved from UNVERIFIABLE-PREMISE to VERIFIED (updated in place in
the roster table above, `app/src/pages/agenda/agenda.css` line 1003/1006,
`app/src/pages/overview/overview.css` line 429, and
`src/routes/public/css/agenda.css.ts` line 768/775 -- the doc's wave-30
snapshot line and this wave's re-measured line, one wave of drift apart):

- `app/src/pages/agenda/agenda.css` -- bare-token companion `chq-btn`
- `app/src/pages/overview/overview.css` -- bare-token companion
  `chq-overview-link-btn`
- `src/routes/public/css/agenda.css.ts` -- bare-token companion
  `chq-pub-day-pill`

`TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING` moves 40 -> 34.
`TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` stays 0 -- the widened reader
surfaced no real 44px-floor defect this wave.

## Wave 54 (task w54-g, DEC-393 wave-54 amendment): self-floored tier (rung 0) drains TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING

Root cause: the audit roster's `composition`/`inline`/`modifier` rows
falling to the generic "no companion class named in the reason (distinct
from the receipted selector itself)" fallthrough include several whose
reason states the receipt's OWN receipted selector already carries the
44px floor (a shared/element-qualified rule the receipt's own class
matches directly) rather than naming a separate companion class at all --
the instrument had no predicate for that shape and rostered every one of
them UNVERIFIABLE-PREMISE, even though the underlying premise ("this
control is already floored") is directly checkable against the tree.

The sibling `inline-prose-exemption-premise` instrument
(`test/inline-prose-exemption-premise.scan.test.ts`) already closed this
exact gap for its own population in wave 52 (`selfFloored`,
`INLINE_PROSE_UNVERIFIABLE_CEILING` 1 -> 0). Ported unchanged: a new
`judgeSelfFloored` (`test/tap-floor-exempt-premise/self-floored.ts`) checks
whether the receipt's own `receiptedClasses` tokens -- merged across every
rule in the swept corpus that mentions them, via the EXISTING
`tokenReachesFloor` helper `judgeSelfScoped` already uses (DEC-613: no
second copy of the merge-and-test grammar) -- already satisfy the full
floor grammar. Wired into `judgeReceipt` immediately after the
`render-gate` dispatch, before the companion-name extraction and before the
generic no-companion fallthrough -- the same position the inline sibling's
rung 0 occupies -- for every family EXCEPT `scoped`, which keeps its own
strictly-superset tier (`judgeSelfScoped`: the identical merged-floor check
plus a present-in-markup requirement this port does not impose, so the two
tiers are never a duplicate judging the same premise for the same family).

Forced to `-1` and re-measured standalone (never by arithmetic on the
wave-51 base of 34 -- the exact trap this constant's own comment history
already records falling into once):

| Verdict | Before (34 UNVERIFIABLE) | After (26 UNVERIFIABLE) |
|---|---|---|
| UNVERIFIABLE-PREMISE | 34 | 26 |
| VERIFIED | 69 | 77 (approx., population count carries forward unchanged) |
| FALSE-PREMISE | 0 | 0 |

Eight rows moved from UNVERIFIABLE-PREMISE to VERIFIED via the self-floored
tier (updated in place in the roster table above):

- `app/src/pages/content/content.css` (line 76) -- own class `.chq-pill`
- `app/src/pages/review/review.css` (line 90) -- own class `.chq-pill`
- `app/src/pages/speakers/speakers.css` (line 1313, now 1322) -- own class
  `.chq-speakers-name-link`
- `app/src/pages/speakers/speakers.css` (line 1876, now 1885) -- own class
  `.chq-pill`
- `src/views/error-states.css.ts` (line 72) -- own class
  `.chq-error-summary-link`
- `src/routes/portal/portal.css.ts` (line 576) -- own class
  `.chq-cfp-option` (not in the 98-row wave-30 snapshot; added by task
  v12m-w40-e, DEC-393 wave-40)
- `src/routes/public/cfp.css.ts` (line 158) -- own class `.chq-cfp-option`
  (not in the 98-row wave-30 snapshot; added by task v12m-w40-e, DEC-393
  wave-40, the `.chq-cfp-option` receipt's own twin of the `portal.css.ts`
  row above)
- `src/routes/public/cfp.css.ts` (line 503) -- own class
  `.chq-cfp-confirm-actions`, the wave-44 audit's own recorded true
  UNVERIFIABLE-PREMISE survivor (the pending-existing-contact
  "Already have a password? Log in ›" anchor, whose selector's
  `:not(.chq-btn)` clause makes `chq-btn` a self-token rather than a usable
  companion) -- resolved not via a companion at all but by its own
  receipted selector's phone-media rule (`cfp.css.ts:344`: min-height:44px
  + display:inline-flex + align-items:center + padding:0 2px)

`TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING` moves 34 -> 26.
`TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` stays 0 -- the new tier resolved
every self-floored candidate VERIFIED; none newly resolves as a false
self-floor claim, so no ceiling was raised and no new finding is recorded
here.

### Finding for a later wave (not repaired in this lane, per DEC-393 wave-30 clause "do not repair product CSS in that lane")

None. Draining this ceiling turned up no `FALSE-PREMISE` row -- every
receipt the self-floored tier could resolve this wave was a TRUE premise
(the control really is already floored by its own class), not a defect the
instrument had been silently missing.

## Wave 56 (task w56-e, DEC-613): the `inline` family gets the grader it already has a sibling for

Root cause: the audit roster's `inline` family (`inline-in-prose` receipts)
falls to this instrument's own generic "no companion class named in the
reason" fallthrough exactly like `composition`/`modifier`, and the wave-30
predicate has no rung for it -- but a SIBLING instrument
(`test/inline-prose-exemption-premise.scan.test.ts`, its
`judgeInlineReceipt`) already resolves the identical `inline-in-prose`
population to completion, through a self-floored rung, a named-companion
rung, and a rung-3 DEVIATIONS.md-grounding rung, with BOTH of its own
ratchets (`INLINE_PROSE_UNGROUNDED_CEILING`, `INLINE_PROSE_UNVERIFIABLE_CEILING`)
reading 0. Two instruments, one population, opposite verdicts, both green.

Mechanism: `judgeInlineReceipt` and the helpers it needs (`selfFloored`,
`judgeByDeviation`, `parseDeviationsSections`, the `InlineReceipt`/
`InlineRosterRow`/`DeviationSection` types, `allInlineReceipts`) moved out of
`test/inline-prose-exemption-premise.scan.test.ts` into a new sibling module
directory, `test/inline-prose-exemption-premise/` (`receipts.ts` +
`judge.ts`) -- the exact decomposition idiom `test/tap-floor-exempt-premise/`
already uses -- and are re-imported into the original scan test, which is
byte-equivalent in behavior and still green (verified standalone before
wiring anything new). A new tier, `judgeInlineTier`
(`test/tap-floor-exempt-premise/inline-tier.ts`, its own file for the same
reason every other tier here gets one: direct unit-testability), is wired
into `test/tap-floor-exempt-premise/judge.ts`'s `judgeReceipt` at the
existing no-companion fallthrough, scoped to `family === "inline"` ONLY
(wave-51 already recorded that an UNSCOPED companion tier misread
`inline`-family reason prose as companion candidates and produced false
`FALSE-PREMISE` noise -- this tier never widens beyond the family the
sibling's own population sweep already targets). It calls
`judgeInlineReceipt` directly (never a second copy of its grammar, DEC-613)
and maps its four-verdict vocabulary onto this instrument's three:
`GROUNDED` / `GROUNDED-BY-DEVIATION` -> `VERIFIED` (naming the sibling
grader and the settling rung); `UNGROUNDED` -> `FALSE-PREMISE` (a real 44px
defect, never softened); `UNVERIFIABLE` -> `UNVERIFIABLE-PREMISE`,
unchanged.

Forced to `-1` and re-measured standalone (never as `26 - 7`, the exact trap
this constant's own comment history already records falling into twice):

| Verdict | Before (26 UNVERIFIABLE) | After (19 UNVERIFIABLE) |
|---|---|---|
| UNVERIFIABLE-PREMISE | 26 | 19 |
| VERIFIED | 77 (approx.) | 84 (approx., population count carries forward unchanged) |
| FALSE-PREMISE | 0 | 0 |

All 7 `inline`-family rows the wave-56 task named moved from
UNVERIFIABLE-PREMISE to VERIFIED, all via the sibling's rung-3
GROUNDED-BY-DEVIATION (updated in place in the roster table above):

- `src/routes/public/cfp.css.ts:51` -- cites DEVIATIONS.md's real §10
- `src/routes/public/cfp.css.ts:140` -- cites DEVIATIONS.md's real §10
- `src/routes/public/cfp.css.ts:532` -- cites DEVIATIONS.md's real §10
- `src/routes/public/submit-views.tsx:626` -- cites DEVIATIONS.md's real §10
- `src/routes/public/submit-views.tsx:794` -- cites DEVIATIONS.md's real §10
- `src/routes/tools.css.ts:73` -- cites DEVIATIONS.md's real §10
- `src/views/theme.ts:638` -- cites DEVIATIONS.md's real §10

(Two other `inline`-family receipts, `cfp.css.ts:503` and `theme.ts:694`,
were already VERIFIED before this wave via this instrument's own rung 0
self-floored tier -- that dispatch order is unchanged, so this wave's tier
never touches them.)

`TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING` moves 26 -> 19.
`TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING` stays 0 -- none of the 7 resolved
UNGROUNDED on the sibling grader; the whole `inline` residue this wave
drained was a true grounding claim, not a defect this wave discovered.

### Finding for a later wave (not repaired in this lane, per DEC-393 wave-30 clause "do not repair product CSS in that lane")

None. Draining this ceiling turned up no `FALSE-PREMISE` row from the
`inline` family -- every receipt the new tier could resolve this wave was a
TRUE grounding claim, not a defect the instrument had been silently
missing. The remaining 19 UNVERIFIABLE-PREMISE rows are entirely
`other`/`modifier` family rows this task did not touch.
