# Inline-in-prose tap-floor-exempt receipt roster (DEC-393 wave-35/42 amendments)

`src/decisions-data/DEC-393.md`'s wave-35 amendment rules that an
`inline-in-prose` `tap-floor-exempt:` receipt is a GROUNDING claim: it is
legitimate only when the same navigation destination is reachable from a
control on the same rendered surface that carries the 44px floor grammar
(min-height >= 44px, centred flex, non-zero horizontal padding) -- or, per
the wave-35 amendment's three-rung ladder (floor / same-surface floored
twin / DEVIATIONS), when neither rung 1 nor rung 2 applies but the wave-35
roster's own repair recorded the deviation in `docs/design/DEVIATIONS.md`.
This instrument, `test/inline-prose-exemption-premise.scan.test.ts`, walks
`src/**` and `app/src/**` (excluding `*.test.ts(x)` and the campaign's own
scan-library directories) for every real `tap-floor-exempt:` receipt whose
reason's first word starts with `inline`, and grades each one:

- **GROUNDED** — the reason names a companion `.chq-*` class (distinct from
  the receipt's own decorated selector) that is discoverable, satisfies the
  full floor grammar, and appears in real markup.
- **UNGROUNDED** — the reason names a companion class, but that companion
  fails the floor grammar. A real, checkable defect.
- **GROUNDED-BY-DEVIATION** (rung 3, DEC-393 wave-42 amendment) — the reason
  names no companion class, but it cites a real `## N.` section of
  `docs/design/DEVIATIONS.md` (a `§N`/`section N` reference that resolves to
  an actual heading) whose own body text names one of this receipt's own
  bare `chq-` class tokens verbatim. This is the rung-3 outcome the wave-35
  amendment's ladder always allowed but the wave-35 instrument never
  checked; it graded every rung-3 receipt UNVERIFIABLE, identically to a
  receipt that argues nothing.
- **UNVERIFIABLE** — the reason names no companion class, and either cites
  no DEVIATIONS.md section number, cites a section number that does not
  resolve to a real heading, or cites a real section whose body does not
  name this receipt's own token. This instrument has no automated
  predicate for a bare-English grounding claim with none of the three
  rungs checkable (a roster row, never a silent pass — the same discipline
  `test/tap-floor-exempt-premise.scan.test.ts`'s wave-30 build already uses
  for its own unpredicated families).

Measured population: 14 receipts. 3 GROUNDED, 0 UNGROUNDED, 3
GROUNDED-BY-DEVIATION, 8 UNVERIFIABLE.

## Roster

| Verdict | File | Detail |
| --- | --- | --- |
| GROUNDED | `src/routes/portal/portal.css.ts:1311` (`chq-portal-file-link`) | named companion `.chq-portal-version-link` declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule) and reaches the same destination on the same surface |
| GROUNDED | `src/routes/portal/tasks/views.tsx:316` (uploaded-filename row anchor, `chq-portal-file-link`) | named companion `.chq-portal-version-link` declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule) and reaches the same destination on the same surface |
| GROUNDED | `src/routes/public/css/agenda.css.ts:803` (`.chq-pub-agenda-day-footer-next`) | named companion `.chq-pub-day-pill` declares min-height:44px + centred flex + non-zero horizontal padding (merged across 1 rule) and reaches the same destination on the same surface |
| GROUNDED-BY-DEVIATION | `src/routes/public/submit-views.tsx:625` (`.chq-cfp-intro-cta`, "Create an account", `chq-cfp-intro-cta-link`) | cites DEVIATIONS.md §10 (real heading), whose body names this receipt's own `chq-cfp-intro-cta-link` verbatim — the ladder's first entry |
| GROUNDED-BY-DEVIATION | `src/routes/public/submit-views.tsx:793` (`.chq-cfp-identity-note`, "Sign in to the speaker portal", `chq-cfp-identity-note-link`) | cites DEVIATIONS.md §10 (real heading), whose body names this receipt's own `chq-cfp-identity-note-link` verbatim — the ladder's second entry |
| GROUNDED-BY-DEVIATION | `src/routes/tools.css.ts:73` (docs.tsx's `/login` reference, `.chq-docs-auth-link`) | cites DEVIATIONS.md §10 (real heading), whose body names this receipt's own `chq-docs-auth-link` verbatim — the ladder's third entry |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts:51` (`.chq-cfp-intro-cta`, "Create an account") | rung 1/2 fail: no companion `.chq-*` class named. rung 3 fails: reason cites no DEVIATIONS.md section number |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts:135` (`.chq-cfp-identity-note`, "Sign in to the speaker portal") | rung 1/2 fail: no companion class named. rung 3 fails: no DEVIATIONS.md section citation |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts:480` (`.chq-cfp-confirm-actions a:not(.chq-btn)`, "Log in ›") | rung 1/2 fail: names `.chq-cfp-confirm-actions`/`.chq-btn`, both its own decorated/companion siblings for a DIFFERENT control, not a destination reference. rung 3 fails: no DEVIATIONS.md section citation |
| UNVERIFIABLE | `src/routes/public/cfp.css.ts:491` (`.chq-cfp-intro-cta-link` / `.chq-cfp-identity-note-link` declaration) | rung 1/2 fail: no companion class named (the two anchor class tokens are receipted here, not a companion). rung 3 fails: this copy is cited by file+token rather than quoted (DEC-613, this sheet is served verbatim), so the reason text carries no DEVIATIONS.md section citation of its own — see submit-views.tsx:625/:793 above for the receipts that do |
| UNVERIFIABLE | `src/routes/public/submit-views.tsx:943` (claim-state, "Log in ›") | rung 1/2 fail: no companion class named. rung 3 fails: no DEVIATIONS.md section citation |
| UNVERIFIABLE | `src/routes/public/submit-views.tsx:969` (has-account state, "Log in ›") | rung 1/2 fail: no companion class named. rung 3 fails: no DEVIATIONS.md section citation |
| UNVERIFIABLE | `src/views/theme.ts:620` (`.chq-section`, docs.tsx `/login` mention, pre-DEC-996 idiom) | rung 1/2 fail: names only `.chq-section`, its own decorated selector. rung 3 fails: no DEVIATIONS.md section citation (this is the older, token-scoped w18-e receipt, superseded in practice by tools.css.ts:73's rung-3-grounded one for the same `/login` link but left standing, own shell-file lane) |
| UNVERIFIABLE | `src/views/theme.ts:670` (`.chq-card`, portal task-detail filename anchor, pre-DEC-996 idiom) | rung 1/2 fail: names only `.chq-card`, its own decorated selector. rung 3 fails: no DEVIATIONS.md section citation |

## Note on the eight UNVERIFIABLE rows

Four of the eight (`cfp.css.ts:51/135/480/491`) argue typography only or
name a same-file sibling that is not a destination reference — none cites
DEVIATIONS.md at all, so rung 3 is never reached; `cfp.css.ts` is
`v12m-w40-e`'s in-flight lane and is rostered, not edited, per this task's
scope. Two (`submit-views.tsx:943/969`, the confirmation page's "Log in ›"
states) likewise cite no DEVIATIONS.md section. The remaining two
(`theme.ts:620/670`) are the older, pre-DEC-996 `v12m-w18-e` idiom that
scopes the exemption to a shared enclosing class (`.chq-section`,
`.chq-card`) rather than the anchor's own token, and were never repaired
into the wave-35 ladder's rung-3 DEVIATIONS citation form; `theme.ts` is a
shell file with its own lane per the campaign mandate, so this task rosters
rather than edits it. None of the eight is automatically resolvable
GROUNDED, UNGROUNDED, or GROUNDED-BY-DEVIATION this wave; each is rostered
UNVERIFIABLE rather than silently passed.
