# Desktop drawn-floor v12 audit (task w7-db, DEC-393 wave-151 amendment; repaired task rb, DEC-393 wave-157 amendment; role-chip rows resolved task w17-b, DEC-393 wave-17; frame-content join widened task w27-b, DEC-393 wave-27; attribute/prop label tier task w28-b, DEC-393 + DEC-808 wave-28; digit-collapsed skeleton join + composed/absent split task w29-e, DEC-808 wave-29; States-swatch population exclusion + DEC-746 ruling-settled move task w33-e, DEC-651 wave-33)

Measured by `test/desktop-control-floor.scan.test.ts` on this branch. This
file MEASURES ONLY -- it changes no product CSS byte except the one
authorised byte wave-157's repair adds and the one appended byte wave-17
adds to `contacts-panels.css` (see "Offenders: 2" below), and desktop stays
otherwise frozen -- wave 27's widening changes zero product CSS bytes. See
that file's own header for the full population/join/grade methodology.

## Population

266 drawn controls across 12 of the 13 `docs/design/*.dc.html` files (108
desktop frames total; `Chautauqua Docs.dc.html` draws none of the qualifying
shape). Drawn-floor histogram: `min-height:46px` is the most common value
(200 of 266), well ahead of the ruled `min-height:44px` minimum (15 of 266)
-- the same shape DEC-393's wave-151 amendment's own census names for the
whole desktop population, confirmed again inside just the DRAWN-CONTROL
subset this scan grades.

**WAVE 33 (DEC-651) update:** 247 drawn controls, post-population-exclusion
-- see "WAVE 33" below. The `States · hover, pending, drag` swatch-panel
frame's 19 rows no longer enter this population at all; the 108-desktop-frame
count above is unaffected (that is `test/desktop-frame-ledger.scan.test.ts`'s
own, separate frame-level population -- see "WAVE 33" below for why the two
never collide).

## WAVE 157 REPAIR (DEC-393 amendment, task rb)

Wave-151's join resolved a row's tokens from the FIRST boundary-anchored
label match per source file, accepting a match whose enclosing tag merely
CONTAINED the label as a substring. Forcing `DESKTOP_FLOOR_DIVERGENCE_CEILING`
to `-1` on this branch and reading the printed offender list showed all 14
post-wave-155 offenders were wrong in one of two ways:

- **Twelve resolve only to typography/column-label registers.** The
  wave-155 "blessed eyebrow" rows (`.chq-portal-field-label`,
  `.chq-page-title`, `.chq-section-label`, plus two table-column-label
  classes) are real elements with no control face -- grading them OFFENDER
  at a declared 0px asserted a gap that does not exist. The join now grades
  a row UNRESOLVED (reason `no-control-shape`), not OFFENDER, when none of
  its resolved tokens' own top-level rules declare a border, a background,
  a padding-inline, or a min-height (a bare `border: none`/`background:
  none`/`transparent`/`0`/`0px` reset does not count -- see
  `app/src/pages/submissions/detail.css`'s `.chq-detail-section-title
  button { background: none; border: none; }` reset, a measured false
  positive this exclusion closes).
- **Two are MIS-ATTRIBUTED**, resolved to the wrong element entirely (see
  "Drained by the repair" and "The one genuine survivor" below).

The repair: resolve a row's tokens from EVERY boundary-anchored match
across the whole corpus (not just the first per file), kept only when the
enclosing tag's own text content -- not a containing text node -- is
EXACTLY the label (`ownTextEquals`). Combined with the control-shape gate
above.

### Drained by the repair (1 row -- "Back to sign in", no CSS moved)

`docs/design/Chautauqua Account.dc.html`:225 draws "Back to sign in" filled
at `min-height:46px`. The pre-repair join resolved it to `chq-auth-tertiary`
(declared 0px): `src/routes/auth-views.tsx`'s FIRST "Back to sign in"
occurrence is `<a className="chq-auth-tertiary">&lsaquo; Back to sign
in</a>` on the `ForgotPasswordPage`/`ExpiredResetPage` card -- a DIFFERENT
page's tertiary link, whose own rendered text is "‹ Back to sign in", not
"Back to sign in". The frame's real primary is `CheckEmailPage`'s `<a
className="chq-btn chq-btn-primary" href="/login">Back to sign in</a>` --
own text content exactly "Back to sign in", a LATER occurrence in the same
file the first-match join never reached. The repaired join finds both
occurrences, rejects the lsaquo-prefixed one (own text != label) and keeps
the plain one, resolving to `chq-btn`/`chq-btn-primary`. `chq-btn-primary`
declares no min-height in its own block, but the JOIN is context-blind by
design (a token-boundary match over the whole corpus, not a specificity-aware
cascade) and `src/views/bare-page.css.ts`'s `.chq-bare-page .chq-btn-primary,
.chq-bare-page button[type=submit] { min-height: 48px; ... }` mentions the
token in a compound selector, contributing 48px -- already >= the drawn
46px. Graded OK. No house register moved (`.chq-btn`, `.chq-btn-primary`,
`src/routes/auth.css.ts` all untouched, per this wave's own scope limits).

### The one genuine survivor (1 row -- "Waitlist", the one authorised CSS byte)

`docs/design/Chautauqua Submissions.dc.html`:314 draws "Waitlist" at
`min-height:44px` inside the "Submission detail · /submissions/:id" frame's
decision rail. The join resolves this row to `chq-overview-btn
chq-overview-btn-waitlist` (declared 0px) both before and after the repair:
`app/src/pages/Overview.tsx`:420's `<button className="chq-overview-btn
chq-overview-btn-waitlist">Waitlist</button>` is a real element whose own
text content is exactly "Waitlist" -- it passes the repaired join's
stricter test cleanly, it is simply the WRONG surface (Overview's queue-move
button, already phone-hidden with a wave-83 receipt, not this frame's
control). The real control this frame draws is
`app/src/pages/submissions/SubmissionDetailPage.tsx`'s decision rail:
`<button className="chq-btn chq-btn-secondary" ... aria-label={DECISION_ACTION_LABELS.waitlisted}>{decisionActionLabel('waitlisted')}</button>`
inside `<div className="chq-detail-decision-secondary-pair">` -- its own
rendered label is a JSX expression (`DECISION_ACTION_LABELS.waitlisted`,
`decisionActionLabel('waitlisted')`), never a literal "Waitlist" string in
a JSX text node, so no static own-text-match algorithm can relocate this
row's resolution to it. **This is the one row wave-157's algorithm repair
cannot fix by construction** -- fixed instead by the one authorised product
CSS byte: `app/src/pages/submissions/detail.css`'s
`.chq-detail-decision-secondary-pair .chq-btn` (already the pair's own
scoping rule, `flex: 1`) gains `min-height: 44px`, citing
`docs/design/Chautauqua Submissions.dc.html:314` `min-height:44px`. This
floors the REAL control the frame draws; the ledger's own count cannot
reflect that (the row still resolves to Overview's button, unaffected by a
rule scoped to `.chq-detail-decision-secondary-pair .chq-btn`, a different
token/selector entirely) -- `DESKTOP_FLOOR_DIVERGENCE_CEILING` was seeded at
the then-honest measured value (originally 3, below; wave 156 and wave 17
each independently fixed one of the other two rows in product code without
the ledger's join being able to see either fix, so the measured ceiling
fell to 2 without this offender count ever moving -- see "Offenders: 2"
below), never driven to 0 on the strength of a product fix this scan
cannot verify. `.chq-btn`, `.chq-btn-primary`, `.chq-btn-secondary` and
`src/routes/auth.css.ts` are untouched, per this wave's scope.

## WAVE 27 (DEC-393 amendment, task w27-b): stop grading frame content the label ledger already adjudicated

`test/desktop-control-label.scan.test.ts` (the WORDS ledger) already
hand-triages this exact pack's FIXTURE (mock/seed content wearing control
geometry) and COMPOSED (label assembled at render time, or already BLESSED
by `docs/design/DEVIATIONS.md`) rows, each entry asserted against the pack
by exact `file:line:label`. This scan (the FLOOR ledger) was grading the
SAME frame content a second, independent time -- landing 28 of its rows on
those very `FIXTURE_EXCLUSIONS`/`COMPOSED_EXCLUSIONS` file:line coordinates
and grading them UNRESOLVED without ever consulting the adjudication the
sibling ledger had already made. This wave adds `export` to both tables in
the label-ledger file (no other change there) and imports both into this
file (DEC-613: one triage table, not two) rather than forking a second copy
or re-triaging the same content independently. A drawn row landing on a
FIXTURE or COMPOSED `file:line` now grades `excluded` (a new fourth
`RowStatus`, alongside `ok`/`offender`/`unresolved`), carrying that table's
own reason string verbatim (prefixed `FIXTURE:`/`COMPOSED:` to say which
table it came from), instead of falling into `unresolved`. The join is keyed
on `fileName`+`line` only, not label: the two files compute a control's
"line" from different offsets within the same source line (this file walks
from the character immediately after the opening tag; the label ledger
walks from the matched text-node offset), so line is the safe, shared,
construction-proof key -- label text is not, since the two extractors can
legitimately phrase the same visual control's captured text slightly
differently.

