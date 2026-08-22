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
(`submit-views.tsx`). All structural copy the frame draws is present:
the `SUBMITTED · <ref>` flag, the title, the confirmation card (title + one
meta line + the DEC-908 speaker line, two `.chq-cfp-confirm-card-meta`
spans), the fresh state's own body sentence (§4), "If it hasn't arrived,
check spam.", the bordered claim block ("Set a password now" / "Then you
can track this talk without waiting for the email." / "Create a
password"), and both tail links ("Submit another talk", "Browse the
sessions"). No divergence found.

## 2. Submitted · email already known — :1124-1138 — MATCHES

`POST /submit/:eventSlug`, `"pending-existing-contact"` state with
`emailDelivered: true`. Card carries title + exactly one meta line (no
speaker line — DEC-908 rules that line fresh-only); DEC-098's "no claim
link on screen" holds (`/claim/` never appears); the state's own body
sentence (§4) renders; "Already have a password?" + exactly one "Log in ›"
anchor render; neither the check-spam note nor the tail-links row renders
(§5). Structural shape matches.

## 3. Submitted · has an account — :1147-1161 — MATCHES

`POST /submit/:eventSlug`, `"has-account"` state. Card carries title +
exactly one meta line, no speaker line. The state's own body sentence (§4)
renders; "You already have an account here." renders verbatim; the filled
primary `.chq-btn.chq-btn-primary` anchor reads "Log in to track it" to
`/login`; no `/claim/` path is minted or rendered; neither the check-spam
note nor the tail-links row renders (§5). Structural shape matches.

## 4. CLOSED — the state-specific confirmation-body sentence (DEC-908 wave-33 amendment)

The frames draw a state-specific one-sentence confirmation body:

- :1083 fresh — `"We emailed priya@example.com a portal link. You can edit
  this talk until 16 Aug."`
- :1132 email-already-known — `"We emailed dana@example.com a
  confirmation, with a link to set a password."`
- :1155 has-an-account — `"We emailed marcus@example.com a
  confirmation."`

This was previously recorded here as a DIVERGES row: `submit-views.tsx`
rendered ONE generic body (`We've emailed a confirmation for "{title}" to
{email}.`) shared byte-for-byte across all three states. DEC-908's wave-33
amendment built the three sentences as drawn —
`confirmationBodySentence()` in `src/routes/public/submit-views.tsx` now
returns exactly the :1083 / :1132 / :1155 text per state (fresh's close-date
clause is dropped entirely when `form.closeDate` is null rather than
inventing a date). That land makes the earlier "not fixed here" note stale.

**Re-measured this wave, CLOSED.** Instrument:
`test/public-submitted-390-frame-verdicts.test.ts`'s `it("MATCHES: each
state renders its own confirmation-body sentence …")` — a real `buildApp`/
`app.request` SSR request through `publicSubmitRoutes`, not a source scan —
dispatches all three `ConfirmationState`s and asserts (a) each state's own
sentence renders verbatim, (b) the old generic body appears in none of the
three, and (c) no state's sentence leaks into another. Green.

## 5. CLOSED — tail-note and tail-links scoped to the fresh state (DEC-908 wave-35 amendment)

Two further gaps surfaced while enumerating each frame's full literal
population, previously recorded here as "noted, not fixed":

- **"If it hasn't arrived, check spam." rendered unconditionally on
  `emailDelivered`, not per-state.** Frames :1124 and :1147 draw no such
  line at all — only :1074 (fresh) draws it.
- **`.chq-cfp-links` ("Submit another talk" / "Browse the sessions ›")
  rendered unconditionally too.** Frames :1124 and :1147 draw no tail-links
  row; :1074 is the only frame that does.

**Closed this wave.** `ConfirmationPage` in `src/routes/public/submit-views.tsx`
now gates the `.chq-cfp-confirm-note` paragraph on `state === "fresh" &&
emailDelivered` (DEC-380's emailDelivered reasoning is unchanged, only
`state` is added on top) and the `.chq-cfp-links` row on `state === "fresh"`
— markup-only, no CSS moved, identical at both widths per DEC-385.
`test/public-submitted-390-frame-verdicts.test.ts`'s :1124 and :1147 `it()`s
each now assert the absence of both `class="chq-cfp-confirm-note"` and
`class="chq-cfp-links"`. Green.

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
