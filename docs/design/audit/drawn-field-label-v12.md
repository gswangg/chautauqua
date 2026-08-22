# Drawn FIELD-label ledger (DEC-613 wave-25, task w25-i; re-measured wave-28, wave-33)

This ledger was built while several product lanes were still repairing rows
it counts. Every one of those lanes (Settings Event name/Starts/Ends,
Comms From which plan's own sibling fixes, and the Bio/session-field work)
has since landed on main. The grades below are re-measured against the
current, integrated tree as part of DEC-613's wave-28 amendment, which also
made this ledger the sole surviving drawn-FIELD-label instrument after
resolving a duplicate-instrument conflict with the now-retired
`test/frame-field-label.scan.test.ts` (see DEC-613's wave-28 amendment for
the full symmetric-difference evidence).

Wave-33's task w33-c (implementing DEC-613's own still-unbuilt wave-32
amendment) adopted two of the drawn labels below into product code (Contacts
"Message", Submissions "Options · one per line") and verified the third
(Comms "From which plan") was already built, retiring all three rows from
the open-divergences list — see "Divergences" below for the retirement note
and the per-row table for each row's current HARDCODED-MATCHES citation.

## Why this ledger exists

DEC-613's own opening names the gap directly: "No ledger in the campaign
grades drawn FIELD labels. `test/desktop-control-label.scan.test.ts` and
`test/frame-control-label.scan.test.ts` both derive control-shaped
populations (footer bands, 44px anchors, painted spans); the field-width
ledger reaches field labels only as a JOIN KEY and, when the join misses,
files an honest UNRESOLVED." `docs/design/audit/desktop-field-width-v12.md`'s
own Adjudications say two of its own rows are "a genuine label-text
mismatch, not a width finding" — and no instrument was ever built to grade
that fact directly. Two v12 divergences it would have caught (Settings
Event name/Starts/Ends — since fixed by wave-24's task w24-e — and Comms
"From which plan" — still open) were found by hand instead of by any
instrument.

Building this instrument found a **third**, previously unrecorded
divergence of the same shape: Contacts "Message" vs. `BulkEmailModal.tsx`'s
"Body", adjudicated under DEC-613's own adoption rule as a genuine open
outlier (DEC-613). See the DIVERGES rows below, each individually
adjudicated in place.

