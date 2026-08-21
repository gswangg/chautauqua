# Desktop drawn-floor v12 audit (task w7-db, DEC-393 wave-151 amendment; repaired task rb, DEC-393 wave-157 amendment)

Measured by `test/desktop-control-floor.scan.test.ts` on this branch. This
file MEASURES ONLY -- it changes no product CSS byte except the one
authorised byte wave-157's repair adds (see "Offenders: 3" below), and
desktop stays otherwise frozen. See that file's own header for the full
population/join/grade methodology.

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
token/selector entirely) -- `DESKTOP_FLOOR_DIVERGENCE_CEILING` is seeded at
the honest measured value (3, below), not driven to 0 on the strength of a
product fix this scan cannot verify. `.chq-btn`, `.chq-btn-primary`,
`.chq-btn-secondary` and `src/routes/auth.css.ts` are untouched, per this
wave's scope.

## Offenders: 3 (ceiling `DESKTOP_FLOOR_DIVERGENCE_CEILING = 3`, was 14)

### Genuinely new, surfaced by the repair -- recorded, NOT drained (2 rows)

The widened own-text-exact search resolves two of the wave-155 "blessed
eyebrow" rows to a real, control-shaped token that the pre-repair join
never found (both previously resolved only to
`chq-comms-feedback-eyebrow`/`chq-page-title`, neither control-shaped, and
were BLESSED alongside the other ten -- see `docs/design/DEVIATIONS.md`'s
"Field-name eyebrows drawn as bordered chips, rendered as plain text"
entry, unchanged by this wave):

- `docs/design/Chautauqua Contacts.dc.html`:602 -- "Reviewer" (frame "Add
  to an event") draws `min-height:46px`.
- `docs/design/Chautauqua Settings.dc.html`:1302 -- "Reviewer" (frame
  "Invite someone") draws `min-height:44px`.

Both resolve to `chq-pill`: `app/src/pages/settings/PeopleRolesPanel.tsx`'s
role-invite chip, `<button type="button" role="radio" ... className={newRole
=== 'reviewer' ? 'chq-pill is-active' : 'chq-pill'}>Reviewer</button>` --
own text content exactly "Reviewer". `chq-pill`
(`app/src/styles.css`) is genuinely control-shaped (`border: 1px solid
var(--chq-border-strong); border-radius: var(--chq-r-pill); padding: 5px
12px; background: var(--chq-surface); ...`) and declares no min-height
anywhere in the corpus at top level. This is a real, previously-hidden
desktop floor gap on a real interactive control (a `role="radio"` chip) --
per this task's scope, RECORDED here rather than fixed (no CSS byte
authorised for it; "THE ONE AUTHORISED PRODUCT BYTE" is
`.chq-detail-decision-secondary-pair .chq-btn` only). The `Settings.dc.html`
"Invite someone" frame is very plausibly this exact control's own frame;
whether `Contacts.dc.html`'s "Add to an event" flow renders the SAME
`PeopleRolesPanel` component or a distinct, as-yet-unlocated one is left
for a later wave along with the fix itself -- not adjudicated here, per
this task's "never drained on your own judgment" instruction.

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

## Unresolved: 166 (ceiling `DESKTOP_FLOOR_UNRESOLVED_CEILING = 166`, was 129)

155 rows (was 91) have no own-text-exact match for their label anywhere in
the normalized `app/src/**` + `src/**` corpus at all (fixture/mock content,
composed-from-data labels, or labels this scan's plain-substring search
cannot reach -- the same shape `test/desktop-control-label.scan.test.ts`'s
own FIXTURE/COMPOSED exclusion tables name for the WORDS ledger, unexamined
here; the count rose from 91 because `ownTextEquals` is strictly stronger
than the pre-repair join's substring test, so some rows that used to match
loosely now correctly find no exact own-text match anywhere). 1 row (was
38) matches a label but the JOIN's same-tag, text-node-only class reader
could not extract a `chq-` token from the enclosing element (the count fell
sharply because most of the pre-repair "matched but no token" rows are now
either exact-matched with a real token, or fall out at the label-match
stage entirely once substring matches are excluded). 10 rows (new bucket,
reason `no-control-shape`) match a label and extract a token, but no
resolved token is control-shaped -- the ten reclassified blessed-eyebrow
rows above. Zero rows reach a token with no rule mentioning it at all.

Draining the no-label-match/no-token buckets is a JOIN-technique
improvement (a DOM-aware or nested-element-aware class reader), not a CSS
fix, and is left to a later wave per this ledger's own header. Draining the
no-control-shape bucket is a design-authority judgment call (is a given
bordered-but-unstyled-height class a decoration or a real, un-floored
control?) explicitly out of THIS wave's scope -- see `docs/design/
DEVIATIONS.md` for the ten already adjudicated as decoration.
