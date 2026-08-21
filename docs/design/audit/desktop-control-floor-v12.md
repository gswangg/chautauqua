# Desktop drawn-floor v12 audit (task w7-db, DEC-393 wave-151 amendment)

Measured by `test/desktop-control-floor.scan.test.ts` on this branch. This
file MEASURES ONLY -- it changes no product CSS byte, and desktop stays
frozen. See that file's own header for the full population/join/grade
methodology.

## Population

266 drawn controls across 12 of the 13 `docs/design/*.dc.html` files (108
desktop frames total; `Chautauqua Docs.dc.html` draws none of the qualifying
shape). Drawn-floor histogram: `min-height:46px` is the most common value
(200 of 266), well ahead of the ruled `min-height:44px` minimum (15 of 266)
-- the same shape DEC-393's wave-151 amendment's own census names for the
whole desktop population, confirmed again inside just the DRAWN-CONTROL
subset this scan grades.

## Offenders: 14 (ceiling `DESKTOP_FLOOR_DIVERGENCE_CEILING = 14`, was 23)

WAVE 155 (DEC-393 amendment, task pe) split the wave-151 population of 23
into DRAINED (9 real-control offender rows, fixed by 4 scoped desktop
rules), BLESSED (12 field-name-eyebrow rows, documented as a class, no CSS
moved), and two rows that are neither -- left as live, unaddressed
offenders. 9 + 12 + 2 = 23; 23 - 9 = 14, the new measured ceiling.

### Drained (9 rows, 4 scoped desktop rules)

**`chq-home-signin` -- "Sign in", 4 rows.** `docs/design/Chautauqua
Account.dc.html`:51 (frame "Sign in · a card, not a stretched phone") and
`:318` (frame "Sign in · rejected") draw 46px; `docs/design/Chautauqua
Home.dc.html`:214 (frame "{{ e.name }}") draws 46px and `:285` (frame
"Fresh deploy · desktop") draws 48px. The token carried no min-height rule
anywhere. Fixed in `src/routes/public/home.css.ts`'s desktop scope (outside
its `@media (max-width: 700px)` block, which already floors the same token
at 44px for phone and is unchanged) with `min-height: 48px` -- the max of
the two drawn values, since the scan grades declared-at-least-drawn, not
equality -- plus centred flex and horizontal padding so the reserved
height is actually filled.

**`chq-home-action-tertiary` -- "API docs ›", 1 row.**
`docs/design/Chautauqua Home.dc.html`:286 (frame "Fresh deploy · desktop")
draws 46px; the token carried no min-height rule anywhere (only its own
44px phone floor existed). Fixed in `src/routes/public/home.css.ts`'s
desktop scope with a `min-height: 46px` rule kept deliberately SEPARATE
from the token's main declaration block -- that block's own preceding
comment names the sibling `chq-home-action-quiet` token with a leading
dot, and this scan reads comment text as part of the following rule's raw
selector, so folding the min-height into that block's body would have
falsely credited the quiet token too (verified: it did, before the split).

**`chq-btn-primary` (CFP submit pairing) -- "Submit this talk", 2 rows.**
`docs/design/Chautauqua Public and Portal.dc.html`:1003 and `:1289` (both
frame "Submit a talk") draw `min-height:50px`; the resolved `chq-btn
chq-btn-primary` pairing declared 48px (the shared house register, from
other pages' rules -- the CFP page's own primary button rule declared no
min-height at desktop scope at all). Fixed with a rule SCOPED to the CFP
action pairing, `.chq-cfp-actions .chq-btn-primary { min-height: 50px; }`,
added to `src/routes/public/cfp.css.ts` outside its `@media (max-width:
700px)` block (whose own `.chq-cfp-actions .chq-btn-primary { flex: 1;
min-height: 48px; }` phone rule is unchanged) -- never by raising
`.chq-btn-primary`'s shared desktop register in `src/views/theme.ts`.

