# CFP legend/label register (task w32-d)

Builds DEC-613's own unbuilt second clause (`src/decisions-data/DEC-613.md:97`,
wave-27 amendment): "because a one-row fix would leave the next abbreviation
to be re-litigated (DEC-180), the whole register is derived: every
`<legend>`/`<label>` literal the CFP frames draw is resolved to either a
stored field label or page chrome, recorded as a pair, and pinned by a real
`app.request()` through GET /submit/:eventSlug — a source scan is not a
render."

That clause was recorded (DEC-613's wave-27 amendment text itself, and the
audit ROW closed by v12m-w25-h in `public-390-verdicts-v12.md`) but never
built — no register file existed in the tree before this task (grepped
before starting; nothing matched). This file is the register; the pin lives
in `test/cfp-legend-register.test.ts`, which dispatches real
`app.request()` calls through `publicSubmitRoutes` — no `.tsx`/`.ts` source
file is read as text for any assertion in that file.

## Population and method

Population: every span matching `font-size:11px; font-weight:800;
...text-transform:uppercase` (the field-eyebrow style) plus every rendered
`<legend>` counterpart, walked programmatically
(`extractEyebrowSpans()` in the test file, never a hand-list — DEC-180) over
the two "Submit a talk" frame extents this task named:

- **Desktop** — `docs/design/Chautauqua Public and Portal.dc.html:891-1009`
  (badge `Public` at :893, Format eyebrow at :942 as named by the task).
  12 eyebrow spans found; ceiling forced to `-1` in the test (DEC-808) so a
  population change fails loudly rather than silently under/over-counting.
- **390** — `:1016-1064` (badge `390` at :1012, Format legend at :1051 as
  named by the task, `verbatimLine`-pinned). 5 eyebrow spans found.

## Register

Each row: `{line(s), drawn literal, class, shippedValue, owning file}`.
STORED-FIELD-LABEL rows assert the SEEDED label renders (never the frame's
own literal when the two differ, per DEC-613 wave-27); PAGE-CHROME rows
assert the route's own hardcoded/derived copy.

| Frame line(s) | Drawn literal | Class | Shipped value (this seed) | Owning file |
|---|---|---|---|---|
| D:918, P:1031 | `Title` | STORED-FIELD-LABEL | `Title` (seed matches) | `src/views/form-render.tsx` (`field.label`) |
| D:924, P:1036 | `Abstract` | STORED-FIELD-LABEL | `Description` (seed deliberately differs — proves the SEEDED label ships, the frame's abbreviation is never adopted) | `src/views/form-render.tsx` (`field.label`); only `helpText` is overridden by `CFP_ABSTRACT_HELP_TEXT`, `submit-views.tsx` |
| D:933, P:1042 | `Track` | PAGE-CHROME | `Track` (component literal; `trackIds` has no `FormFieldDef`, so there is no stored label to defer to) | `src/routes/public/submit-views.tsx` `TrackChoices` (`<legend>Track</legend>`) |
| D:942, P:1051 | `Format` | STORED-FIELD-LABEL | `Session format` (seed deliberately differs — the DEC-613 wave-27 finding this whole register generalises) | `src/routes/public/submit-views.tsx` `FormatChoices` (`<legend>{field.label}</legend>`) |
| D:953 | `Audience level` | STORED-FIELD-LABEL | `Audience level` (seed matches) | `src/routes/public/submit-views.tsx` `AudienceChoices` (`<legend>{field.label}</legend>`) |
| D:962 | `Notes for reviewers · optional` | STORED-FIELD-LABEL | `Notes for reviewers · optional` (label + `OPTIONAL_SUFFIX` auto-appended for `required:false`) | `src/views/form-render.tsx` (`field.label` + `src/domain/form-copy.ts`'s `OPTIONAL_SUFFIX`) |
| D:967 | `Accessibility needs · optional` | STORED-FIELD-LABEL | `Accessibility needs · optional` (label + `OPTIONAL_SUFFIX`) | `src/views/form-render.tsx` |
| D:979 | `Name` | PAGE-CHROME | `Name` (hardcoded; ignores whatever `first_name`/`last_name` rows carry as their own labels) | `src/routes/public/submit-views.tsx` `NameField` |
| D:983 | `Email` | STORED-FIELD-LABEL | `Email` (seed matches) | `src/views/form-render.tsx` |
| D:987 | `Company · optional` | STORED-FIELD-LABEL | `Company · optional` | `src/views/form-render.tsx` |
| D:991 | `Job title · optional` | STORED-FIELD-LABEL | `Job title · optional` | `src/views/form-render.tsx` |
| D:995 | `Bio · optional` | PAGE-CHROME | `Bio · optional` (seed's stored label was set to `Speaker biography` for this test specifically to prove `CFP_BIO_LABEL` overwrites it unconditionally — `Speaker biography` never reaches the response) | `src/routes/public/submit-views.tsx` (`CFP_BIO_LABEL` constant, applied in `SubmitPage`'s `displayFields.map`) |
| P:1022 | `Step 1 of 2 · your talk` | PAGE-CHROME | `Step 1 of 2 · your talk` (verbatim; already covered separately by `test/public-390-frame-verdicts.test.ts`'s `:1017 Submit a talk` verdict, DEC-986 two-step phone chrome) | `src/routes/public/submit-views.tsx` (`.chq-cfp-steps-label`) |

13 distinct literal positions (Title/Abstract/Track/Format counted once each
even though they are drawn at both widths); every one pinned by a real
`app.request('/submit/test-conf')` call in `test/cfp-legend-register.test.ts`
(15 tests: 2 enumeration + 9 STORED-FIELD-LABEL + 4 PAGE-CHROME).

## DIVERGES rows

None (DEC-099 wave-14m clause 1: this heading and paragraph record the
absence of a divergence, adjudicated by citing that ruling here). Every
PAGE-CHROME entry's shipped value matches the frame's own drawn literal
exactly (`Track`, `Name`, `Bio · optional`, `Step 1 of 2 · your
talk`). No fix was required or made — this task is measurement-only and
touched no route module or `.css.ts` (per its own scope).

## Notes on classification boundaries

- **Track** has no `FormFieldDef` at all (`trackIds` posts as a join-table
  array, not a stored answer) — DEC-613's own carve-out in
  `TrackChoices`'s w54-e comment. There is no stored label to defer to, so
  it is PAGE-CHROME by construction, not by omission.
- **Bio** is the one row where a stored field DOES exist but the route
  overrides its label unconditionally (`CFP_BIO_LABEL`) — classified
  PAGE-CHROME because the pack, not the organiser's `form_field` row, is
  authority over what renders. The register's own test seeds a
  deliberately different stored label (`Speaker biography`) specifically to
  make this override observable rather than accidentally-correct.
- **Audience level** and **Notes for reviewers**/**Accessibility needs**
  only appear in the desktop extent (:891-1009); the 390 frame's "Submit a
  talk" step 1 view is cut off after Format (:1051), before the dock —
  confirmed by the enumeration test's 5-item 390 list.
