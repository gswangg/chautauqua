# Inline-in-prose tap-floor-exempt receipt roster (DEC-393 wave-35/42/44 amendments)

`src/decisions-data/DEC-393.md`'s wave-35 amendment rules that an
`inline-in-prose` `tap-floor-exempt:` receipt is a GROUNDING claim: it is
legitimate only when the same navigation destination is reachable from a
control on the same rendered surface that carries the 44px floor grammar
(min-height >= 44px, centred flex, non-zero horizontal padding) -- or, per
the wave-35 amendment's three-rung ladder (floor / same-surface floored
twin / DEVIATIONS), when neither rung 1 nor rung 2 applies but the wave-35
roster's own repair recorded the deviation in docs/design/DEVIATIONS.md.
This instrument, test/inline-prose-exemption-premise.scan.test.ts, walks
src/** and app/src/** (excluding *.test.ts(x) and the campaign's own
scan-library directories) for every real `tap-floor-exempt:` receipt whose
reason's first word starts with `inline`, and grades each one:

- **GROUNDED** — either (rung 0, self-floored, DEC-393 wave-52 amendment)
  the receipt's OWN receipted class(es), merged across every rule in the
  swept corpus that mentions them, already satisfy the full floor grammar
  with no companion needed at all; or (rung 2) the reason names a companion
  `.chq-*` class (distinct from the receipt's own decorated selector) that
  is discoverable, satisfies the full floor grammar, and appears in real
  markup.
- **UNGROUNDED** — the reason names a companion class, but that companion
  fails the floor grammar. A real, checkable defect.
- **GROUNDED-BY-DEVIATION** (rung 3, DEC-393 wave-42 amendment) — the reason
  names no companion class, but it cites a real `## N.` section of
  docs/design/DEVIATIONS.md (a `§N`/`section N` reference that resolves to
  an actual heading) whose own body text names one of this receipt's own
  bare `chq-` class tokens verbatim.
- **UNVERIFIABLE** — the reason names no companion class, and either cites
  no DEVIATIONS.md section number, cites a section number that does not
  resolve to a real heading, or cites a real section whose body does not
  name this receipt's own token. A roster row, never a silent pass.

Measured population (wave-52, task w52-b): 15 receipts. 8 GROUNDED, 0
UNGROUNDED, 7 GROUNDED-BY-DEVIATION, 0 UNVERIFIABLE. (Population held at
15 since the wave-44 measurement; the wave-44 survivor now resolves
GROUNDED via a new rung 0, self-floored, added this wave -- derived fresh
by re-running the scan, never carried forward by arithmetic, per
DEC-180/DEC-808.)

Citations below use the drift-proof bare-path shape (DEC-967 wave-115):
a bare repo-relative path immediately followed by a backtick-quoted token
that appears verbatim somewhere in that file, never a `path:line` pin --
this doc is a moving target (cfp.css.ts/submit-views.tsx/theme.ts are all
in-flight elsewhere), so a line pin drifts the moment any of them gains or
loses a line above the cited receipt.

## Roster

| Verdict | File | Receipt | Detail |
| --- | --- | --- | --- |
| GROUNDED | src/routes/portal/portal.css.ts`chq-portal-file-link` | task w38-a's original sheet-side receipt | named companion `chq-portal-version-link` declares min-height:44px + centred flex + non-zero horizontal padding and reaches the same destination on the same surface |
| GROUNDED | src/routes/portal/portal.css.ts`chq-portal-file-link` | task w38-a's second, later sheet-side receipt (rung 2 discharged directly in the sheet) | same named companion, same result |
| GROUNDED | src/routes/portal/tasks/views.tsx`chq-portal-file-link` | the uploaded-filename row anchor's own JSX receipt | named companion `chq-portal-version-link` declares the full floor grammar and reaches the same destination on the same surface |
| GROUNDED | src/routes/public/css/agenda.css.ts`chq-pub-agenda-day-footer-next` | the day-footer "next day" link | named companion `chq-pub-day-pill` declares the full floor grammar and reaches the same destination on the same surface |
| GROUNDED | src/routes/public/submit-views.tsx`chq-btn.chq-btn-primary` | pending-existing-contact state's "Already have a password? Log in ›" (wave-44, task w44-g) | grounded per rung 2: this ConfirmationPage's own has-account state (same route/surface) renders a `.chq-btn.chq-btn-primary` anchor reaching the identical `/login` destination, and `.chq-btn` carries theme.ts's shared house floor (display:inline-flex + align-items:center + padding:0.5rem 1rem base, min-height:44px in the phone max-width block) |
| GROUNDED | src/routes/public/submit-views.tsx`chq-btn.chq-btn-primary` | claim-state's "Already have a password? Log in ›" (wave-44, task w44-g) | same rung-2 grounding as the entry above, the other of the two mutually-exclusive branches carrying this phrase |
| GROUNDED | src/views/theme.ts`chq-portal-version-link` | pre-DEC-996 `.chq-card`-scoped receipt for the portal task filename anchor (wave-44, task w44-g) | this older, shell-file receipt describes the same anchor as the tasks/views.tsx entry above; re-grounded with the same rung-2 companion citation rather than left an orphan claim |
| GROUNDED-BY-DEVIATION | src/routes/public/submit-views.tsx`chq-cfp-intro-cta-link` | "New speaker? Create an account" (task w35-b) | cites DEVIATIONS.md §10 (real heading), whose body names this receipt's own `chq-cfp-intro-cta-link` verbatim — the ladder's first entry |
| GROUNDED-BY-DEVIATION | src/routes/public/submit-views.tsx`chq-cfp-identity-note-link` | "Already have an account? Sign in to the speaker portal" (task w35-b) | cites DEVIATIONS.md §10 (real heading), whose body names this receipt's own `chq-cfp-identity-note-link` verbatim — the ladder's second entry |
| GROUNDED-BY-DEVIATION | src/routes/tools.css.ts`chq-docs-auth-link` | docs.tsx's `/login` reference (task w35-b) | cites DEVIATIONS.md §10 (real heading), whose body names this receipt's own `chq-docs-auth-link` verbatim — the ladder's third entry |
| GROUNDED-BY-DEVIATION | src/routes/public/cfp.css.ts`chq-cfp-intro-cta` | the `.chq-cfp-intro-cta` paragraph wrapper for "Create an account" (wave-44, task w44-g) | this wrapper's own receipt describes the same anchor as DEVIATIONS.md §10's first entry; a §10 citation was added so it resolves by the same deviation as the anchor's own receipt rather than left orphaned |
| GROUNDED-BY-DEVIATION | src/routes/public/cfp.css.ts`chq-cfp-identity-note` | the `.chq-cfp-identity-note` paragraph wrapper for "Sign in to the speaker portal" (wave-44, task w44-g) | same treatment as the entry above, tied to DEVIATIONS.md §10's second entry |
| GROUNDED-BY-DEVIATION | src/routes/public/cfp.css.ts`chq-cfp-intro-cta-link` | the empty `.chq-cfp-intro-cta-link, .chq-cfp-identity-note-link {}` declaration rule (task w35-b, digit repaired wave-44 task w44-g) | this receipt already described both ladder entries by name but cited "DEVIATIONS.md's wave-35 rulings section" with no digit, so the citation regex never matched; the missing `§10` was added, no other text changed |
| GROUNDED | src/routes/public/cfp.css.ts`chq-cfp-confirm-actions` | pending-existing-contact state's own classless-anchor CSS rule for "Already have a password? Log in ›" (self-floored, wave-52 task w52-b) | rung 0: this receipt's own decorated selector, `.chq-cfp-confirm-actions a:not(.chq-btn)`, is the SAME selector cfp.css.ts's `max-width: 700px` phone block floors directly (`min-height: 44px; display: inline-flex; align-items: center; padding: 0 2px;`); merged across that rule and the receipt's own desktop colour-only rule, the cascade satisfies the full floor grammar with no companion's testimony needed at all |

## Note on the wave-44 UNVERIFIABLE row, now resolved (wave-52)

Wave-44 (task w44-g) closed seven of the wave-35/42 measurement's eight
UNVERIFIABLE rows: the two CFP paragraph wrappers and the intro-cta-link /
identity-note-link declaration rule now cite the real DEVIATIONS.md §10 (one
was a genuinely missing digit; two describe anchors §10 already covers); the
two "Already have a password? Log in ›" JSX receipts and the pre-DEC-996
theme.ts receipts are grounded per rung 2, naming a real same-surface
floored companion for each. The one wave-44 survivor —
src/routes/public/cfp.css.ts`chq-cfp-confirm-actions`, the desktop
color-only rule that decorates the SAME classless anchor as one of the two
grounded JSX receipts — genuinely could not take the identical rung-2
companion its JSX sibling took: that receipt's own selector already
contains `:not(.chq-btn)`, so `chq-btn` reads as this receipt's own token
rather than an external companion, and no other genuinely floored control
reaching `/login` existed to cite instead, and no DEVIATIONS.md entry
covered this link either. What wave-44 missed was that the receipt needed
no OTHER control's testimony at all: cfp.css.ts:344's phone-media block
floors the receipt's own selector directly (`.chq-cfp-links a,
.chq-cfp-confirm-actions a:not(.chq-btn) { min-height: 44px; display:
inline-flex; align-items: center; padding: 0 2px; }`). Wave-52 (task w52-b)
adds rung 0 (self-floored) to the instrument: before the companion search
and before the UNVERIFIABLE fallthrough, check whether the receipt's own
receipted class(es), merged across every rule in the swept corpus that
mentions them, already satisfy the full floor grammar. This receipt now
resolves GROUNDED, and `INLINE_PROSE_UNVERIFIABLE_CEILING` drops from 1 to
0 — a real instrument gap closed, not a defect silenced.