**`chq-cfp-save-draft` (CFP save-draft pairing) -- "Save draft", 2 rows.**
`docs/design/Chautauqua Public and Portal.dc.html`:1004 and `:1290` (both
frame "Submit a talk") draw `min-height:48px`; the resolved `chq-btn
chq-btn-secondary chq-cfp-save-draft` pairing declared 46px (the shared
`chq-btn-secondary` house register; the token's own `min-height:48px`
declaration lives inside `cfp.css.ts`'s phone `@media` block, stripped
before desktop grading). Fixed with `.chq-cfp-actions .chq-cfp-save-draft {
min-height: 48px; }`, added to `src/routes/public/cfp.css.ts` outside the
`@media` block (the phone rule at `.chq-cfp-save-draft { min-height: 48px;
... }` inside it is unchanged) -- never by raising `chq-btn-secondary`'s
shared register.

### Blessed (12 rows -- field-name eyebrows, a CLASS not a per-row allowlist)

Recorded in full, with reasoning, in `docs/design/DEVIATIONS.md`'s
"Field-name eyebrows drawn as bordered chips, rendered as plain text"
entry (section 6). Summary: the pack draws a plain field-name or
section-name label ("First name", "Last name", "Company", "Sessions",
"Reviewer", "Speaker", "Form") inside a bordered chip shape at 44-46px;
the app correctly renders the SAME name as an unbordered text label via
`.chq-portal-field-label`, `.chq-page-title`, or `.chq-section-label` --
none of which is a control anywhere in the app (no click handler, no href,
no form association), so none needs or carries a min-height. A scan cannot
infer interactivity from a border; these twelve rows stay in the ledger's
offender count (the scan has no decoration/control distinction to encode a
waiver into) but no CSS byte moved for them:

`docs/design/Chautauqua Contacts.dc.html`:601 "Speaker", `:602`
"Reviewer", `:824` "First name", `:828` "Last name", `:839` "Company";
`docs/design/Chautauqua Public and Portal.dc.html`:1435 "First name",
`:1439` "Last name"; `docs/design/Chautauqua Settings.dc.html`:1287 "First
name", `:1291` "Last name", `:1302` "Reviewer";
`docs/design/Chautauqua Speakers.dc.html`:209 "Form".

### Neither drained nor blessed (2 rows -- real, unaddressed, flagged for a later wave)

These two are genuine controls (not field-name-eyebrow decoration) but
were not named in this wave's drain list; left as live offenders rather
than silently absorbed into either bucket above:

- `docs/design/Chautauqua Account.dc.html`:225 -- "Back to sign in" (frame
  "Reset · link sent") draws `min-height:46px`; resolves to
  `chq-auth-tertiary`, declared 0px.
- `docs/design/Chautauqua Submissions.dc.html`:314 -- "Waitlist" (frame
  "Submission detail · /submissions/:id") draws `min-height:44px`;
  resolves to `chq-overview-btn chq-overview-btn-waitlist`, declared 0px
  (44px is already the ruled floor, so this is a near-miss rather than a
  large gap, but the scan still grades it strictly-below).

One measured false-positive was closed by the JOIN's own attribute-value
guard before this ceiling was seeded, and is recorded here as a receipt of
the guard's necessity rather than as a live offender:

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
asserting a false divergence.

## Unresolved: 129 (ceiling `DESKTOP_FLOOR_UNRESOLVED_CEILING = 129`)

91 rows have no boundary-anchored match for their label anywhere in the
normalized `app/src/**` + `src/**` corpus at all (fixture/mock content,
composed-from-data labels, or labels this scan's plain-substring search
cannot reach -- the same shape
`test/desktop-control-label.scan.test.ts`'s own FIXTURE/COMPOSED
exclusion tables name for the WORDS ledger, unexamined here). 38 rows match
a label but the JOIN's same-tag, text-node-only class reader could not
extract a `chq-` token from the enclosing element -- most commonly because
the rendered label sits inside a NESTED child element (a `<span>` wrapping
plain text, itself inside the classed control) one level below the element
carrying the class, which this scan's single-tag reader does not walk into
by design (mirroring `test/desktop-control-label.scan.test.ts`'s own
SPAN_RE/ANCHOR_RE same-tag-only extraction, ported into this ledger's
population side). Zero rows reach a token with no rule mentioning it at all
-- every extracted token that fails to resolve to a min-height still
resolves to SOME rule (the offender-at-0 shape above), not an absent one.

Draining the unresolved bucket is a JOIN-technique improvement (a DOM-aware
or nested-element-aware class reader), not a CSS fix, and is left to a
later wave per this ledger's own header.