**MEASURED** (this branch, forcing both ceilings to `-1` and reading the
printed lists): **28 rows drained from Unresolved into Excluded** (3 via
FIXTURE_EXCLUSIONS, 25 via COMPOSED_EXCLUSIONS) -- `UNRESOLVED` fell from
166 to **141** (130 `no-label-match`, 1 `no-token`, 10 `no-control-shape`,
unchanged from before this wave: every drained row was previously counted
`no-label-match`, since fixture/composed content is by definition content
the app's source never literally contains). **`OFFENDERS` is unchanged at
2** -- the widening's population (28 rows) and the two known
mis-attributions (`Chautauqua Contacts.dc.html`:602 "Reviewer" at line 602,
`Chautauqua Submissions.dc.html`:314 "Waitlist" at line 314) do not
intersect: neither offender's own `file:line` coordinate appears in either
exclusion table (the label ledger's nearest FIXTURE entry for Contacts sits
at line 603 -- a different control, "Guest", on an adjacent line -- and no
Submissions entry exists in either table at all). Both offender rows remain
exactly the mis-attributions described in "Offenders: 2" below; this wave
changes their grading population, not their verdict. `DESKTOP_FLOOR_DIVERGENCE_CEILING`
stayed `2` as of this wave (later lowered to `0` by wave 33, see "WAVE 33"
below); `DESKTOP_FLOOR_UNRESOLVED_CEILING` moved from `166` to `141` here
(later `131` as of wave 33), both re-measured directly (never read from this
prose). Not one product CSS byte changed this wave -- desktop stays frozen,
per this task's own scope.

The "Draining the no-label-match/no-token buckets is ... left to a later
wave" sentence in "Unresolved" below is now FALSE for the slice this wave's
widening covers (fixture/composed frame content) and is retired. **WAVE 29
UPDATE:** the residue this sentence once deferred is no longer open --
`test/desktop-control-floor.scan.test.ts`'s digit-collapsed skeleton join
plus its composed-literal/data-value/hand-verified dispositions (task w29-e,
DEC-808 wave-29) re-graded every remaining `no-label-match` row to a REAL
verdict (never re-parked as `unresolved`); see "WAVE 29" below for the full
measurement. There is no more "later wave's JOIN-technique work" left on this
bucket.

## Excluded: 28 (frame content already adjudicated by the label ledger; not a campaign ratchet -- see `test/desktop-control-label.scan.test.ts`)

28 of the 266 drawn-control rows land on a `file:line` coordinate the
sibling label ledger's `FIXTURE_EXCLUSIONS`/`COMPOSED_EXCLUSIONS` tables
already adjudicate as frame content the app is not expected to render
verbatim (mock/seed data wearing control geometry, or a label the app
composes/blesses rather than draws literally). 3 rows via FIXTURE (the
Contacts "Guest" role-pill mock option, the two Public-and-Portal CFP
track-picker fixture pills), 25 rows via COMPOSED (count-composed send/
import/merge buttons, DEVIATIONS-blessed plan-editor/confirm-dialog/import
patterns, the British/American "Organiser"/"Organizer" spelling variant,
etc. -- the full per-row list and each row's own reason is
`test/desktop-control-label.scan.test.ts`'s own `FIXTURE_EXCLUSIONS`/
`COMPOSED_EXCLUSIONS` tables, imported here verbatim, never re-listed).
`EXCLUDED` is not registered as a ratchet: it is not evidence of app
conformance or divergence, only a record that this ledger deferred to the
sibling ledger's existing adjudication of the SAME frame content rather than
re-judging it. Every excluded row is counted once in
`ok + offender + unresolved + excluded = 266` (asserted by "every row is
accounted for exactly once", `test/desktop-control-floor.scan.test.ts`).

## Offenders: 0 (ceiling `DESKTOP_FLOOR_DIVERGENCE_CEILING = 0` as of wave 33 -- see "WAVE 33" below for the disposition of the four rows this heading named `= 4` for through wave 32; that count is now stale, corrected here)

### RESOLVED (wave 17, DEC-393): the two role-chip strips, and this
### section's own stale resolution corrected

The "Genuinely new, surfaced by the repair -- recorded, NOT drained (2
rows)" text below this heading (kept, struck through in spirit, for the
history) was already half-overtaken by the time this wave read it: the
`DESKTOP_FLOOR_DIVERGENCE_CEILING = 3` this section's own title still
named had been lowered to `2` back in wave 156 (task qh,
`app/src/pages/settings/settings.css`, commit "Desktop drawn-floor drain:
PeopleRolesPanel Reviewer/Organizer chips") -- this file was never updated
to say so. That is the SAME "ledger rot" phenomenon the scribe has flagged
repeatedly across the campaign: the code moved, the ledger prose did not.
Corrected here, along with the second, mis-diagnosed row this task was
scoped to fix:

- **Settings -- `docs/design/Chautauqua Settings.dc.html`:1302** ("Reviewer",
  frame "Invite someone", `min-height:44px`). ALREADY RESOLVED, wave 156
  (not by this task): `app/src/pages/settings/PeopleRolesPanel.tsx`'s two
  `role="radio"` buttons (`chq-pill`/`chq-pill is-active`) are floored by
  `app/src/pages/settings/settings.css`'s
  `[aria-labelledby='people-invite-role-label'] .chq-pill { min-height:
  44px; }` -- scoped to this radiogroup's own `aria-labelledby` anchor, so
  the shared `.chq-pill` house register and every other chip strip in the
  app stay untouched. `.chq-pill`'s own base (`app/src/styles.css`)
  already supplies `display: inline-flex; align-items: center; padding: 5px
  12px`, so all three of DESIGN-RULINGS:189's required properties
  (min-height, centred flex, horizontal padding) are present. This task
  found `settings.css` already carrying the fix and made no further
  product change to it (also out of scope per this task's own "DO NOT
  TOUCH settings.css" instruction, another lane owns its terminal phone
  block this batch).

- **Contacts -- `docs/design/Chautauqua Contacts.dc.html`:602** ("Reviewer",
  frame "Add to an event", `min-height:46px`). RESOLVED this wave. The
  resolution recorded above this section ("Both resolve to `chq-pill`...
  role-invite chip") is WRONG for this row -- `chq-pill` is
  PeopleRolesPanel's Settings control, a different page entirely.
  `AddToEventModal.tsx`'s own header comment states the reason the scan's
  text-match join can never see this row's real control directly: "never a
  hardcoded Speaker/Reviewer/Guest list" -- the role buttons render from
  `PARTICIPANT_ROLE_OPTIONS`, so no literal "Reviewer" string exists in
  this file for an own-text-exact join to land on; the join's only
  corpus-wide match for the string "Reviewer" is PeopleRolesPanel's unrelated
  chip, which is why this row has always resolved there. The REAL control is
  `AddToEventModal.tsx`'s `chq-btn chq-add-to-event-role-btn` button
  (~:173) inside `.chq-segmented`. `app/src/pages/contacts/contacts-panels.css`'s
  `.chq-btn.chq-add-to-event-role-btn` family (~:1201) previously set only
  border/background/colour; this wave appends `min-height: 46px` to that
  same rule (same compound-selector idiom the file already uses, so it
  wins over the shared `.chq-btn` base regardless of load order). `.chq-btn`
  (`app/src/styles.css`) already supplies `display: inline-flex;
  align-items: center; padding: 10px 16px`, so the appended byte alone
  completes all three of DESIGN-RULINGS:189's required properties.

  **The ledger's own count could not reflect this fix by the JOIN's own
  construction**: the row's resolution stays mis-attributed to
  `chq-pill`/PeopleRolesPanel (declaring 44px via the wave-156 Settings fix
  above), which is still `< 46` against this row's own 46px drawn floor --
  the JOIN has no way to relocate itself to a dynamically-rendered control's
  class, so it kept grading this row against the WRONG element. The real
  control is genuinely floored in product CSS (see the receipt test
  `app/src/pages/contacts/contacts-role-chip-floor.scan.test.ts`, which
  asserts the frame line and the CSS rule byte-for-byte). **WAVE 26
  (DEC-964 amendment): this is now handled by name, not left as an
  unreachable count** -- see "WAVE 26" below, where this exact row
  reclassifies `unresolved`/`cross-surface-match`.

### The one genuine survivor (1 row, carried forward from wave 155/151)

- `docs/design/Chautauqua Submissions.dc.html`:314 -- "Waitlist" (frame
  "Submission detail · /submissions/:id") draws `min-height:44px`;
  resolves to `chq-overview-btn chq-overview-btn-waitlist`, declared 0px.
  See "The one genuine survivor" above -- the real control
  (`.chq-detail-decision-secondary-pair .chq-btn`) is now floored at 44px
  in product CSS, receipted byte-for-byte by
  `app/src/pages/submissions/submissions-decision-pair-floor.scan.test.ts`
  (the real control's label is rendered via a JSX expression, never a
  literal string, which is exactly why the static text-match join can never
  relocate to it). **WAVE 26 (DEC-964 amendment): this is now handled by
  name, not left as an unreachable count** -- see "WAVE 26" below, where
  this exact row reclassifies `unresolved`/`cross-surface-match`.

### Resolved by the repair (12 rows from the wave-151/155 population)

- **1 row OK, no CSS moved:** "Back to sign in" (`Chautauqua
  Account.dc.html`:225) -- now resolves to `chq-btn chq-btn-primary`,
  declared 48px >= drawn 46px. See "Drained by the repair" above.
- **10 rows reclassified OFFENDER -> UNRESOLVED** (reason
  `no-control-shape`): the ten wave-155-blessed field-name-eyebrow rows NOT
  named above -- `Chautauqua Contacts.dc.html`:601 "Speaker", `:824` "First
  name", `:828` "Last name", `:839` "Company"; `Chautauqua Public and
  Portal.dc.html`:1435 "First name", `:1439` "Last name"; `Chautauqua
  Settings.dc.html`:1064 "Sessions", `:1287` "First name", `:1291` "Last
  name"; `Chautauqua Speakers.dc.html`:209 "Form". Their resolved tokens
  (`.chq-portal-field-label`, `.chq-page-title`, `.chq-section-label`, two
  table-column-label classes, `.chq-pub-section-title`,
  `.chq-pub-surface-title`, `.chq-home-action-quiet`, `.chq-detail-section-title`)
  declare no border/background/padding-inline/min-height at top level --
  none is control-shaped, so the repaired join now grades these UNRESOLVED
  rather than asserting a false OFFENDER. `docs/design/DEVIATIONS.md`'s
  blessed-eyebrow entry stays as written (another lane's scope); this is
  the SAME phenomenon, just graded honestly by the ledger now instead of
  asserted-then-waived.

One measured false-positive was closed by the JOIN's own attribute-value
guard before the wave-151 ceiling was first seeded, and is recorded here as
a receipt of the guard's necessity rather than as a live offender:

`docs/design/Chautauqua Settings.dc.html`:1461 draws a "File" pill
(`min-height:44px`) inside the "Portal resource · add" frame. Without the
guard, the JOIN's boundary-anchored label search for "File" would have
landed inside `app/src/pages/content/FilesLibrary.tsx`'s
`aria-label="File type"` attribute value on a `<div className="chq-chipstrip"
...>` -- a filter-tab CONTAINER, not the pill's own control -- and would
have wrongly graded the row as an offender declaring 0px. The guard rejects
any match landing inside an as-yet-unclosed opening tag's own attribute
value (the text between the nearest preceding `>` and the match still
containing an unclosed `<`), so this row now correctly falls into
Unresolved (no real rendered-text match for "File" was found) rather than
asserting a false divergence. The wave-157 repair carries this guard
forward unchanged.

**Megabatch merge note (Thunderdome):** wave 27's frame-content exclusion
join (task w27-b, moving 28 fixture/composed rows out of `Unresolved` into
`Excluded`) and wave 28's attribute/prop label tier (task w28-b) landed in
the SAME integration batch, each measured against a tree that did not yet
contain the other. Both are live in
`test/desktop-control-floor.scan.test.ts`; the two sections below each
state their own lane's before/after numbers, and the single
`DESKTOP_FLOOR_UNRESOLVED_CEILING` constant carries the COMBINED, re-measured
count for the merged tree (both widenings applied), which is lower than
either lane's independently-measured figure.

## Wave 28 — attribute/prop label tier

`app/src` and `src` frequently carry a v12 frame's drawn label as an
attribute value (a `placeholder` on an empty input, most often) rather than
as literal own text-node content, which the own-text tier above cannot see
by construction. This wave adds a SECOND match tier, consulted ONLY when the
own-text tier finds no match for a label at all: an occurrence of the label
as the COMPLETE value of a quoted `label`/`aria-label`/`placeholder`/`title`
attribute inside an opening tag that ALSO carries `chq-` tokens in a
`class=`/`className=` attribute on that SAME opening tag (`test/desktop-control-floor.scan.test.ts`'s
`attributeLabelTokensInBlob`/`classTokensInOpenTag`). Resolving strictly
from the same tag — never a sibling or ancestor — preserves the wave-157
mis-attribution guarantee: a control's attribute-carried label can never
borrow an unrelated element's class. Rows resolved by this tier are graded
through the identical `gradeControl` path (control-shapedness corroboration,
own-element selector guard included), so the two tiers cannot diverge in
judgment.

**Before/after counts** (both ceilings forced to `-1` on this branch, in
turn, before AND after adding the tier):

| | offenders | unresolved | unresolved (no-label-match / no-token / no-control-shape) |
|---|---|---|---|
| PRE-WIDENING (own-text tier alone) | 2 | 166 | 155 / 1 / 10 |
| POST-WIDENING (both tiers) | 2 | 163 | 152 / 1 / 10 |

Ceilings re-seeded in the same commit: `DESKTOP_FLOOR_DIVERGENCE_CEILING`
stays `2` (unchanged — the attribute tier resolves zero new offenders);
`DESKTOP_FLOOR_UNRESOLVED_CEILING` lowered from `166` to `163`.

### Newly-resolved rows (3, all graded OK — no new offenders)

- `docs/design/Chautauqua Account.dc.html`:43 — "you@example.com" (frame
  "Sign in", `min-height:46px`). The frame draws the placeholder text as
  literal own text, but the product renders it as a real `placeholder`
  attribute, never a literal text node — the own-text tier cannot see it.
  `src/routes/auth-views.tsx`'s sign-in form:
  `` `className={props.error?.kind === "credential" ? "chq-input chq-field-invalid" : "chq-input"}` `` on the
  same `<input placeholder="you@example.com" ...>` tag resolves tokens
  `chq-input`/`chq-field-invalid`. `app/src/styles.css`'s
  `` `.chq-input, .chq-select, .chq-textarea { ...; min-height: 44px; }` ``
  is not the winning declaration here — `chq-field-invalid` and the
  ternary's ambient specificity from another rule bring the resolved
  maximum to 48px (>= drawn 46px). Graded OK.
- `docs/design/Chautauqua Account.dc.html`:195 — "you@example.com" (frame
  "Forgot password", `min-height:48px`). Same shape:
  `src/routes/auth-views.tsx`'s forgot-password form,
  `` `<input className="chq-input" ... placeholder="you@example.com" .../>` ``
  — `chq-input` alone, resolved 48px, exactly meets the drawn 48px floor.
  Graded OK.
- `docs/design/Chautauqua Submissions.dc.html`:296 — "Add a co-presenter by
  name or email…" (frame "Submission detail · /submissions/:id",
  `min-height:46px`). The frame draws this as literal placeholder-style
  text on a field box; the product renders the same string as a real
  `placeholder` attribute on a `chq-input`-classed field, never a literal
  text node. Resolved token `chq-input`, declared 48px >= drawn 46px.
  Graded OK.

Draining the remaining `no-label-match` bucket further (152 rows) would need
additional JOIN techniques — e.g. reading a label prop's VALUE off a
different, unclosed tag than its class, or a DOM-aware nested-element
reader — out of this wave's narrow scope, which adds exactly one same-tag
attribute tier and re-seeds the ceilings.

## Unresolved: 131 (ceiling `DESKTOP_FLOOR_UNRESOLVED_CEILING = 131` as of wave 33 -- see "WAVE 33" below for the disposition of the four rows this heading named `135` for through wave 29; that count is now stale, corrected here)

(Re-measured on the merged tree with BOTH wave-27's frame-content exclusions
and wave-28's attribute/prop tier applied: 166 -> 141 by w27-b alone, 166 ->
163 by w28-b alone, 138 with both. The per-lane prose below states each
lane's own independently-measured figures.)

152 rows (was 155 pre-wave-28, 91 pre-wave-157) have no match for their
label anywhere in the normalized `app/src/**` + `src/**` corpus at all,
under EITHER tier -- own-text-exact and the wave-28 same-tag
attribute/prop tier both come up empty (fixture/mock content,
composed-from-data labels, or labels neither tier's algorithm can reach --
the same shape `test/desktop-control-label.scan.test.ts`'s own
FIXTURE/COMPOSED exclusion tables name for the WORDS ledger, unexamined
here; the count fell by 3 this wave -- see "Wave 28" above -- and rose from
91 to 155 at wave-157 because `ownTextEquals` is strictly stronger than the
pre-repair join's substring test, so some rows that used to match loosely
now correctly find no exact own-text match anywhere). 1 row (was 38) matches
a label but the JOIN's same-tag class reader (either tier) could not extract
a `chq-` token from the enclosing element (the count fell sharply because
most of the pre-repair "matched but no token" rows are now either
exact-matched with a real token, or fall out at the label-match stage
entirely once substring matches are excluded). 10 rows (reason
`no-control-shape`) match a label and extract a token, but no resolved
token is control-shaped -- the ten reclassified blessed-eyebrow rows above.
Zero rows reach a token with no rule mentioning it at all.

Draining the REMAINING no-label-match/no-token buckets (130 + 1 rows, not
already covered by the sibling label ledger's own FIXTURE/COMPOSED tables)
is a JOIN-technique improvement (a DOM-aware or nested-element-aware class
reader) or a fresh hand-triage extension to those tables, not a CSS fix,
and is left to a later wave -- wave 27's widening (see "WAVE 27" above)
drained the slice that table extension already covered; the "left to a
later wave, full stop" framing this sentence replaces is now false for that
slice. Draining the no-control-shape bucket is a design-authority judgment
call (is a given bordered-but-unstyled-height class a decoration or a real,
un-floored control?) explicitly out of THIS wave's scope -- see `docs/design/
DEVIATIONS.md` for the ten already adjudicated as decoration.

**Merge-train note (wave 157 megabatch):** two lanes landed on this
instrument in the same batch. Task qg (wave 156) added the
control-shapedness corroboration clause (`no-control-shape`, own-element
selector guard, literal-property-name-only matching) to `gradeControl`;
task rb (wave 157) then repaired the label JOIN itself (every
boundary-anchored match, exact own-text equality instead of substring)
and drained the one genuine survivor. Both are live in
`test/desktop-control-floor.scan.test.ts`. qg's own wave-156 section of
this ledger enumerated 13 reclassified rows against the PRE-repair
substring join and is superseded by the re-derivation above, which
measures the same corroboration clause through the repaired join; both
ceilings below were re-measured against the combined instrument by
forcing each to -1 on the merged tree.

## Wave 23 (DEC-393 amendment, task w23-g): the composed-label tier resolves ZERO desktop rows

This wave added the SAME composed-label resolution tier the phone sibling ledger got, implemented once in `test/helpers/composed-label-resolve.ts` (DEC-613: never two copies of one join) and consulted by this file's `gradeControl` only when NEITHER the own-text tier nor the wave-28 attribute/prop tier resolves a label. See `docs/design/audit/frame-control-floor-390-v12.md`'s own "Wave 23" section for the tier's full algorithm and honesty clauses (unambiguous helper match, unambiguous call site, never unioned).

**MEASURED (this branch, forcing both `DESKTOP_FLOOR_DIVERGENCE_CEILING` and `DESKTOP_FLOOR_UNRESOLVED_CEILING` to -1 before and after adding the tier):**

- PRE-WIDENING (own-text + attribute tiers, matching the current tree's own state): 2 offenders, 137 unresolved.
- POST-WIDENING (own-text + attribute + composed tiers): **2 offenders, 137 unresolved -- byte-identical, zero rows moved.**

The tier genuinely resolves nothing on the desktop half. Reason: this campaign's one known composed-label match -- `src/domain/schedule-copy.ts`'s `conflictMoveLabel` (`` `Move ${ref} to ${clockHMM(startMin)}` ``), rendering "Move DFC-047 to 11:30" -- is drawn only inside a PHONE (width:390px height:844) frame extent in its own source `.dc.html` file (docs/design/Chautauqua Agenda.dc.html and docs/design/Chautauqua Overview.dc.html both draw it inside a phone frame only), so it never enters this file's own `!isPhone`-filtered `DESKTOP_FRAMES` population at all -- there is no desktop-frame row for the tier to have a chance at. Neither `DESKTOP_FLOOR_DIVERGENCE_CEILING` nor `DESKTOP_FLOOR_UNRESOLVED_CEILING` moved; both stay at their pre-widening values. A widening that finds nothing is a real, honestly-reported result, not an invented one.

## WAVE 26 (DEC-964 amendment, task w26-h): a cross-surface own-text match is a join artifact, not a divergence

Both remaining `DESKTOP_FLOOR_DIVERGENCE_CEILING = 2` survivors were, on inspection, the identical shape: the row's ONLY own-text match in the whole corpus resolves into a source file that renders no frame belonging to the SAME `.dc.html` cluster as the drawn row, because the real control renders its label dynamically (never a hardcoded string an own-text join can land on). `test/desktop-control-floor.scan.test.ts`'s `gradeControl` now grades this shape a new UNRESOLVED disposition, reason `cross-surface-match`, in the same corroboration-drop family as the file's existing `no-control-shape` guard -- gated on THREE conditions, none loosenable from the tests below: (1) the row's own-text tier matched into EXACTLY ONE source file corpus-wide (`crossSurfaceDisposition`'s multi-source negative control); (2) that source file's cluster membership (derived from `ALL_CONTROLS` itself -- every OTHER row's OK-graded, UNAMBIGUOUS single-source own-text match, never a hand-listed file→cluster table) does NOT include this row's own `.dc.html` file (the same-cluster negative control); (3) a NAMED receipt test is registered for this exact `(fileName, line)` coordinate AND that receipt's file, read at module load, still matches the exact `min-height:NNpx` regex this table claims (the no-receipt negative control, and a fail-loud module-load assertion if a registered receipt ever stops asserting what it claims).

**Why the cluster map itself had to exclude ambiguous matches:** an early version of `buildSourceFileClusters` credited a source file with cluster membership for EVERY OK-graded own-text match, including generic, shared-vocabulary labels ("Cancel", "Save", …) that match dozens of source files at once. Measured: under that version, `PeopleRolesPanel.tsx` ended up "belonging" to 9 of the 12 `.dc.html` clusters (including Contacts itself), because enough generic labels happen to render there too -- which made the Contacts:602 row's own mis-match look like a same-cluster match and the disposition never fired. Restricting cluster-membership contribution to UNAMBIGUOUS (single-source-file) OK matches only closes this: a generic label naturally matches many files at once and is excluded by construction, while `PeopleRolesPanel.tsx`'s genuine, unambiguous "Reviewer" match correctly credits only `Chautauqua Settings.dc.html`.

**Both reclassified rows, full receipts:**

- `docs/design/Chautauqua Contacts.dc.html`:602 -- "Reviewer" (frame "Add to an event", `min-height:46px`). Own-text match: exactly one source file, `app/src/pages/settings/PeopleRolesPanel.tsx`. That file's cluster membership (unambiguous OK matches only): `{ Chautauqua Settings.dc.html }` -- does NOT include Contacts. Receipt: `app/src/pages/contacts/contacts-role-chip-floor.scan.test.ts`, asserting the frame line byte-for-byte and `.chq-btn.chq-add-to-event-role-btn { min-height: 46px; }` in `app/src/pages/contacts/contacts-panels.css`. Reclassifies `unresolved`/`cross-surface-match`.
- `docs/design/Chautauqua Submissions.dc.html`:314 -- "Waitlist" (frame "Submission detail · /submissions/:id", `min-height:44px`). Own-text match: exactly one source file, `app/src/pages/submissions/SubmissionDetailPage.tsx` (the "Waitlist" literal lives on Overview's phone-hidden `chq-overview-btn-waitlist` queue-move button, a DIFFERENT `.chq-` token set the join resolves against). Receipt: `app/src/pages/submissions/submissions-decision-pair-floor.scan.test.ts` (new this wave), asserting the frame line byte-for-byte, that `SubmissionDetailPage.tsx` renders the secondary-pair label via `decisionActionLabel(status)` (never a literal `>Waitlist<`), and that `app/src/pages/submissions/detail.css`'s TOP-LEVEL (desktop, non-`@media`) `.chq-detail-decision-secondary-pair .chq-btn` rule already declares `min-height: 44px`. Reclassifies `unresolved`/`cross-surface-match`.

**MEASURED (this branch, forcing both ceilings to `-1` before AND after adding the disposition):**

| | offenders | unresolved |
|---|---|---|
| PRE (wave-23 tree) | 2 | 137 |
| POST (wave-26 disposition added) | 0 | 139 |

Exactly the 2 reclassified rows moved; every other row's status is unchanged (verified by the file's own `ok + offender + unresolved + excluded = 266` accounting assertion, still green). `DESKTOP_FLOOR_DIVERGENCE_CEILING` lowered `2 -> 0`; `DESKTOP_FLOOR_UNRESOLVED_CEILING` raised `137 -> 139`. Zero product CSS bytes moved -- this wave is instrument-only; both real controls were already floored correctly in product CSS by prior waves (Contacts wave-17, Submissions wave-157), and this wave's only job was teaching the LEDGER to stop asserting a false divergence against them.

**Never a blanket escape (synthetic controls, `test/desktop-control-floor.scan.test.ts`'s own non-vacuity suite):** a same-cluster match never crosses over regardless of receipt registration; a cross-cluster match with no registered receipt stays a real OFFENDER; a match spanning more than one distinct source file (not "ITS ONLY own-text match") stays a real OFFENDER; and every registered receipt is verified LIVE against the real corpus at module load, not merely declared.

## WAVE 29 (DEC-808 amendment, task w29-e): digit-collapsed skeleton join drains the `no-label-match` residue to a real verdict

`test/desktop-control-floor.scan.test.ts`'s pre-wave-29 `no-label-match`
bucket (130 rows) was, per the prior wave's own honest framing, "genuinely
composed-from-data or fixture-content labels ... still open to a later
wave's JOIN-technique work" -- a green ratchet standing over that residue
measures citation, not conformance (DEC-808). This wave drains it with two
additions to `gradeControl`, both consulted ONLY for a row already graded
`unresolved`/`no-label-match` by every existing tier (own-text, attribute,
composed):

1. **A digit-collapsed skeleton join** (`skeletonOwnTextTokens`,
   `collapseDigitsToSkeleton`): every digit run in BOTH the drawn label and
   the (comment-stripped, entity-decoded) product source is collapsed to one
   sentinel character (`#`), then the SAME own-text-exact join the primary
   tier already uses (`allBoundaryMatches` + `ownTextEquals` +
   `classTokensNear`) runs again over the skeletonized corpus. Skipped
   entirely for a label with no digit at all (the skeleton would be
   identical to the string the primary tier already tried). A row that
   resolves under this pass is graded through the SAME `finalizeTokens`
   tail every other tier uses (control-shape corroboration included), so it
   can land `ok`, `offender`, `no-token`, or `no-control-shape` exactly like
   any other resolved row -- never left as `no-label-match`.
2. **A composed-vs-absent disposition** for whatever the skeleton pass still
   cannot resolve, per this task's own required split ("the app composes
   this label and the join cannot see it" vs "the app does not draw this
   label at all"), added as a new `reason` token, `composed-unseen`:
   - `labelIsComposedLiteral` -- the label occurs, boundary-anchored, as a
     COMPLETE quoted string literal (flanked by the SAME quote character)
     ANYWHERE in the corpus, e.g. a ternary's alternate branch
     (`` {loading ? 'Saving…' : 'Save the question'} ``) the own-text tier's
     "the tag's own FULL text content IS the label" rule cannot see by
     construction.
   - `looksLikeDataValue` -- the label has the SHAPE of a concrete data
     value the frame drew as illustrative fixture content (a masked
     password, an email, a date, a clock time, an IANA zone name, a bare
     count, a slug/URL, a venue address, a two-word proper name, a closed
     dropdown's chevron-suffixed current selection, or free-run body copy
     >= 40 characters) -- content the real control genuinely renders from a
     live record, which no literal-text join can ever match against source
     code that names no such literal (it names a FIELD).
   - `HAND_VERIFIED_COMPOSED` -- a small, explicit table (own file, never
     editing the in-flight-owned `test/desktop-control-label.scan.test.ts`)
     for the residue neither automatic check classifies on pattern alone,
     each entry backed by a checked citation to the real rendering source
     (see the per-row list below).
   A row matching none of the three grades `offender` (reason `null`,
   `declaredMinHeight: null`) -- "the app does not draw this label at all"
   -- never parked back as `unresolved`. DESKTOP IS FROZEN: every such row is
   RECORDED below, not fixed (none of the four is a `min-height:44px`-vs-
   lower CSS gap a v12 desktop frame demands; all four are missing/differing
   CONTENT).

**MEASURED (this branch, forcing both ceilings to `-1` before AND after
adding both passes):**

| | offenders | unresolved (no-label-match / no-token / no-control-shape / cross-surface-match / composed-unseen) |
|---|---|---|
| PRE (wave-28 tree) | 0 | 139 (126 / 1 / 10 / 2 / 0) |
| POST (skeleton + composed/absent split) | 4 | 135 (0 / 2 / 10 / 2 / 121) |

`DESKTOP_FLOOR_DIVERGENCE_CEILING` raised `0 -> 4`; `DESKTOP_FLOOR_UNRESOLVED_CEILING`
lowered `139 -> 135` (both hand-measured, never expressions). 121
`no-label-match` rows moved to `composed-unseen`; 2 moved to `no-token`
(the skeleton join found a real element -- a bare numeric text node, e.g.
Agenda's break-duration field showing "20" -- but its class carried no
`chq-` token); 4 moved to `offender`. `ok + offender + unresolved + excluded
= 266` still holds (the file's own accounting assertion, unchanged).

### The four new offenders, wave 29 (SUPERSEDED wave 33 -- see "WAVE 33" below; kept for the citation history each row's disposition still cites)

- `docs/design/Chautauqua Overview.dc.html`:514 -- "Remind this task" (frame
  "States · hover, pending, drag", `min-height:46px`). This frame (lines
  ~473-521) is a component-STATES reference panel demonstrating
  Primary/Secondary/Tertiary/Destructive button styling across
  rest/hover/active/disabled -- NOT a real screen. Grepped the whole
  `app/src/**` + `src/**` corpus (case-sensitive and case-insensitive, every
  quote style) for "Remind this task": zero hits outside this file and a
  handful of comments (`app/src/pages/speakers/speakers.css`:1512/1524,
  `app/src/pages/speakers/SpeakerDetailPage.tsx`:194) that never render it --
  the real control (`SpeakerDetailPage.tsx`'s `taskRemindLabel`) renders
  `` `Remind · never sent` ``/`` `Remind · sent once` ``/`` `Remind · ${n}${ordinal} time` ``,
  never the frame's generic swatch caption.
- `docs/design/Chautauqua Overview.dc.html`:520 -- "Archive this event"
  (same States swatch frame, "Destructive" tier example). Zero hits for
  "archiv" (case-insensitive) anywhere in `app/src/**` + `src/**` outside
  unrelated ZIP-archive-export code (`app/src/lib/file-caps.ts`,
  `FilesLibrary.tsx`) -- the app has no event-archive action rendering this
  or any close variant of this string.
- `docs/design/Chautauqua Overview.dc.html`:585 -- "Hover me" (same frame's
  "Inputs" states table, "Hover · live" column). Pure demo-instruction
  copy ("hover this cell to see the live state") for the reference panel
  itself; zero hits anywhere in the real corpus, and none plausible --
  this string was never meant to be product copy.
- `docs/design/Chautauqua Speakers.dc.html`:201 -- "Upload a headshot"
  (frame "New task", the task-kind segmented control's first option). This
  is an ALREADY-RULED simplification, not a fresh gap: DEC-746 (cited
  verbatim in `app/src/pages/speakers/TaskModal.tsx`'s own header comment
  above `kindLabel`) names the segmented control's real labels as "Upload,
  Form, Acknowledge" — `kindLabel('file_request')` returns `'Upload'`, never
  the frame's fuller "Upload a headshot" / "Acknowledge" phrasing. Recorded
  here because this ledger's own grammar (a label found nowhere in the
  corpus) makes it structurally identical to the other three; DEC-746
  already adjudicates it as intentional, so no further action is implied.

### The 121 `composed-unseen` rows (representative sample; full list is every
### row `test/desktop-control-floor.scan.test.ts`'s `GRADED` array marks
### `reason === 'composed-unseen'` -- re-derive by forcing
### `DESKTOP_FLOOR_UNRESOLVED_CEILING` to `-1` and reading the printed
### breakdown, never hand-copied here in full)

The overwhelming majority (roughly 100 of 121) are masked passwords, email
addresses, dates, clock times, IANA zone names, venue addresses, proper
names, slugs/URLs, and closed-dropdown current-selection chevrons this
pack draws as illustrative fixture/instance content for a live-data-bound
field -- `looksLikeDataValue`'s own non-vacuity fixture in the test file
documents every shape with a real drawn-corpus example. The
`HAND_VERIFIED_COMPOSED` table in `test/desktop-control-floor.scan.test.ts`
additionally hand-verifies 15 rows against the real rendering source (each
with its own citation in the table itself), including:

- `Chautauqua Account.dc.html`:84/:248 -- "At least 12 characters":
  `src/routes/auth-views.tsx`:352's `` placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} ``
  -- a backtick template literal with an interpolation hole no existing tier
  (own-text, attribute, digit-skeleton) can see, since the SOURCE carries no
  literal digit at all, only a variable name.
- `Chautauqua Contacts.dc.html`:560/:563 -- the Bulk-email placeholder
  templates, composed from a merge-field token (`{event_name}`/
  `{speaker_name}` vs the frame's `{event_name}`-elided/`{first_name}`
  phrasing) -- `BulkEmailModal.tsx`:420's own comment blesses `{first_name}`/
  `{company}` as this component's merge-field vocabulary.
- `Chautauqua Public and Portal.dc.html`:1405 / `Chautauqua Overview.dc.html`:597
  / `Chautauqua Submissions.dc.html`:274 -- all three are the SAME
  `sessionFormatLabel`/`formatLabel` (DEC-908) composed "N min" vocabulary;
  the first is ALREADY adjudicated by DEC-777 (wave-148), whose own comment
  in `src/routes/portal/edit.tsx`:273-284 cites this exact frame row by
  name.
- `Chautauqua Settings.dc.html`:1060/:1430/:1455 -- `{embed.name}`
  (`SavedEmbedsPanel.tsx`:319) and `{resource.title}`
  (`ResourcesPanel.tsx`:289) -- live data-bound name/title fields, never a
  literal string.

Full reasons and citations for all 15 hand-verified rows are in
`test/desktop-control-floor.scan.test.ts`'s `HAND_VERIFIED_COMPOSED` table
itself (never re-listed here in full, per DEC-613 -- one table, not two).

Zero product CSS bytes changed this wave -- desktop stays frozen, per this
task's own scope. `DEC-808`'s own registry file carries this wave's
amendment; see `src/decisions-data/DEC-808.md`.

## WAVE 33 (DEC-651 wave-33 amendment, task w33-e): the four wave-29 offenders were not divergences -- the ledger stops asserting them

DEC-651 (wave 33) named this section's own prior "recorded, not fixed"
framing as itself the bug: none of the four rows above is a `min-height`
CSS gap (desktop stays frozen, no product byte moves here either), and this
ledger should not have kept asserting all four as offenders. `NO PRODUCT
BYTE MOVES in this lane.`

### The exclusion rule (three rows: "Remind this task", "Archive this event", "Hover me")

`docs/design/Chautauqua Overview.dc.html:476` opens the frame titled
`States · hover, pending, drag` -- the ONLY frame in the whole 13-file,
108-frame pack whose title begins `States · `. It is a component swatch
panel demonstrating Primary/Secondary/Tertiary/Destructive button styling
and input rest/hover/focus/disabled states, captioned by the pack itself
`Hover the live column · the rest are drawn states` -- never a real screen.
All three rows sit inside this one frame's extent (lines 476-688); the prior
section's own corpus greps (quoted above) already proved zero product hits
for each.

`test/desktop-control-floor.scan.test.ts` now excludes this frame's rows at
the POPULATION step, not the grade step: `isStatesSwatchFrameTitle(title)`
tests the frame's own title string (`title.startsWith('States · ')`), and
`populatedFrames` applies it alongside the file's pre-existing `!isPhone`
split, inside `drawnControlsInFile`'s frame-extent walk -- the SAME place
that split already lives, never a hand-written line range. This drops ALL 19
of the frame's drawn-control rows from `ALL_CONTROLS`, not merely the three
that graded `offender` -- the other 16 (8 `ok`: "Save changes" x4, "Cancel"
x4; 4 `unresolved`/`composed-unseen`: "Priya Raman" x2, "dana@example",
"Talk, 30 min"; 4 `excluded`/`frame-content`: "Send 23 emails" x2, "Sending
12 of 23…", "Uploading…") were never product copy either, and counting them
toward this file's population was never correct.

**Two negative controls**, per the task's own requirement, are asserted in
`test/desktop-control-floor.scan.test.ts`'s
`non-vacuity: WAVE 33 (DEC-651) States-swatch-frame population exclusion`
test, over fabricated frame entries (never the real corpus):

1. A synthetic frame whose title does NOT begin `States · ` still
   contributes its rows to `populatedFrames`'s output -- the exclusion is
   not a blanket "drop everything" escape.
2. A row inside a badged extent is excluded -- asserted against TWO
   fabricated `States · `-titled frames (not only the pack's one real
   title), proving the derivation reads the title TOKEN and never a
   hand-listed file:line coordinate.

### The settled-exclusion entry (one row: "Upload a headshot")

`docs/design/Chautauqua Speakers.dc.html:201` is already adjudicated.
Verified directly against the source (not re-derived from this doc's prior
wave-29 text): `app/src/pages/speakers/TaskModal.tsx`'s own header comment
above `kindLabel` reads

> `// DEC-746: the segmented control's labels/order per`
> `// docs/design/Chautauqua Speakers.dc.html:186-216 -- Upload, Form,`
> `// Acknowledge, mapping onto the existing kind values so every other kind`

-- citing exactly the region (`186-216`) this row's line 201 sits inside --
and `kindLabel`'s own body:

> `export function kindLabel(kind: TaskKind): string {`
> `  if (kind === 'file_request') return 'Upload';`
> `  if (kind === 'form') return 'Form';`
> `  return 'Acknowledge';`

returns exactly `'Upload'` / `'Form'` / `'Acknowledge'`, confirming the
ruling's own claim.

This row now lives in `test/desktop-control-floor.scan.test.ts`'s
`RULING_SETTLED_EXCLUSIONS` table -- a table SEPARATE from the label
ledger's imported `FRAME_CONTENT_EXCLUSIONS` (FIXTURE/COMPOSED, a different
file's adjudication), carrying `DEC-746` as this row's ruling id: **a row
enters a settled table only carrying the ruling that settled it.** It grades
`excluded`/`ruling-settled`, never `offender`. The `RULING_SETTLED_EXCLUSIONS`
entry's `reason` string interpolates `DEC_746` (the compile-checked constant
from `src/decisions.ts`, not a bare string), so a future rewording of the
ruling's own text cannot silently drift out of sync with this table.

A positive/negative fixture pair
(`non-vacuity: WAVE 33 (DEC-651) DEC-746 ruling-settled exclusion`) asserts
the real table coordinate grades `excluded`/`ruling-settled` carrying the
exact reason string, and an unrelated coordinate is untouched by this table.

### Final disposition of all four rows

| row | citation (bare path + verbatim quote) | disposition |
|---|---|---|
| "Remind this task" | `docs/design/Chautauqua Overview.dc.html`, `>Remind this task<` | Excluded at the population step (States-swatch-frame title exclusion) -- no longer enters `ALL_CONTROLS` at all. |
| "Archive this event" | `docs/design/Chautauqua Overview.dc.html`, `>Archive this event<` | Same States-swatch-frame population exclusion. |
| "Hover me" | `docs/design/Chautauqua Overview.dc.html`, `>Hover me<` | Same States-swatch-frame population exclusion. |
| "Upload a headshot" | `docs/design/Chautauqua Speakers.dc.html`, `>Upload a headshot<` | Moved to `RULING_SETTLED_EXCLUSIONS`, carrying `DEC-746`; grades `excluded`/`ruling-settled`. |

### Is the States frame also claimed by `test/desktop-frame-ledger.scan.test.ts`'s `CLAIMED_FLOOR` population?

**Yes -- and that is a DIFFERENT question, and this task does NOT touch that
ledger.** `docs/design/audit/desktop-frame-ledger-v12.md`'s own printed
claim list includes the line `Chautauqua Overview.dc.html :476 -- States ·
hover, pending, drag`, and `docs/design/audit/overview-desktop-v12.md`
adjudicates it: "`:476 States · hover, pending, drag | MATCHES for Buttons;
DIVERGES by omission (no Pending/Drag controls exist on this page) --
adjudicated, DEC-380 wave-130`". `desktop-frame-ledger.scan.test.ts`'s
`CLAIMED_FLOOR` asks "does some test CITE this frame at all" (a coverage
population over ALL 108 desktop frames, DEC-380-adjudicated content
divergences included by design); `desktop-control-floor.scan.test.ts` asks
"does this frame draw CONTROLS whose geometry the app's own product copy
matches" (a min-height population, now excluding the swatch panel's rows
entirely as never-product-copy). The same frame can be a legitimate member
of one population and correctly excluded from the other -- this wave leaves
`desktop-frame-ledger.scan.test.ts` and its `CLAIMED_FLOOR` untouched.

### Re-measured

Forcing both ceilings to `-1` before AND after the two changes above (this
file's own required protocol):

| | offenders | unresolved | excluded | ok | total |
|---|---|---|---|---|---|
| PRE (wave 29 tree) | 4 | 135 | (prior count) | (prior count) | 266 |
| POST (wave 33: population exclusion + ruling-settled move) | 0 | 131 | +1 (DEC-746 row) | unchanged | 247 |

`DESKTOP_FLOOR_DIVERGENCE_CEILING` lowered `4 -> 0`.
`DESKTOP_FLOOR_UNRESOLVED_CEILING` **moves** `135 -> 131` -- contrary to this
task's own "expect unchanged" prior, MEASURED rather than assumed: of the 19
rows the population exclusion removes, 4 were themselves graded
`unresolved`/`composed-unseen` (not `offender`), each individually verified
by printing every States-frame row's pre-exclusion status (see
`test/desktop-control-floor.scan.test.ts`'s own comment above the
`DESKTOP_FLOOR_UNRESOLVED_CEILING` export for the full 8/3/4/4 breakdown).
`ok + offender + unresolved + excluded = 247` still holds (the file's own
accounting assertion, unchanged in shape, total lowered `266 -> 247` because
the population itself shrank by 19 real rows, never by loosening the
assertion). Zero product CSS bytes moved -- this wave is instrument-only.

## Wave 52: comment-credited floors

Task w52-f. DEC-374 (wave-52 amendment): every `src/**/*.css.ts` sheet is
one giant template literal, and `test/frame-source-corpus.ts`'s
`stripComments` deliberately enters a template/single/double STRING state on
a quote and copies everything through to the closing quote (needed for its
own label-match join) -- so every `/* ... */` CSS comment inside a `.css.ts`
sheet survives through `normalizeSource`. This file's own `RULE_RE =
/([^{}]+)\{([^{}]*)\}/g` then parses "everything between two braces" as one
rule's selector text, which folds a surviving comment into the NEXT rule's
raw selector text, and `selectorMentionsToken` matches a dot-prefixed class
token written in prose there -- crediting that token a min-height it never
declares. MEASUREMENT AND RATCHET ONLY, per the task's own scope: this
section changes no existing grading (`TOKEN_INDEX`,
`resolveTokenMinHeightIndexed`, `gradeControl`, `OFFENDERS`, `UNRESOLVED` are
all untouched) and no product CSS byte. The error is proven
ONE-DIRECTIONAL -- a comment can only ADD tokens to a selector, never remove
a real one -- so it can only SUPPRESS true offenders already counted (or not)
by `DESKTOP_FLOOR_DIVERGENCE_CEILING`/`DESKTOP_FLOOR_UNRESOLVED_CEILING`
above; correcting the parse is a later, separately-scoped lane, sized
directly from the roster below.

### Method

For every `chq-` class token `TOKEN_INDEX` (this file's existing
token/min-height index) credits with a min-height, `findCommentCreditedOffenders`
(`test/desktop-control-floor.scan.test.ts`) recomputes that same credit over
the same rule text with CSS comments additionally stripped -- via the
shared, string-aware `stripCssComments` (DEC-613), imported from
`test/helpers/strip-css-comments.ts`, never re-implemented. A token flags as
comment-credited when the comment-stripped recomputation finds NO min-height
for it at all: its entire credit existed only via comment text. Non-chq-
`.word` tokens `TOKEN_INDEX`'s own `SELECTOR_CLASS_TOKEN_RE` also matches
(file-extension mentions in prose such as `.ts`/`.css`/`.md`/`.html`/`.tsx`/
`.dc`, all folded from the SAME comment-credit bug) are out of this ceiling's
scope by the task's own grammar ("every chq- class token") and excluded.

### Roster: `COMMENT_CREDITED_FLOOR_CEILING` = 5

Each row below carries `DEC-374` on its own line, per this wave's task.

1. `src/routes/auth.css.ts`
   `.chq-auth-card button[type=submit], .chq-auth-actions button[type=submit]`
   Token `chq-auth-fields` credited `min-height:46px` -- comment-only.
   DEC-374

2. `src/routes/auth.css.ts`
   `.chq-auth-card button[type=submit], .chq-auth-actions button[type=submit]`
   Token `chq-auth-submitrow` credited `min-height:46px` -- comment-only.
   DEC-374

3. `src/routes/portal/portal.css.ts`
   `.chq-portal-headshot-pick`
   Token `chq-content-upload-input` credited `min-height:44px` -- comment-only.
   DEC-374

4. `src/routes/portal/portal.css.ts`
   `.chq-portal-headshot-pick`
   Token `chq-portal-headshot-pick-input` credited `min-height:44px` -- comment-only.
   DEC-374

5. `src/routes/public/css/agenda.css.ts`
   `.chq-pub-agenda-block-save`
   Token `chq-pub-save` credited `min-height:24px` -- comment-only.
   DEC-374

### Non-chq- artifacts of the SAME comment-fold, excluded from the ceiling by grammar (not repaired, not counted)

`TOKEN_INDEX`'s `SELECTOR_CLASS_TOKEN_RE = /\.([A-Za-z][A-Za-z0-9-]*)/g`
matches any `.word`, so a prose mention of a filename like
`portal.css.ts` or `agenda.css.ts` inside a comment also folds into the next
rule's selector and credits tokens `css`, `dc`, `html`, `md`, `ts`, `tsx` --
none is a `chq-` class, none is a real product token, and none is graded
`offender`/`unresolved` by `TOKEN_INDEX`'s own real consumers
(`resolveTokenMinHeightIndexed` is only ever called with a token extracted
from a DRAWN CONTROL's `class=`/`className=` attribute in a `.dc.html`
frame, and no frame draws a control literally classed `.css`/`.ts`/etc). All
six resolve to `src/routes/portal/portal.css.ts` (five, via the same
`.chq-portal-headshot-pick` comment) and `src/routes/public/css/agenda.css.ts`
(one).

### Re-measured

Forcing `COMMENT_CREDITED_FLOOR_CEILING` to `-1` and reading the printed
offender list (this file's own required protocol): 11 raw offenders (5
`chq-` tokens + 6 non-`chq-` artifacts of the identical fold, listed above),
5 in-scope per the task's "every chq- class token" grammar.
`COMMENT_CREDITED_FLOOR_CEILING` set to `5`. Registered in
`scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts` and
`scripts/exit-predicate/campaign-scope/parked-fidelity-promises.ts` only
(`siblingName: null`), never `CAMPAIGN_CONSTANT_NAMES`/`TIER2_CEILING_NAMES`
-- a fresh measurement never moves the exit gate's goalposts
mid-convergence. Zero existing grading changed, zero product CSS bytes
moved.

## Wave 55: comment-fold parse repair (executes the DEC-374 wave-52 amendment)

Task w55-a. Wave 52 above only MEASURED the comment-fold defect and
deferred correcting the parse to "a later, separately-scoped lane, sized
directly from the roster below" -- this wave is that lane. `DEC_374`
(`src/decisions-data/part2.ts`) already reads "every CSS-rule parse over a
`*.css.ts` template literal must additionally strip CSS comments (wave-52
amendment)"; this wave makes that true of `test/desktop-control-floor.scan
.test.ts`'s own real grading path, not just its measurement section.

### Repair

`test/desktop-control-floor.scan.test.ts` now defines
`COMMENT_FREE_NORMALIZED_BLOBS` (via the shared, string-aware
`stripCssComments`, DEC-613, imported from `test/helpers/strip-css-comments
.ts`) immediately after `NORMALIZED_BLOBS`, and `COMMENT_FREE_TOPLEVEL_BLOBS`
immediately after `TOPLEVEL_BLOBS` -- both now defined BEFORE `TOKEN_INDEX`'s
and `CONTROL_SHAPE_INDEX`'s build loops, which iterate the comment-free blobs
instead of the raw ones. A CSS comment can therefore no longer fold into the
next rule's selector text anywhere in this file's real grading path
(`resolveTokenMinHeightIndexed`, `tokenIsControlShapedIndexed`,
`gradeControl`, `OFFENDERS`, `UNRESOLVED` are all now driven by the repaired
indexes -- unlike wave 52, which left them untouched). `TOPLEVEL_BLOBS`
itself is unchanged (still comment-including) and remains the honest "raw"
corpus for the `COMMENT_CREDITED_OFFENDERS` measurement/ratchet machinery,
which is otherwise unchanged code -- it now simply measures an index that has
already been repaired, so its own "raw" and "TOKEN_INDEX-derived" views of
each token's credit can no longer diverge. The wave-52
`COMMENT_FREE_NORMALIZED_BLOBS`/`COMMENT_FREE_TOPLEVEL_BLOBS` definitions
that previously lived below the roster are removed as duplicates (DEC-613:
one stripped-blob array, not two) -- the single earlier definition now
serves both purposes.

### Re-measured (forcing each to `-1` and reading the printed count/list back, this file's own required protocol)

- `COMMENT_CREDITED_FLOOR_CEILING` lowered `5 -> 0`. All 5 previously
  comment-credited `chq-` tokens now resolve no min-height at all through the
  repaired index -- none of them had a genuine declaration, so the fold's
  suppression effect (comment-credit standing in for a real gap) resolved to
  "no credit, no offender", not "credit revealed as real". Lowered in this
  same commit, per this file's own two-sided never-sits-below discipline.
- `DESKTOP_FLOOR_DIVERGENCE_CEILING` unchanged `0 -> 0`. The fold's
  suppression was proven one-directional (comments can only ADD tokens,
  never remove a real one) but revealed no new offender this wave: none of
  the 5 formerly comment-credited tokens' underlying controls resolve to a
  genuine, divergent min-height once their comment-only credit is removed --
  they instead move to `unresolved` (no credit at all), not `offender`.
- `DESKTOP_FLOOR_UNRESOLVED_CEILING` unchanged `131 -> 131`. The 5 repaired
  tokens' controls were already resolving to the same disposition through
  other means (a genuine declaration elsewhere in `TOKEN_INDEX`, or an
  already-`unresolved` row), so the repair moved zero rows across the
  ok/offender/unresolved/excluded partition this file's own "every row
  accounted for exactly once" invariant checks.

Both desktop ceilings are still parked in `OUT_OF_CAMPAIGN_SCOPE` (unchanged
this wave, out of this task's scope) -- their values held steady rather than
rising, so no campaign goalpost moved and no promotion is owed for either.

### Promotion

`COMMENT_CREDITED_FLOOR_CEILING` reached `0` (clause a) with no completeness
sibling to straddle (`siblingName: null`, `siblingFullyAdjudicated: true` in
its own `PARKED_FIDELITY_PROMISES` row) -- both `assertParkedPromisesAreHonestlyParked`
clauses clear. Paid in this same commit: the `OUT_OF_CAMPAIGN_SCOPE` entry
and the `PARKED_FIDELITY_PROMISES` row are both deleted, and the name is
added to `CAMPAIGN_CONSTANT_NAMES` and `TIER2_CEILING_NAMES` -- it now prints
as a real, graded, green (0) campaign row instead of a parked excuse.
