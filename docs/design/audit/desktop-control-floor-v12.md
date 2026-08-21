# Desktop drawn-floor v12 audit (task w7-db, DEC-393 wave-151 amendment; repaired task rb, DEC-393 wave-157 amendment; role-chip rows resolved task w17-b, DEC-393 wave-17; frame-content join widened task w27-b, DEC-393 wave-27)

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
stays `2`; `DESKTOP_FLOOR_UNRESOLVED_CEILING` moves from `166` to `141`, both
re-measured directly (never read from this prose). Not one product CSS byte
changed this wave -- desktop stays frozen, per this task's own scope.

The "Draining the no-label-match/no-token buckets is ... left to a later
wave" sentence in "Unresolved" below is now FALSE for the slice this wave's
widening covers (fixture/composed frame content) and is retired; a residue
of 130 `no-label-match` rows remains -- genuinely composed-from-data or
fixture-content labels the sibling ledger's own hand-triage tables have not
yet been extended to cover (or genuine app gaps neither ledger has yet
triaged) -- still open to a later wave's JOIN-technique work.

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

## Offenders: 2 (ceiling `DESKTOP_FLOOR_DIVERGENCE_CEILING = 2`, unchanged by wave 27's widening -- see "WAVE 27" above)

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

  **The ledger's own count cannot reflect this fix, by the same
  construction as the "Waitlist" survivor below**: the row's resolution
  stays mis-attributed to `chq-pill`/PeopleRolesPanel (now declaring 44px
  via the wave-156 Settings fix above), which is still `< 46` against
  this row's own 46px drawn floor -- the JOIN has no way to relocate
  itself to a dynamically-rendered control's class, so it keeps grading
  this row against the WRONG element. The real control is genuinely
  floored in product CSS (see the receipt test
  `app/src/pages/contacts/contacts-role-chip-floor.scan.test.ts`, which
  asserts the frame line and the CSS rule byte-for-byte); this row simply
  cannot be drained by construction. `DESKTOP_FLOOR_DIVERGENCE_CEILING`
  stays at its already-measured value of `2` (re-measured on this branch
  by forcing it to `-1`: unchanged before and after this wave's CSS
  change, since the mis-attributed row's resolved-token height moved from
  0px to 44px but never reaches the drawn 46px) -- NOT driven to `1` or `0`
  on judgment, per this task's own instruction and the "Waitlist"
  precedent immediately below.

### The one genuine survivor (1 row, carried forward from wave 155/151)

- `docs/design/Chautauqua Submissions.dc.html`:314 -- "Waitlist" (frame
  "Submission detail · /submissions/:id") draws `min-height:44px`;
  resolves to `chq-overview-btn chq-overview-btn-waitlist`, declared 0px.
  See "The one genuine survivor" above -- the real control
  (`.chq-detail-decision-secondary-pair .chq-btn`) is now floored at 44px
  in product CSS; this ledger row cannot reflect that fix by construction
  (a static text-match join, and the real control's label is rendered via
  a JSX expression, never a literal string).

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

## Unresolved: 141 (ceiling `DESKTOP_FLOOR_UNRESOLVED_CEILING = 141`, was 166)

130 rows (was 155) have no own-text-exact match for their label anywhere in
the normalized `app/src/**` + `src/**` corpus at all (composed-from-data
labels, or labels this scan's plain-substring search cannot reach, that are
NOT among the sibling label ledger's own hand-triaged FIXTURE/COMPOSED
rows -- the count fell by exactly the 28 rows wave 27's widening moved to
`Excluded`, all previously counted here since fixture/composed content is
by definition content the app's source never literally contains). 1 row
matches a label but the JOIN's same-tag, text-node-only class reader could
not extract a `chq-` token from the enclosing element. 10 rows (reason
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
