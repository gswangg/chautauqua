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
(`submit-views.tsx:782`). All structural copy the frame draws is present:
the `SUBMITTED · <ref>` flag, the title, the confirmation card (title + one
meta line + the DEC-908 speaker line, two `.chq-cfp-confirm-card-meta`
spans), "If it hasn't arrived, check spam.", the bordered claim block ("Set
a password now" / "Then you can track this talk without waiting for the
email." / "Create a password"), and both tail links ("Submit another talk",
"Browse the sessions"). No divergence found in this state's structural
copy — see §4 for the one confirmation-body sentence divergence shared by
all three states.

## 2. Submitted · email already known — :1124-1138 — MATCHES (structure), DIVERGES (body, §4)

`POST /submit/:eventSlug`, `"pending-existing-contact"` state with
`emailDelivered: true`. Card carries title + exactly one meta line (no
speaker line — DEC-908 rules that line fresh-only); DEC-098's "no claim
link on screen" holds (`/claim/` never appears); "Already have a
password?" + exactly one "Log in ›" anchor render. Structural shape
matches. The confirmation-body sentence itself diverges — see §4.

## 3. Submitted · has an account — :1147-1161 — MATCHES (structure), DIVERGES (body, §4)

`POST /submit/:eventSlug`, `"has-account"` state. Card carries title +
exactly one meta line, no speaker line. "You already have an account
here." renders verbatim; the filled primary `.chq-btn.chq-btn-primary`
anchor reads "Log in to track it" to `/login`; no `/claim/` path is minted
or rendered. Structural shape matches. The confirmation-body sentence
itself diverges — see §4.

## 4. DIVERGES — the state-specific confirmation-body sentence

The frames draw a state-specific one-sentence confirmation body:

- :1074 fresh — `"We emailed priya@example.com a portal link. You can edit
  this talk until 16 Aug."`
- :1124 email-already-known — `"We emailed dana@example.com a
  confirmation, with a link to set a password."`
- :1147 has-an-account — `"We emailed marcus@example.com a
  confirmation."`

`submit-views.tsx:833` renders ONE generic body for all three states
instead:

```
We've emailed a confirmation for "{props.title}" to {props.submittedEmail}.
```

(plus a separate close-date sentence at `submit-views.tsx:800`, and the
`emailDelivered`-gated ":1084 check-spam" note at `:860` — both of those
build as drawn). This generic body is shared byte-for-byte across all three
states, and (per DEC-385's wave-30 amendment: "a verdict lane may land its
own fix only inside files it exclusively owns this wave; on a stylesheet
another in-flight lane owns it files a DIVERGES row instead" — the same
principle applies to a shared desktop+phone TSX body this task's file list
does not grant fix rights over) this is **not fixed here**. Filed as a
DIVERGES row, not silently patched. `test/public-submitted-390-frame-verdicts.test.ts`'s
final `it()` pins both the generic body's presence and the frame-specific
sentences' absence as a receipt of this finding.

## 5. Noted, not fixed (adjacent, out of this task's scope)

Two further gaps surfaced while enumerating each frame's full literal
population, neither prescribed by this task and neither touched:

- **"If it hasn't arrived, check spam." renders unconditionally on
  `emailDelivered`, not per-state.** `submit-views.tsx`'s
  `{props.emailDelivered ? <p class="chq-cfp-confirm-note">...` gate has no
  state check, so the line also renders for the email-already-known and
  has-an-account states — frames :1124 and :1147 draw no such line at all.
- **`.chq-cfp-links` ("Submit another talk" / "Browse the sessions ›")
  renders unconditionally too.** Frames :1124 and :1147 draw no tail-links
  row; :1074 is the only frame that does.

Both are shared-markup (`submit-views.tsx`) behavior, not confined to this
task's owned `cfp.css.ts` phone block, so per the same DEC-385 scoping
above they are reported here rather than fixed.

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
| 2 | Submitted · email already known | :1124 | MATCHES (structure) / DIVERGES (body, §4) |
| 3 | Submitted · has an account | :1147 | MATCHES (structure) / DIVERGES (body, §4) |
