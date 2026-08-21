# public-confirmation-body-390-v12: CFP confirmation body, one sentence per state

Task w33-a (DEC-908 wave-33 amendment). Closes §4 of
`docs/design/audit/public-submitted-390-v12.md` (that file lives on the
unmerged branch `v12m-w30-a` and is not edited by this task — the merge
train unions this row on landing rather than treating it as a revert).

## Frame authority

`docs/design/Chautauqua Public and Portal.dc.html`:

- `:1083` fresh — `We emailed priya@example.com a portal link. You can edit
  this talk until 16 Aug.`
- `:1132` pending-existing-contact ("email already known") — `We emailed
  dana@example.com a confirmation, with a link to set a password.`
- `:1155` has-account — `We emailed marcus@example.com a confirmation.`

None of the three frames draws a body sentence above the submission card.

(The task brief cited these at :1074/:1124/:1147; the tree at HEAD has them
at :1083/:1132/:1155 — an ~9-line drift from earlier edits to the same
frame file. `test/public-confirmation-body-390.test.ts` cites the CURRENT
line numbers with a runtime `verbatimLine()` check against the design file
itself, so this row cannot silently rot the way a bare line-number citation
would.)

## What changed

`src/routes/public/submit-views.tsx`'s `ConfirmationPage`:

1. Deleted the close-date `<p class="chq-cfp-confirm-body">You can edit
   this until …</p>` paragraph that rendered ABOVE the card. Nothing now
   renders between the `<h1>` and `.chq-cfp-confirm-card`.
2. Replaced the one generic body sentence (`We've emailed a confirmation
   for "{title}" to {email}.`, shared byte-for-byte across all three
   `ConfirmationState` values) with a new `confirmationBodySentence()`
   helper that returns the frame's own sentence per state, on the
   `emailDelivered` branch only:
   - `fresh`: `We emailed {email} a portal link.` plus, only when
     `form.closeDate` is set, a second sentence ` You can edit this talk
     until {date}.` using the same `dayLabelEndInstant` +
     `formatEventDateTime` expansion the deleted paragraph used (DEC-522).
     No date is ever invented when `closeDate` is null — the sentence
     simply ends after "portal link."
   - `pending-existing-contact`: `We emailed {email} a confirmation, with a
     link to set a password.`
   - `has-account`: `We emailed {email} a confirmation.`
   The `couldn't-send` (non-`emailDelivered`) branch is untouched — no
   frame draws a failure state, and "we emailed you" would be false there.
3. Deleted the now-duplicated `<p>That email includes a link to set a
   password.</p>` paragraph in the `pending-existing-contact` branch — its
   claim is now folded into sentence 2 above, satisfying G13's "never state
   the address twice in consecutive sentences" rule via the fold rather
   than via a second paragraph. The adjacent `Already have a password? Log
   in ›` paragraph is untouched.

Everything else DEC-908's wave-33 amendment named as untouched — the
`SUBMITTED · {ref}` flag, the `<h1>`, the card and its meta/speaker lines,
`If it hasn't arrived, check spam.`, the `Set a password now` claim block,
`You already have an account here.` + `Log in to track it`, `Submit
another talk`, `Browse the sessions ›`, and the whole non-delivered
branch — is verified byte-identical by the pre-existing
`test/submit-confirmation-reference.test.ts` and
`test/cfp-confirmation-email-honesty.test.ts` suites, both updated in this
same commit (see below) and both still green.

## Existing assertions of the retired copy, updated in this commit

`grep -rn "We've emailed a confirmation\|That email includes a link to set
a password\|You can edit this until" test src app` (run before editing)
named two files with live assertions of the retired sentences:

- `test/submit-confirmation-reference.test.ts`: the two `DEC-961` cases
  pinning `"You can edit this until"` / `"You can edit this until the call
  for papers closes."` are replaced with assertions on the new fresh-state
  sentence (`"You can edit this talk until"` with a close date; no date
  clause and `"a portal link."` alone with none).
- `test/cfp-confirmation-email-honesty.test.ts`: the working-mailer case's
  `not.toContain("We've emailed")` → `not.toContain("We emailed")` (the
  stronger, still-correct form — the new copy uses "We emailed" too, so
  this only fires on the non-delivered branch as originally intended); and
  `toContain("emailed a confirmation for")` → `toContain("We emailed
  ada@example.com a portal link.")`, since that fixture's contact is fresh.

No other file in `test/`, `src/`, or `app/` referenced the retired
sentences (decisions-data/DEC-908.md's prose quoting them is historical
record of the ruling, not a live assertion, and is generated/not
hand-edited).

## New test coverage

`test/public-confirmation-body-390.test.ts`:

- Three `verbatimLine()` frame citations (fresh/:1083,
  pending-existing-contact/:1132, has-account/:1155), read from the design
  file at runtime so the citation cannot rot.
- Real `app.request()` POSTs to `/submit/:eventSlug` (the
  `fakeDb`/`fakeKv`/`appWithDb` harness already built by
  `test/cfp-confirmation-email-honesty.test.ts` for this exact route,
  itself the `vi.mock`/`buildApp` idiom `test/portal-page-headings.test.ts`
  uses for portal routes) drive all three `ConfirmationState` values by
  varying the `findContactByEmail`/`findAccountUserIds` select-queue rows.
- Assert each state's body sentence verbatim, that the retired generic
  sentence and the retired duplicate paragraph are both absent on every
  state, that a null `closeDate` renders only the first sentence, and that
  nothing renders between the `<h1>` and the card.