This lane is **MEASURE AND FILE ONLY** (task w25-i's own hard clause): it
fixes no divergence and touches no product code.

## Population

Every `<span style="...">` in `docs/design/*.dc.html` (enumerated via
`readdirSync`, never a hand-listed manifest) whose style carries the pack's
field-label shape — `font-size:11px; font-weight:800; letter-spacing:0.1em;
text-transform:uppercase` in that literal order (the pack's own consistent
authoring order; verified by grepping every `font-size:11px` style
attribute in the tree — the other weight-800/11px combinations use a
different letter-spacing, 0.08em/0.09em/0.12em, a different visual register
the frames use for pills, badges and mini-eyebrows, not field labels), and
whose label text is not a template interpolation (`{{...}}`, DEC-613's own
"not an interpolation" clause), and which sits **immediately above an
input-shaped box**: the very next tag in the markup (skipping only
whitespace) is a `<div style="...">` whose style carries `border:`.

This is the frame's own convention, verified against dozens of sightings: a
label span opens a `gap:6px` column wrapper, and the field's bordered value
box is its very next sibling. A label followed by anything else — a plain
text span (a display-only heading, e.g. "DevFlow Conf 2027" on the 404
card), a link row ("No account?"), a chip-group wrapper with no border of
its own ("Kind"/"Stage"/"Role" as multi-select chip rows), an `<h1>`, an
`sc-for` loop, a mustache-templated wrapper (`{{ q.inputStyle }}`) — is NOT
a field label over an input box, and is excluded at the population step
itself, never drained later.

**128 rows** result (widened from 121 by the wave-28 DEC-613 amendment: a
label sharing its row with a `font-size:12px` counter/helper caption, then
closing, then meeting its bordered box one level out, is the SAME
"label sits directly above its own value box" convention one wrapper
deeper -- see `test/drawn-field-label.scan.test.ts`'s `tailOpensInputBox`
for the exact grammar and the one false positive its `font-size:12px`
restriction was verified to exclude) — both desktop and phone (390)
non-empty, per this ledger's own non-vacuity guard
(`test/drawn-field-label.scan.test.ts`).

## Grading

Each row gets one of four verdicts:

- **STORED-FIELD-LABEL** — the label is organizer-editable FormFieldDef
  data (a `field.label`/`f.label` read, never a JSX string literal). Found
  at two render sites sharing the same mechanism: `src/views/form-render.tsx`'s
  `{field.label}` (the public CFP submission form,
  `src/routes/public/submit-views.tsx`'s speaker/session FormFieldDef
  sections) and the speaker portal's session-edit form
  (`src/routes/portal/edit.tsx`'s `FormFieldsSection`).
- **HARDCODED-MATCHES** — the frame's label occurs verbatim,
  boundary-anchored, in the non-test `app/src/**`+`src/**` corpus (reusing
  `test/frame-source-corpus.ts`'s `normalizeSource`/`labelIsMatched`
  primitives, never re-derived — DEC-613's own trap, one level in), either
  as a direct literal or COMPOSED from a literal base plus a shared,
  verified constant/expression (the ` · optional` suffix is
  `src/domain/form-copy.ts`'s `OPTIONAL_SUFFIX`, rendered as a sibling
  `<span>`; "What Marcus will read" is `RemindPreviewModal.tsx`'s literal
  `What {firstNameOf(first.name)} will read` template).
- **HARDCODED-DIVERGES** (DEC-613's own adoption rule: the grade for a
  hardcoded label that exists for the field but spells it in different
  words than the frame draws) — every such row below carries its own
  DEC-613 or `docs/design/DEVIATIONS.md` citation on the same table row,
  never a blanket reference here.
- **UNRESOLVED** — the join genuinely fails: no code renders the field at
  all (a DEVIATIONS.md §6 deferred, unbuilt feature).

**Totals (DEC-613 wave-33 re-measurement, task w33-c): 103 HARDCODED-MATCHES, 3
HARDCODED-DIVERGES, 21 STORED-FIELD-LABEL, 1 UNRESOLVED** — partitions the
128-row population exactly; see the per-row table below for every
DIVERGES row's own citation.

A first-pass automated corpus search miscited a few rows (a coincidental
boundary-anchored match on an unrelated string — e.g. "Email" matching
`BulkEmailModal.tsx`'s `` `Email ${countOf(...)}` `` template before the
real `auth-views.tsx` site was found, or "Message" matching
`email-binding.ts`'s `Message-ID:` mail header before the real
`BulkEmailModal.tsx` site was found by hand). Every row below was
individually verified against this branch's tree. Wave-33's task w33-c
adopted the frame's "Message" (Contacts) and "Options · one per line"
(Submissions) spellings into the two components that used to diverge, and
verified `ComposeWizard.tsx` (Comms "From which plan") already rendered the
frame's exact words — all three rows now grade HARDCODED-MATCHES.

## Ratchets

Two-sided per DEC-808, seeded at the measured value on this branch (DEC-613
wave-33 amendment, task w33-c: DIVERGENCE_CEILING re-measured 6 -> 3 after
the Contacts "Message", Submissions "Options · one per line", and Comms
"From which plan" rows were adopted/verified matches):

- `DRAWN_FIELD_LABEL_DIVERGENCE_CEILING = 3`
- `DRAWN_FIELD_LABEL_UNRESOLVED_CEILING = 1`

Registered in `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE`, the
same disposition `FIELD_WIDTH_DIVERGENCE_CEILING`/
`FIELD_WIDTH_UNRESOLVED_CEILING` already carry: a newly measured population
must not move the campaign's exit-gate goalposts mid-convergence.

## Divergences (open, not fixed by this lane)

Every row below is individually adjudicated (a DEC-613 citation resolving
it as a real, recorded outlier, or a `docs/design/DEVIATIONS.md` section)
so no row is silently OPEN against `test/open-divergence-ledger.scan.test.ts`.

1. `Chautauqua Settings.dc.html:739` and `:1253` (two drawn instances of
   the same field) "Public URL" vs. `EventSettingsPanel.tsx`'s "Slug" —
   blessed, recorded divergence, `docs/design/DEVIATIONS.md` §7 (DEC-613's
   own carve-out for this exact row).
2. `Chautauqua Settings.dc.html:1429` "Type the file name to confirm" vs.
   `app/src/components/ConfirmDialog.tsx`'s composed
   `Type "${confirmPhrase}" to confirm` — newly found by this ledger;
   adjudicated here under DEC-613's adoption rule as a genuine, still-open
   outlier (the composed phrase is the confirm-phrase's own value threaded
   into the label, not a formatting variant of the frame's generic
   instruction text) with no blessing on record.

(DEC-613 wave-33, task w33-c: the two rows formerly numbered 1 and 2 here —
`Chautauqua Comms.dc.html:102` "From which plan" vs. `ComposeWizard.tsx`'s
then-"Evaluation plan", and `Chautauqua Contacts.dc.html:562` "Message" vs.
`BulkEmailModal.tsx`'s then-"Body" — and the row formerly numbered 5,
`Chautauqua Submissions.dc.html:693` "Options · one per line" vs.
`FieldModal.tsx`'s then-"Options (one per line)", are retired from this
list: `ComposeWizard.tsx` was verified to already render "From which plan"
verbatim, and `BulkEmailModal.tsx`/`FieldModal.tsx` adopted the frame's
"Message"/"Options · one per line" spellings. All three now grade
HARDCODED-MATCHES in the table below.)

## Unresolved

1. `Chautauqua Settings.dc.html:1173` "Keep declined submissions for" —
   falls inside the "Settings · editing your data" panel's "Keeping and
   deleting" retention block, a deliberate, deferred non-build
   (`docs/design/DEVIATIONS.md` §6, DEC-032). No code exists to grade this
   label against.

## Full population by frame

Every row of the 121-row population, grouped by `docs/design/*.dc.html`
file and ordered by line. `HARDCODED-MATCHES` rows whose Reason column
reads "occurs verbatim, boundary-anchored, in the non-test corpus" still
carry a specific path-plus-quote citation in the table's own Citation
column — that generic sentence is the Reason column's fixed text for every
plain-literal match (all such matches share the same grading rule); the
per-row Citation column always names the specific site.

}

### Chautauqua Account.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 42 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Email</span>` |
| 46 | Password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Password</span>` |
| 79 | Current password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/account.tsx`<span className="chq-auth-label">Current password</span>` |
| 83 | New password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">New password</span>` |
| 87 | New password again | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">New password again</span>` |
| 129 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Email</span>` |
| 133 | Password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Password</span>` |
| 160 | Current password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/account.tsx`<span className="chq-auth-label">Current password</span>` |
| 164 | New password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">New password</span>` |
| 168 | New password again | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">New password again</span>` |
| 194 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Email</span>` |
| 247 | New password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">New password</span>` |
| 252 | New password again | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">New password again</span>` |
| 309 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Email</span>` |
| 313 | Password | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/auth-views.tsx`<span className="chq-auth-label">Password</span>` |

### Chautauqua Agenda.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 232 | Label | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/agenda/BreaksPanel.tsx`>Label</label>` |
| 236 | Starts | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/agenda/BreaksPanel.tsx`<label htmlFor="chq-break-start">Starts</label>` |
| 240 | Minutes | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/agenda/BreaksPanel.tsx`<label htmlFor="chq-break-duration">Minutes</label>` |

### Chautauqua Comms.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 102 | From which plan | HARDCODED-MATCHES | wave-33 (task w33-c): verified the compose wizard already renders the frame's exact words; the "Evaluation plan" shortening the divergence used to cite survives only inside this file's own explanatory comment. | app/src/pages/comms/ComposeWizard.tsx`From which plan` |
| 255 | Subject | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/comms/ComposeWizard.tsx`<FormRow label="Subject" htmlFor="compose-subject">` |
| 259 | Body | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/comms/ComposeWizard.tsx`<FormRow label="Body" htmlFor="compose-body">` |

### Chautauqua Contacts.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 559 | Subject | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/contacts/BulkEmailModal.tsx`<FormRow label="Subject" htmlFor="bulk-email-subject" error={fieldErrors.subject}>` |
| 562 | Message | HARDCODED-MATCHES | wave-33 (task w33-c): adopted the frame's "Message" spelling into BulkEmailModal.tsx's FormRow label (the htmlFor/name/error wiring and the bodyText field id were left untouched -- label only). | app/src/pages/contacts/BulkEmailModal.tsx`<FormRow label="Message" htmlFor="bulk-email-body" error={fieldErrors.bodyText}>` |
| 566 | Template | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/contacts/BulkEmailModal.tsx`<FormRow label="Template" htmlFor="bulk-email-template" optional>` |
| 595 | Event | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/contacts/AddToEventModal.tsx`<FormRow label="Event">` |
| 654 | Why them | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus (wave-28 DEC-613 amendment: found by the widened tailOpensInputBox caption-sibling clause). | app/src/pages/contacts/PipelineBoard.tsx`<OptionalFieldRow label="Why them" htmlFor="pipeline-enroll-rationale" helper="One line · shown on the card">` |
| 823 | First name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/contacts/ContactDrawer.tsx`firstName: 'First name',` |
| 827 | Last name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/contacts/ContactDrawer.tsx`lastName: 'Last name',` |
| 832 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/contacts/NewContactModal.tsx`label="Email"` |
| 838 | Company · optional | HARDCODED-MATCHES | Composed from FormRow's literal label="Company" plus the shared OPTIONAL_SUFFIX constant (" · optional") -- both concatenate to render as sibling <span> elements rather than one literal string. | app/src/pages/contacts/NewContactModal.tsx`<FormRow label="Company" htmlFor="new-contact-company" error={fields.company} optional>` |
| 842 | Title · optional | HARDCODED-MATCHES | Same FormRow optional-suffix composition as :838, label="Title". | app/src/pages/contacts/NewContactModal.tsx`<FormRow label="Title" htmlFor="new-contact-title" error={fields.title} optional>` |

### Chautauqua Overview.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 321 | Name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/ApiTokensPanel.tsx`<th>Name and prefix</th>` |
| 324 | Slug | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`slug: 'Slug',` |
| 328 | Starts | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`startDate: 'Starts',` |
| 332 | Ends | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`endDate: 'Ends',` |
| 336 | Time zone | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`{/* DEC-731 (wave 8 amendment): the frame draws Time zone as a` |
| 339 | Venue | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`location: 'Venue',` |

### Chautauqua Public and Portal.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 608 | Title | STORED-FIELD-LABEL | Session title is a locked FormFieldDef rendered by FormFieldsSection inside the speaker-portal session-edit form -- the SAME dynamic field.label path the public CFP submission form uses, not a JSX string literal. | src/routes/portal/edit.tsx`<FormFieldsSection fields={data.fields} section="session"` |
| 613 | Abstract | STORED-FIELD-LABEL | Session abstract ("description") is a locked FormFieldDef rendered by FormFieldsSection inside the speaker-portal session-edit form (Portal · Edit your session, phone) -- the same dynamic field.label path as row 608's Title (wave-28 DEC-613 amendment: found by the widened tailOpensInputBox caption-sibling clause). | src/routes/portal/edit.tsx`<FormFieldsSection fields={data.fields} section="session"` |
| 619 | Session length | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<div class="chq-section-label">Session length</div>` |
| 644 | First name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-first-name">` |
| 648 | Last name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-last-name">` |
| 654 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-email">` |
| 660 | Role | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-role">` |
| 918 | Title | STORED-FIELD-LABEL | Session title on the public submission form is `f.label` off the session FormFieldDef. | src/routes/public/submit-views.tsx`const sessionFields = displayFields.filter((f) => f.section === "session");` |
| 924 | Abstract | STORED-FIELD-LABEL | Session abstract on the public submission form (Submit a talk) is `f.label` off the session FormFieldDef, locked field id "description" (wave-28 DEC-613 amendment: found by the widened tailOpensInputBox caption-sibling clause). | src/routes/public/submit-views.tsx`if (lockedFieldName(f.id) === "description") {` |
| 962 | Notes for reviewers · optional | STORED-FIELD-LABEL | "Notes for reviewers" is a session FormFieldDef whose LABEL the code never overrides -- only its placeholder is special-cased by exact label match, itself proof the label is read from the field, not hardcoded. | src/routes/public/submit-views.tsx`if (f.label === "Notes for reviewers") {` |
| 967 | Accessibility needs · optional | STORED-FIELD-LABEL | "Accessibility needs" is a session FormFieldDef, same mechanism as "Notes for reviewers" above. | src/routes/public/submit-views.tsx`if (f.label === "Accessibility needs") {` |
| 979 | Name | STORED-FIELD-LABEL | The collapsed speaker "Name" control is a locked FormFieldDef pair (first_name/last_name) presented as one field by the public submission form (DEC-986 wave-45 amendment). | src/routes/public/submit-views.tsx`const firstNameField = byLockedName("first_name");` |
| 983 | Email | STORED-FIELD-LABEL | Speaker email is a locked FormFieldDef read by the same byLockedName join as Name above. | src/routes/public/submit-views.tsx`const emailField = byLockedName("email");` |
| 987 | Company · optional | STORED-FIELD-LABEL | Speaker company is a locked FormFieldDef, same byLockedName join. | src/routes/public/submit-views.tsx`const companyField = byLockedName("company");` |
| 991 | Job title · optional | STORED-FIELD-LABEL | Speaker job title is a locked FormFieldDef, same byLockedName join. | src/routes/public/submit-views.tsx`const jobTitleField = byLockedName("job_title");` |
| 995 | Bio · optional | STORED-FIELD-LABEL | Speaker bio is a locked FormFieldDef whose stored label ships as-is (DEC-613 wave-19: no label override remains for it). | src/routes/public/submit-views.tsx`if (lockedFieldName(f.id) === "bio") {` |
| 1031 | Title | STORED-FIELD-LABEL | Same session-title FormFieldDef as row 918, a second drawn instance of the same submit form. | src/routes/public/submit-views.tsx`const sessionFields = displayFields.filter((f) => f.section === "session");` |
| 1036 | Abstract | STORED-FIELD-LABEL | Same session-abstract FormFieldDef as row 924, a second drawn instance of the same submit form (wave-28 DEC-613 amendment). | src/routes/public/submit-views.tsx`if (lockedFieldName(f.id) === "description") {` |
| 1240 | Title | STORED-FIELD-LABEL | Same session-title FormFieldDef as row 918, drawn on the "rejected on submit" refusal variant. | src/routes/public/submit-views.tsx`const sessionFields = displayFields.filter((f) => f.section === "session");` |
| 1245 | Abstract | STORED-FIELD-LABEL | Same session-abstract FormFieldDef as row 924, drawn on the "rejected on submit" refusal variant (wave-28 DEC-613 amendment). | src/routes/public/submit-views.tsx`if (lockedFieldName(f.id) === "description") {` |
| 1269 | Name | STORED-FIELD-LABEL | Same collapsed speaker Name FormFieldDef pair as row 979, on the refusal variant. | src/routes/public/submit-views.tsx`const firstNameField = byLockedName("first_name");` |
| 1273 | Email | STORED-FIELD-LABEL | Same speaker-email FormFieldDef as row 983, on the refusal variant. | src/routes/public/submit-views.tsx`const emailField = byLockedName("email");` |
| 1278 | Company · optional | STORED-FIELD-LABEL | Same speaker-company FormFieldDef as row 987, on the refusal variant. | src/routes/public/submit-views.tsx`const companyField = byLockedName("company");` |
| 1282 | Job title · optional | STORED-FIELD-LABEL | Same speaker-job-title FormFieldDef as row 991, on the refusal variant. | src/routes/public/submit-views.tsx`const jobTitleField = byLockedName("job_title");` |
| 1337 | First name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-first-name">` |
| 1341 | Last name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-last-name">` |
| 1347 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-email">` |
| 1353 | Role | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-role">` |
| 1393 | Title | STORED-FIELD-LABEL | Same session-title FormFieldDef as row 918, drawn on the desktop "Edit your session" variant. | src/routes/portal/edit.tsx`<FormFieldsSection fields={data.fields} section="session"` |
| 1398 | Abstract | STORED-FIELD-LABEL | Same session-abstract FormFieldDef as row 613, drawn on the desktop "Edit your session" variant (wave-28 DEC-613 amendment). | src/routes/portal/edit.tsx`<FormFieldsSection fields={data.fields} section="session"` |
| 1404 | Session length | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<div class="chq-section-label">Session length</div>` |
| 1434 | First name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-first-name">` |
| 1438 | Last name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-last-name">` |
| 1445 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-email">` |
| 1450 | Role | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | src/routes/portal/edit.tsx`<label class="chq-portal-field-label" for="cp-role">` |

### Chautauqua Review.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 469 | Opens | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`openDate: { anchorId: 'plan-open-at', label: 'Opens' },` |
| 473 | Closes | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`closeDate: { anchorId: 'plan-close-at', label: 'Closes' },` |
| 477 | Reviews per talk | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`maxEvaluations: { anchorId: 'plan-max-evaluations', label: 'Reviews per talk' },` |
| 481 | Rating scale | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`scale: { anchorId: 'plan-scale-min', label: 'Rating scale' },` |
| 544 | Cap per reviewer | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`{isPhone ? 'Cap each' : 'Cap per reviewer'}` |
| 627 | Weight | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`reviewers · optional</span><span>Type</span><span>Weight</span>` |
| 657 | Cap each | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`{isPhone ? 'Cap each' : 'Cap per reviewer'}` |
| 895 | Opens | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`openDate: { anchorId: 'plan-open-at', label: 'Opens' },` |
| 899 | Closes | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/review/PlanEditor.tsx`closeDate: { anchorId: 'plan-close-at', label: 'Closes' },` |

### Chautauqua Settings.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 451 | Public link | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`{ label: 'Public link', value: publicLinkValue, rowClassName: 'chq-settings-drill-field-row' },` |
| 456 | Closes | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`label: 'Closes',` |
| 517 | Welcome note | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/PortalSettingsPanel.tsx`label: 'Welcome note',` |
| 644 | Opens | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`<SettingsField label="Opens" htmlFor="cfp-open-date" width="date">` |
| 648 | Closes | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`label: 'Closes',` |
| 653 | Time zone | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`<SettingsField label="Time zone" width="date" hint={` |
| 664 | Form name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`<SettingsField label="Form name" htmlFor="cfp-title" width="slug">` |
| 668 | Intro shown above the form | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/CallForPapersPanel.tsx`label="Intro shown above the form"` |
| 735 | Event name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`name: 'Event name',` |
| 739 | Public URL | HARDCODED-DIVERGES | Blessed, recorded divergence (docs/design/DEVIATIONS.md §7): the frame's "Public URL" names a composed origin+slug value the control does not accept -- EventSettingsPanel.tsx keeps the field labeled "Slug", the segment it actually edits. | app/src/pages/settings/EventSettingsPanel.tsx`value={form.slug}` |
| 752 | Starts | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`startDate: 'Starts',` |
| 756 | Ends | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`endDate: 'Ends',` |
| 762 | Time zone | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`timezone: 'Time zone',` |
| 766 | Venue | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`location: 'Venue',` |
| 1059 | Name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/ApiTokensPanel.tsx`<th>Name and prefix</th>` |
| 1063 | Surface | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EmbedsPanel.tsx`Surface` |
| 1067 | Format | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EmbedsPanel.tsx`format: 'Format',` |
| 1071 | Track | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EmbedsPanel.tsx`track: 'Track',` |
| 1173 | Keep declined submissions for | UNRESOLVED | Falls inside the "Settings · editing your data" extent's "Keeping and deleting" retention block, which DEVIATIONS.md §6 / DEC-032 record as a deliberate, deferred non-build (the same extent test/desktop-field-width.scan.test.ts already excludes at its own population step) -- there is no code to grade this label against. | app/src/pages/settings/YourDataPanel.tsx`Recorded as a deliberate non-build on DEC-032.` |
| 1249 | Event name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`name: 'Event name',` |
| 1253 | Public URL | HARDCODED-DIVERGES | The same Event-panel "Public URL"/"Slug" divergence as :739, redrawn on the panel's "Nothing was saved" duplicate-slug error-state frame -- same field, same blessed divergence (docs/design/DEVIATIONS.md §7). | app/src/pages/settings/EventSettingsPanel.tsx`value={form.slug}` |
| 1286 | First name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/PeopleRolesPanel.tsx`<FormRow label="First name" htmlFor="people-invite-first-name" error={fieldErrors.firstName}>` |
| 1290 | Last name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/PeopleRolesPanel.tsx`<FormRow label="Last name" htmlFor="people-invite-last-name" error={fieldErrors.lastName}>` |
| 1295 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`...(mailStatus ? [{ label: 'Email', value: mailStatusSummary(mailStatus) }] : []),` |
| 1371 | First name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/PeopleRolesPanel.tsx`<FormRow label="First name" htmlFor="people-invite-first-name" error={fieldErrors.firstName}>` |
| 1375 | Last name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/PeopleRolesPanel.tsx`<FormRow label="Last name" htmlFor="people-invite-last-name" error={fieldErrors.lastName}>` |
| 1380 | Email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/EventSettingsPanel.tsx`...(mailStatus ? [{ label: 'Email', value: mailStatusSummary(mailStatus) }] : []),` |
| 1429 | Type the file name to confirm | HARDCODED-DIVERGES | The frame draws a generic instruction label ("Type the file name to confirm") over a box holding the actual filename; ConfirmDialog's irreversible-weight prompt instead composes the phrase directly INTO the label text itself -- different words, not a formatting variant. Adjudicated a genuine open outlier under DEC-613's adoption rule. | app/src/components/ConfirmDialog.tsx`Type "${confirmPhrase}" to confirm` |
| 1454 | Name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/settings/ApiTokensPanel.tsx`<th>Name and prefix</th>` |

### Chautauqua Speakers.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 200 | Task | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/speakers/TaskModal.tsx`<FormRow label="Task" htmlFor="task-title" error={fieldErrors.title}>` |
| 203 | Due date | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/speakers/TaskModal.tsx`<FormRow label="Due date" htmlFor="task-due-date" optional error={fieldErrors.dueDate}>` |
| 516 | What Marcus will read | HARDCODED-MATCHES | RemindPreviewModal composes the literal template `What ${firstNameOf(first.name)} will read` -- "Marcus" is the reminder-preview fixture's own first recipient, not a hardcoded name. | app/src/pages/speakers/RemindPreviewModal.tsx`<div className="chq-speakers-modal-label">What {firstNameOf(first.name)} will read</div>` |

### Chautauqua Submissions.dc.html

| Line | Label | Grade | Reason | Citation |
|---|---|---|---|---|
| 273 | Format | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/NewSubmissionModal.tsx`format: { anchorId: 'new-submission-format', label: 'Format' },` |
| 276 | Audience level | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/SubmissionDetailPage.tsx`audienceLevel: { anchorId: 'submission-audience-level', label: 'Audience level' },` |
| 508 | Title | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/NewSubmissionModal.tsx`<FormRow label="Title" htmlFor="new-submission-title" error={fieldErrors.title}>` |
| 511 | Abstract | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/NewSubmissionModal.tsx`description: { anchorId: 'new-submission-description', label: 'Abstract' },` |
| 514 | Speaker name | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/NewSubmissionModal.tsx`<FormRow label="Speaker name" htmlFor="new-submission-speaker-name" optional>` |
| 517 | Speaker email | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/NewSubmissionModal.tsx`'contact.email': { anchorId: 'new-submission-email', label: 'Speaker email' },` |
| 544 | Name it | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/submissions/ViewTabs.tsx`<FormRow label="Name it" htmlFor="save-view-name">` |
| 670 | Section | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Section" htmlFor="field-section">` |
| 674 | Kind | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Kind" htmlFor="field-kind">` |
| 679 | Label | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Label" htmlFor="field-label" help="What the submitter reads">` |
| 684 | Help text · optional | HARDCODED-MATCHES | FieldModal composes label="Help text" plus the same shared OPTIONAL_SUFFIX constant as the Contacts rows above. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Help text" htmlFor="field-help-text" optional>` |
| 693 | Options · one per line | HARDCODED-MATCHES | wave-33 (task w33-c): adopted the frame's middle-dot "Options · one per line" spelling into FieldModal.tsx's FormRow label, retiring the parenthetical "Options (one per line)" divergence. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Options · one per line" htmlFor="field-options" optional>` |
| 706 | Field | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Field" htmlFor="field-rule-trigger">` |
| 710 | Is | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Is" htmlFor="field-rule-op">` |
| 714 | Value | HARDCODED-MATCHES | occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus. | app/src/pages/forms/FieldModal.tsx`<FormRow label="Value" htmlFor="field-rule-value">` |

