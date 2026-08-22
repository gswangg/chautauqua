# Inline-in-prose tap-floor-exempt receipt roster (DEC-393 wave-35 amendment)

`src/decisions-data/DEC-393.md`'s wave-35 amendment rules that an
`inline-in-prose` `tap-floor-exempt:` receipt is a GROUNDING claim: it is
legitimate only when the same navigation destination is reachable from a
control on the same rendered surface that carries the 44px floor grammar
(min-height >= 44px, centred flex, non-zero horizontal padding). This
instrument, `test/inline-prose-exemption-premise.scan.test.ts`, walks
`src/**` and `app/src/**` (excluding `*.test.ts(x)` and the campaign's own
scan-library directories) for every real `tap-floor-exempt:` receipt whose
reason's first word starts with `inline`, and grades each one:

- **GROUNDED** — the reason names a companion `.chq-*` class (distinct from
  the receipt's own decorated selector) that is discoverable, satisfies the
  full floor grammar, and appears in real markup.
- **UNGROUNDED** — the reason names a companion class, but that companion
  fails the floor grammar. A real, checkable defect.
- **UNVERIFIABLE** — the reason names no companion class at all. This
  instrument has no automated predicate for a bare-English grounding claim
  with no `.chq-*` token in its own text (a roster row, never a silent
  pass — the same discipline `test/tap-floor-exempt-premise.scan.test.ts`'s
  wave-30 build already uses for its own unpredicated families).

Measured population: 11 receipts. 1 GROUNDED, 0 UNGROUNDED, 10
UNVERIFIABLE.

## Roster

| Verdict | File | Detail |
| --- | --- | --- |
| GROUNDED | `src/routes/public/css/agenda.css.ts` (`.chq-pub-agenda-day-footer a`) | named companion `.chq-pub-day-pill` declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule) and reaches the same `agendaQs(current,{day})` destination on the same surface |
| UNVERIFIABLE | `src/routes/portal/tasks/views.tsx` (uploaded-filename row anchor) | reason argues typography only ("a 44px box would break the line box"); no companion `.chq-*` class named |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts` (`.chq-cfp-intro-cta`, "Create an account") | reason argues typography only; no companion class named distinct from the receipted selector itself |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts` (`.chq-cfp-identity-note`, "Sign in to the speaker portal") | reason argues typography only; no companion class named distinct from the receipted selector itself |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts` (`.chq-cfp-confirm-actions a:not(.chq-btn)`, "Log in ›") | reason names `.chq-cfp-confirm-actions` and `.chq-btn`, but both are the receipt's own decorated/companion siblings for a DIFFERENT control (the confirmation page's primary CTA), not a destination-grounding reference for the exempted link itself; no companion distinct from the receipted selectors |
| UNVERIFIABLE | `src/routes/public/submit-views.tsx` (`.chq-cfp-intro-cta`, "Create an account") | reason argues typography only; no companion class named |
| UNVERIFIABLE | `src/routes/public/submit-views.tsx` (`.chq-cfp-identity-note`, "Sign in to the speaker portal") | reason argues typography only; no companion class named |
| UNVERIFIABLE | `src/routes/public/submit-views.tsx` (claim-state, "Log in ›") | reason argues typography only; no companion class named |
| UNVERIFIABLE | `src/routes/public/submit-views.tsx` (has-account state, "Log in ›") | reason argues typography only; no companion class named |
| UNVERIFIABLE | `src/views/theme.ts` (`.chq-section`, docs.tsx `/login` mention) | reason names only `.chq-section`, the receipt's own decorated selector, not a distinct companion; no destination-grounding reference |
| UNVERIFIABLE | `src/views/theme.ts` (`.chq-card`, portal task-detail filename anchor) | reason names only `.chq-card`, the receipt's own decorated selector, not a distinct companion; no destination-grounding reference |

## Note on the ten UNVERIFIABLE rows

`src/decisions-data/DEC-393.md`'s wave-35 amendment narrates a live
reviewer's manual measurement of several of these same anchors as
sub-floor (`/submit` "Create an account" and "Sign in to the speaker
portal", the `/portal/tasks` filename link, and one `/docs/api` link
carrying no receipt at all). That manual finding is a fact about the
rendered page; this instrument's premise-check is narrower — it can only
settle a receipt whose own reason text names a `.chq-*` companion class,
the same way `test/tap-floor-exempt-premise.scan.test.ts`'s wave-30 build
settles `composition` receipts. None of these ten receipts name one, so
none can be automatically resolved GROUNDED or UNGROUNDED this wave; each
is rostered UNVERIFIABLE rather than silently passed. Widening the
instrument to a real href/destination-reachability search (rather than a
reason-text companion-class extraction) is left to a later amendment —
this wave builds the predicate the current DEC-393 amendment text itself
describes as already resolvable (the `.chq-pub-day-pill` worked example),
and rosters the rest honestly rather than guessing at their destinations.
