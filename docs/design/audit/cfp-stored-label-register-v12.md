# CFP stored-label register (DEC-613 wave-27 amendment)

## Why this file exists

`docs/design/audit/public-390-verdicts-v12.md` carried the campaign's one
remaining explicitly-open design question: `Chautauqua Public and
Portal.dc.html:1051` draws the bare legend "Format" while `FormatChoices`
renders `<legend>{field.label}</legend>` over a stored label of "Session
format". That audit correctly refused to invent a ruling — shortening the
legend renames a real `form_field` row for every organiser.

The identical question was already settled one control to the right:
`src/routes/public/cfp.css.ts`'s own comment records the DEC-613 wave-96
ruling that the step-1 dock's drawn "Draft" is a drawing abbreviation and
the control's accessible name stays "Save draft" at every width — one
control, one name. `src/decisions-data/DEC-613.md`'s wave-27 amendment
extends that same rule to stored FIELD labels: **a frame's abbreviated
legend never renames stored data; the stored label ships at every width.**

Per DEC-180 ("a hand-listed population is not a population"), this file
does not fix the one Format row — it derives the WHOLE register: every
`<legend>`/`<label>`-position literal caption the CFP frames draw, resolved
to either a stored `form_field` label or page chrome, recorded as a pair.
`test/cfp-stored-label-register.test.ts` pins it with a real
`app.request("/submit/test-conf")`, not a source scan.

## Frames enumerated

All three "Submit a talk" frames in `docs/design/Chautauqua Public and
Portal.dc.html` that draw the CFP form's field captions:

- **Desktop**, `:894`–`:1013` ("Submit a talk · /submit/:slug")
- **Phone 390**, `:1014`–`:1100` ("Submit a talk", step 1 of the wizard)
- **Rejected-on-submit / error re-render**, `:1211`–`:1290` ("Submit a talk
  · rejected on submit")

All three draw the same caption vocabulary (the phone and error frames each
draw a subset of the desktop frame's full field set); no caption appears in
one frame that isn't already covered by the desktop frame's superset.

`docs/design/Chautauqua Submissions.dc.html`'s `:399`–`:560` and `:655`+
frames ("CFP form builder", "CFP form · 390", "CFP form · edit a question")
were also checked and are **out of population**: those frames render the
*admin's* field editor, where every caption is the templated
`{{ f.label }}`/`{{ f.hint }}` (the label being AUTHORED, not consumed) —
there is no literal legend/label caption to resolve there, only the same
templating vocabulary every list row in the pack uses.

## The register

| Frame caption (as drawn) | Position | Field id / role | Verdict | Stored label | Fixture-verified |
|---|---|---|---|---|---|
| Title | field caption | `title` | **STORED** | Title | yes |
| Abstract | field caption | `description` | **STORED** | Description | yes |
| Track | group legend | *(no `FormFieldDef`; `trackIds` is a join-table posted array — `TrackChoices`' own w54-e comment)* | **CHROME** | — | yes |
| Format | group legend | `field_session_format` (role `session_format`) | **STORED** | Session format | yes — the motivating row |
| Audience level | group legend | role `audience_level` | **STORED** (code-path identical to Format's `FormatChoices`/`AudienceChoices` pass-through) | Audience level | no — role absent from the shared `FIELD_ROWS` fixture; resolved by reading `AudienceChoices`' `<legend>{field.label}</legend>`, not independently rendered |
| Name | field caption | *(deliberate single-control collapse of `first_name`+`last_name`, DEC-986 wave-45 amendment)* | **CHROME** — already ruled: one posted control, not a stored field's own label | — | yes |
| Email | field caption | `email` | **STORED** | Email | yes |
| Company · optional | field caption | `company` | **STORED** (code-path identical to Title/Email's generic `FormField`) | Company | no — id absent from the shared `FIELD_ROWS` fixture |
| Job title · optional | field caption | `job_title` | **STORED** (code-path identical to Title/Email's generic `FormField`) | Job title | no — id absent from the shared `FIELD_ROWS` fixture |
| Bio · optional | field caption | `bio` | **CONFLICT** — see below | Speaker bio | yes |
| Notes for reviewers · optional | field caption | `field_notes_for_reviewers` | **STORED** | Notes for reviewers | yes |
| Accessibility needs · optional | field caption | `field_accessibility_needs` | **STORED** | Accessibility needs | yes |

"· optional" is not part of any stored label — it is `FormField`'s generic
`OPTIONAL_SUFFIX` badge (src/views/form-render.tsx`field.required === false`), appended whenever
that condition holds, identical machinery for every optional field on
the form. It is page chrome layered on top of a stored label, not a
renaming of one, and is excluded from the caption column's stored/abbreviated
comparison.

"Save draft" (the wave-96 precedent this amendment generalises) is a
**control's accessible name**, not a `<legend>`/`<label>` over a stored
field, so it is not a row in this register — it is cited above as the
governing analogy, per the brief.

## The one CONFLICT: Bio

`src/routes/public/submit-views.tsx`'s `CFP_BIO_LABEL` constant (`"Bio"`,
`:39`) is a **display-only override** applied to the locked `bio`
`FormFieldDef` at render time (`:462-463`): the stored `form_field.label`
for that row is "Speaker bio" (see `FIELD_ROWS` in both
`test/submit-cfp-frame-copy.test.ts` and this file's mirrored copy), but the
rendered `<span class="chq-field-label">` ships the frame's shortened
"Bio", exactly as `Chautauqua Public and Portal.dc.html:102`/`:1246` draws
it.

This was built deliberately (w5-c, cited at `submit-views.tsx:31-33`),
**before** this amendment existed, and it is the exact pattern the wave-96
precedent and this amendment both rule against: the frame's abbreviated
caption overriding a stored label rather than the stored label shipping
verbatim. `test/cfp-stored-label-register.test.ts`'s
`"CONFLICT row (flagged, not fixed...)"` test pins the CURRENT (conflicting)
behavior as a receipt of the divergence, not as an endorsement of it.

**This task changes no product byte** (per the brief: `submit-views.tsx` is
out of scope). The Bio override is flagged here as a finding for a future
lane: either the ruling gets a narrow, named exception for Bio (the frame
draws "Bio" consistently at every width it appears, unlike Format, which
only abbreviates on this one control), or `CFP_BIO_LABEL`'s override is
removed and the stored "Speaker bio" ships everywhere, matching the rest of
this register. Undecided; not built either way by this task.

## Verdict grammar

- **STORED** — the position resolves through a real `form_field`-shaped
  record (a seeded `FIELD_ROWS` row, read by `field.id`/`field.role`); the
  frame's caption at that position is a drawing abbreviation and the
  product ships the stored label unmodified. Per this amendment, this is
  the REQUIRED behavior.
- **CHROME** — the position is not backed by any `form_field` row (no
  `FormFieldDef` exists for it, or the control deliberately collapses
  multiple stored fields into one UI control per an earlier, separate
  ruling). The frame's caption is real page vocabulary, not an
  abbreviation of anything stored.
- **CONFLICT** — the position IS backed by a stored `form_field` row, but
  the product currently ships the frame's abbreviated caption instead of
  the stored label, contradicting this amendment. Exactly one such row
  exists today (Bio).
