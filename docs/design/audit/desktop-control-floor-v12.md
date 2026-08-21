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

## Offenders: 23 (ceiling `DESKTOP_FLOOR_DIVERGENCE_CEILING = 23`)

Every offender's resolved token declares strictly below the height its own
frame draws. Two shapes recur:

**Field-label chips resolve to `.chq-portal-field-label`, `.chq-page-title`,
`.chq-section-label` and similar text-only tokens that declare no
min-height at all (declared 0px).** The pack draws several form field
names ("First name", "Last name", "Company", "Sessions", "Reviewer",
"Speaker", "Form") as bordered/backgrounded chips at 44-46px on
`docs/design/Chautauqua Contacts.dc.html`, `docs/design/Chautauqua Public
and Portal.dc.html`, `docs/design/Chautauqua Settings.dc.html` and
`docs/design/Chautauqua Speakers.dc.html`; the app's corresponding label
element is a plain text token with no drawn box. Whether these are
INTENDED as tap-floored controls, or the frame is drawing a field-name
eyebrow as a decorative chip that the app correctly renders as plain text,
is a design call this ledger does not make -- it reports the divergence as
measured, per this scan's own literal DRAWN CONTROL definition (any
bordered/backgrounded, radius-bearing, min-height-bearing element), not a
judgment about interactivity.

**Two "Sign in" buttons and one "API docs ›" link resolve to
`chq-home-signin` / `chq-home-action-tertiary`, both undeclared anywhere.**
`docs/design/Chautauqua Account.dc.html`:51/318 and `docs/design/Chautauqua
Home.dc.html`:214/285 draw the sign-in button at 46-48px;
`docs/design/Chautauqua Home.dc.html`:286 draws the tertiary API-docs link
at 46px. Neither token carries a min-height rule anywhere in the corpus.

**Four rows resolve to a real, non-zero, but insufficient declared
height.** `docs/design/Chautauqua Public and Portal.dc.html`:1003/1289 draw
"Submit this talk" at `min-height:50px`; the resolved `chq-btn
chq-btn-primary` pairing declares 48px. `docs/design/Chautauqua Public and
Portal.dc.html`:1004/1290 draw "Save draft" at `min-height:48px`; the
resolved `chq-btn chq-btn-secondary chq-cfp-save-draft` pairing declares
46px. Both are 2px short of their own frame's drawn value, not an absent
rule.

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
