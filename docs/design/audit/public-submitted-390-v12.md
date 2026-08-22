# PUBLIC "Submitted" 390 trio — first markup-level verdict (task w30-a)

Per-frame render verdicts for the three `ConfirmationState` frames in
`docs/design/Chautauqua Public and Portal.dc.html` — :1074 ("Submitted",
fresh/claimable), :1124 ("Submitted · email already known"), :1147
("Submitted · has an account") — entered by a REAL SSR request through
`publicSubmitRoutes`, per DEC-976's wave-30 amendment ("a phone-frame
verdict grades the frame's DRAWN COPY, enumerated from its own extent — a
citation count is not a coverage measure"). Test file:
`test/public-submitted-390-frame-verdicts.test.ts`.

**A prior claim corrected.** `docs/design/audit/public-390-verdicts-v12.md`
§5 already states "MATCHES ... the body sentence names the password-setup
mechanism" for :1124. That is wrong — re-measured here, it does not hold.
This file does not edit that other audit's row (out of this task's owned
file list); the correction lives here instead.

## 1. Submitted (fresh) — :1074-1093 — MATCHES

`POST /submit/:eventSlug`, `ConfirmationPage`'s `"fresh"` state
(`submit-views.tsx:811`). All structural copy the frame draws is present:
the `SUBMITTED · <ref>` flag, the title, the confirmation card (title + one
meta line + the DEC-908 speaker line, two `.chq-cfp-confirm-card-meta`
spans), "If it hasn't arrived, check spam.", the bordered claim block ("Set
a password now" / "Then you can track this talk without waiting for the
email." / "Create a password"), and both tail links ("Submit another talk",
"Browse the sessions"). No divergence found in this state's structural
copy — see §4 for the (now-closed) confirmation-body finding and §5 for the
(now-closed) fresh-only-tail finding.

## 2. Submitted · email already known — :1124-1138 — MATCHES

`POST /submit/:eventSlug`, `"pending-existing-contact"` state with
`emailDelivered: true`. Card carries title + exactly one meta line (no
speaker line — DEC-908 rules that line fresh-only); DEC-098's "no claim
link on screen" holds (`/claim/` never appears); "Already have a
password?" + exactly one "Log in ›" anchor render; neither the check-spam
note nor the `.chq-cfp-links` tail row renders (closed §5 finding).
Structural shape matches, and — as of the DEC-908 wave-33 amendment closing
§4 — the confirmation-body sentence matches too.

## 3. Submitted · has an account — :1147-1161 — MATCHES

`POST /submit/:eventSlug`, `"has-account"` state. Card carries title +
exactly one meta line, no speaker line. "You already have an account
here." renders verbatim; the filled primary `.chq-btn.chq-btn-primary`
anchor reads "Log in to track it" to `/login`; no `/claim/` path is minted
or rendered; neither the check-spam note nor the `.chq-cfp-links` tail row
renders (closed §5 finding). Structural shape matches, and the
confirmation-body sentence matches too (closed §4 finding).

## 4. CLOSED — the state-specific confirmation-body sentence (was DIVERGES)

The frames draw a state-specific one-sentence confirmation body:

- :1074 fresh — `"We emailed priya@example.com a portal link. You can edit
  this talk until 16 Aug."`
- :1124 email-already-known — `"We emailed dana@example.com a
  confirmation, with a link to set a password."`
- :1147 has-an-account — `"We emailed marcus@example.com a
  confirmation."`

This row previously read DIVERGES against a single generic body sentence
(`submit-views.tsx` used to render one `We've emailed a confirmation for
"{title}" to {email}.` line for all three states). **Closed by DEC-908's
wave-33 amendment**: `confirmationBodySentence(props)`
(`submit-views.tsx:793`) now builds a distinct sentence per `props.state`,
matching all three frame sentences above verbatim (including the fresh
state's optional close-date clause, dropped when `form.closeDate` is
null). The instrument holding this truth today is
`test/public-submitted-390-frame-verdicts.test.ts`'s
`"CLOSED (DEC-908 wave-33 amendment): the frames' three state-specific
confirmation-body sentences are exactly what submit-views.tsx renders --
see also confirmationBodySentence's unit-level source-of-truth comment"`
case, which asserts all three sentences render for their respective states
and that the old generic sentence never appears again.

## 5. CLOSED — the check-spam note and tail-links row were state-blind (was noted, not fixed)

Previously noted here as adjacent, out-of-scope gaps and left unfixed:
"If it hasn't arrived, check spam." and the `.chq-cfp-links` row
("Submit another talk" / "Browse the sessions ›") both used to render
unconditionally on `props.emailDelivered` alone, with no state check, so
both also rendered for the email-already-known and has-an-account states —
frames :1124 and :1147 draw neither element; only :1074 does.

**Closed this task (DEC-908 wave-5 amendment, task w5-ci).** Both are now
gated on `props.state === "fresh"` in addition to their prior condition:
the check-spam `<p class="chq-cfp-confirm-note">` (the note's own
`emailDelivered` gate stays, `state === "fresh"` is added alongside it) and
the whole `<div class="chq-cfp-links">` block are each rendered only when
`props.state === "fresh"` — submit-views.tsx, in the `ConfirmationPage`
function body, carries the receipt quote `props.state === "fresh" ?
<p class="chq-cfp-confirm-note">If it hasn't arrived, check spam.</p> :
null` for the note and `{props.state === "fresh" ? (\n          <div
class="chq-cfp-links">` for the tail row. The instrument holding this
truth today is `test/public-submitted-390-frame-verdicts.test.ts`'s
`"DEC-908 (wave-5 amendment): the check-spam note and the tail-links row
are fresh-ONLY -- :1074 draws both (:1084, :1090-1092); :1124 and :1147
draw neither"` case, which asserts both elements present for the fresh
state and absent for both other states.

## Phone geometry (max-width:700px terminal block)

`cfp.css.ts`'s terminal `@media (max-width: 700px)` block already carries
every rule the three frames' 390 geometry requires — the confirmation h1's
27px/1.08 register (shared byte-identically by all three frames), the
bordered claim block's phone-only geometry (`.chq-cfp-confirm-password{,-heading,-body}`),
and the plain-anchor 44px floor (`.chq-cfp-links a`,
`.chq-cfp-confirm-actions a:not(.chq-btn)`). Verified by reading the block's
source text (jsdom applies no stylesheet); no rule was missing, so
`cfp.css.ts` was not edited by this task.

## Summary

| # | Frame | Line | Verdict |
|---|-------|------|---------|
| 1 | Submitted (fresh) | :1074 | MATCHES |
| 2 | Submitted · email already known | :1124 | MATCHES |
| 3 | Submitted · has an account | :1147 | MATCHES |
| 4 | (cross-frame) confirmation-body sentence | — | CLOSED (was DIVERGES, §4) |
| 5 | (cross-frame) check-spam note + tail links | — | CLOSED (was noted-not-fixed, §5) |
