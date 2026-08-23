# Pack drawn `padding` vocabulary (DEC-069 wave-53 amendment, task w53-e, PARKED)

Instrument: `test/pack-padding-vocabulary.scan.test.ts`. MEASUREMENT AND
INSTRUMENT ONLY — this doc and its instrument move no CSS byte; desktop
stays frozen. This ratchet is PARKED: registered in
`scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts` ONLY,
never in `TIER2_CEILING_NAMES`, per DEC-069's wave-53 amendment clause (b) —
a freshly measured, previously-uncounted ~252-row population must not move
the campaign's own goalposts mid-convergence.

## What this grades

Every `padding:` declaration drawn inside a REACHABLE desktop frame in
`docs/design/*.dc.html` (the same label/extent walk, EXPLAINER exclusion
list and DEVIATIONS-Section-6 derivation
`test/pack-grid-track-vocabulary.scan.test.ts` already uses, ported rather
than imported — sibling-owned file), MINUS the frame's own number-badge
chrome (derived below), is compared, after normalisation, against every
`padding:` declaration in the non-test product corpus (`app/src/**/*.css`,
`app/src/**/*.ts(x)`, `src/**/*.ts(x)`, which is also every `src/**/*.css.ts`
file). Both sides collapse whitespace and resolve a value that is exactly a
`var(--x)` reference against `--x`'s own top-level (non-`@media`)
declaration before comparing. Unlike the grid-track scan's `minmax(0,X)`
rewrite, no shape-specific rewrite is needed for `padding`.

## Why padding, and why it was rejected before

`docs/design/audit/pack-grid-track-vocabulary-v12.md`'s "Rejected in the
same measurement pass" section records `padding` as the pack's largest
ungraded geometry property at that measurement (1786 drawn declarations, 439
unmatched) and names the one reason it was skipped: 158 of the unmatched
were the frame's own `5px 10px` number-badge chrome (the small dark/olive
"Agenda" / "390" / "Modal" tag every frame carries in its top-left corner),
an instrument artefact rather than a defect count. That section also
records `gap`, `align-items`, `justify-content`, `flex-direction`,
`white-space` and `overflow` all measuring ZERO unmatched — not re-measured
by this instrument. This wave's fresh, standalone measurement (never
inherited arithmetic on the prior wave's 1786/439) reads 1851 total drawn
`padding:` declarations pack-wide, 158 of them the badge (same absolute
count, different total — the earlier 1786/439 counted a narrower or
differently-scoped population; this instrument's own tripwires below pin
its own numbers independently of that prior reading).

## The badge exclusion is DERIVED, never hand-listed

Per DEC-069's wave-53 amendment clause (a): a hand-listed exclusion of ~158
line numbers would be DEC-180's "hand-listed population wearing a disguise"
and worse than not measuring at all. Instead, `BADGE_STYLE_ATTR_RE` matches
the badge's own full `style="..."` attribute shape — structurally, from the
element's own combination of declarations, not from any line number:

```
style="font-size:11px; font-weight:700; letter-spacing:0.1em; background:#......; color:#......; padding:5px 10px; border-radius:4px"
```

**Receipt** (verified by hand this wave, and re-derivable at any time):
`grep -oh 'style="[^"]*padding:5px 10px;[^"]*"' docs/design/*.dc.html | sort -u`
prints exactly two distinct full attribute strings pack-wide — one dark
chrome (`background:#1B1D17; color:#F4F1E8`), one olive chrome
(`background:#4E5C31; color:#F7F9F0`) — both matching
`BADGE_STYLE_ATTR_RE` byte-for-byte, and `grep -n "padding:5px 10px"
docs/design/*.dc.html | grep -v 'style="'` prints nothing: every
`padding:5px 10px` occurrence pack-wide sits inside one of these two style
attributes, with no exception. A padding declaration is excluded because
the style attribute it lives in structurally carries the badge's own four
distinguishing declarations (`font-size:11px`, `font-weight:700`,
`letter-spacing:0.1em`, `border-radius:4px`) bracketing the padding value —
never because of its line number. If the pack ever draws a badge whose
attribute deviates from this exact shape, the derivation stops excluding it
(fails loud toward MORE offenders, never silently drops a real one).

## Live ratchet value

`PACK_PADDING_UNMATCHED_CEILING = 252` (parked; two-sided; may only be
raised by a merge-train act, never lowered to paper over a regression, and
never sits below the measured count).

## Vacuous-population tripwire

The pack draws `1851` `padding:` declarations across `docs/design/*.dc.html`
(raw text count, independent of the label/extent walk). Of those, `158`
resolve structurally to the number-badge chrome (independently counted, via
the same `BADGE_STYLE_ATTR_RE` derivation, without going through the frame
walk) and are excluded. Of the remainder, `1187` fall inside a REACHABLE
(desktop, non-explainer, non-deviation-deferred) labelled frame extent and
form the graded population (`PACK_PADDING`); `252` of those have no
normalised match anywhere in the product corpus.

## Controls

**Positive** (matched): `docs/design/Chautauqua Account.dc.html:43` draws
`padding:0 13px` on the sign-in email field — present verbatim in the
product corpus (the shipped CFP/account input padding), grades MATCHED.

**Negative** (unmatched): `docs/design/Chautauqua Account.dc.html:33` draws
`padding:44px` on the sign-in card's outer container — no shipped
declaration normalises to `44px` alone, grades UNMATCHED. Confirms the
badge derivation did not over-fire: this row sits two lines above the first
matched-badge-adjacent chrome in the same file and survives untouched.

## Offender table

Bare-path-plus-backtick-quote citations only (`test/citation-form-drift.scan.test.ts`
is the instrument that enforces this) — a `path:line` form is used ONLY for
`docs/design/*.dc.html` citations, which sit outside the app/src, src, test,
scripts, migrations population that scan grades.

No row is hand-adjudicated this wave — this instrument measures divergence
only; every "nearest shipped value" judgement is left for a later wave, per
DEC-069 wave-53's own ruling that repair is a later lane's spend.

| Frame file | Frame label | Drawn value | Nearest shipped value | Verdict |
| --- | --- | --- | --- | --- |
| `docs/design/Chautauqua Account.dc.html:33` | Sign in · a card, not a stretched phone | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:72` | Change password · /account/password | `32px 390px 30px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:104` | Not found · /admin/* | `32px 390px 30px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:187` | Reset · ask for a link | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:214` | Reset · link sent | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:240` | Reset · choose a new one | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:271` | Reset · link no longer valid | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Account.dc.html:295` | Sign in · rejected | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Agenda.dc.html:60` | Day grid · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Agenda.dc.html:61` | Day grid · 1600 | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Agenda.dc.html:76` | Day grid · 1600 | `10px 8px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Agenda.dc.html:78` | Day grid · 1600 | `10px 10px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Agenda.dc.html:107` | Day grid · 1600 | `10px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Agenda.dc.html:221` | Breaks · Tue 12 May | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:60` | Compose · step 3 of 4 · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:61` | Compose · step 3 of 4 · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:101` | Compose · step 3 of 4 · 1600 | `0 0 2px 27px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:103` | Compose · step 3 of 4 · 1600 | `0 12px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:144` | Compose · step 3 of 4 · 1600 | `12px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:145` | Compose · step 3 of 4 · 1600 | `11px 16px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:226` | Templates | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:231` | Templates | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:233` | Templates | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:253` | Templates | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:256` | Templates | `11px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:270` | Templates | `11px 16px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:568` | Comms · nothing sent yet | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:574` | Comms · nothing sent yet | `44px 0 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:613` | Comms · history | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:620` | Comms · history | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:621` | Comms · history | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:727` | DevFlow Conf 2027 | `4px 0 2px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:761` | Compose · send blocked | `30px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:60` | Directory · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:61` | Directory · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:62` | Directory · 1600 | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:77` | Directory · 1600 | `0 0 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:81` | Directory · 1600 | `8px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:82` | Directory · 1600 | `8px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:83` | Directory · 1600 | `8px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:240` | Contact · drawer | `20px 26px 28px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:268` | Contact · drawer | `11px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:283` | Import CSV · step 2 of 3 | `20px 28px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:290` | Import CSV · step 2 of 3 | `20px 28px 28px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:302` | Import CSV · step 2 of 3 | `11px 17px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:316` | Pipeline · invitations for next year | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:323` | Pipeline · invitations for next year | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:357` | Duplicates · merge | `20px 28px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:365` | Duplicates · merge | `22px 28px 30px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:557` | Bulk email | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:593` | Add to an event | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:630` | Add to the pipeline | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:677` | Import CSV · step 3 of 3 | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:744` | Pipeline · an empty stage | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:756` | Pipeline · an empty stage | `30px 0 24px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:782` | Import CSV · the file will not do | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:820` | New contact | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:59` | Worklist · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:60` | Worklist · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:116` | Session deliverables · /content/:submissionId | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:122` | Session deliverables · /content/:submissionId | `16px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:133` | Session deliverables · /content/:submissionId | `24px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:144` | Session deliverables · /content/:submissionId | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:169` | Session deliverables · /content/:submissionId | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:181` | Session deliverables · /content/:submissionId | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:182` | Session deliverables · /content/:submissionId | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:292` | Files library | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:299` | Files library | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:302` | Files library | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:446` | Upload rejected | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:67` | Docs · an article | `2px 0 2px 16px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:132` | Docs · the index | `40px 34px 48px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:250` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:258` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:268` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:283` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:284` | Docs · the element library | `2px 0 2px 16px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:288` | Docs · the element library | `2px 0 2px 16px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:308` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:320` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:321` | Docs · the element library | `1px 6px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Docs.dc.html:329` | Docs · the element library | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:33` | Event hub · desktop | `15px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:38` | Event hub · desktop | `36px 44px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:101` | Event hub · desktop | `18px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:186` | Between cycles · desktop | `15px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:191` | Between cycles · desktop | `36px 44px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:202` | Between cycles · desktop | `17px 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:274` | Fresh deploy · desktop | `15px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:279` | Fresh deploy · desktop | `60px 44px 64px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Home.dc.html:290` | Fresh deploy · desktop | `18px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:52` | What needs you today · 1600 | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:68` | What needs you today · 1600 | `11px 16px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:106` | What needs you today · 1600 | `10px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:107` | What needs you today · 1600 | `9px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:108` | What needs you today · 1600 | `9px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:319` | New event | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:456` | Overview · a brand-new event | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:461` | Overview · a brand-new event | `44px 0 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:481` | States · hover, pending, drag | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:524` | States · hover, pending, drag | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:534` | States · hover, pending, drag | `0 15px 8px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:537` | States · hover, pending, drag | `13px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:540` | States · hover, pending, drag | `13px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:543` | States · hover, pending, drag | `13px 12px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:546` | States · hover, pending, drag | `16px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:553` | States · hover, pending, drag | `13px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:600` | States · hover, pending, drag | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:626` | States · hover, pending, drag | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:654` | States · hover, pending, drag | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:700` | Loading · the first paint | `30px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:726` | Loading · the first paint | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:33` | Sessions and agenda · 1600 | `22px 44px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:47` | Sessions and agenda · 1600 | `26px 44px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:53` | Sessions and agenda · 1600 | `9px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:84` | Sessions and agenda · 1600 | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:137` | Agenda · 1600 | `22px 44px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:150` | Agenda · 1600 | `26px 44px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:155` | Agenda · 1600 | `9px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:159` | Agenda · 1600 | `22px 0 4px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:185` | Agenda · 1600 | `13px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:203` | Agenda · 1600 | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:254` | Agenda · a track highlighted | `22px 44px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:267` | Agenda · a track highlighted | `26px 44px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:272` | Agenda · a track highlighted | `9px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:277` | Agenda · a track highlighted | `22px 0 4px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:321` | Agenda · a track highlighted | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:685` | Speakers · list view | `20px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:695` | Speakers · list view | `24px 36px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:702` | Speakers · list view | `9px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:735` | Speakers · grid view | `20px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:745` | Speakers · grid view | `24px 36px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:752` | Speakers · grid view | `9px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:784` | My schedule · /e/:slug/schedule | `20px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:794` | My schedule · /e/:slug/schedule | `26px 44px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:807` | My schedule · /e/:slug/schedule | `22px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1105` | CFP closed | `34px 0 30px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1172` | Public sessions · nothing published | `22px 44px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1184` | Public sessions · nothing published | `26px 44px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1186` | Public sessions · nothing published | `44px 0 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1216` | Submit a talk · rejected on submit | `22px 44px 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1221` | Submit a talk · rejected on submit | `30px 44px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1224` | Submit a talk · rejected on submit | `18px 20px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1384` | Portal · Edit your session · desktop | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1429` | Portal · Edit your session · desktop | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1484` | Portal preview · /portal/preview | `30px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1537` | CFP not open yet · /submit/:slug | `44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1548` | CFP not open yet · /submit/:slug | `18px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:60` | Organiser view · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:61` | Organiser view · 1600 | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:207` | Reviewer scorecard · /review/plans/:id/submissions/:id | `22px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:214` | Reviewer scorecard · /review/plans/:id/submissions/:id | `26px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:235` | Reviewer scorecard · /review/plans/:id/submissions/:id | `10px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:236` | Reviewer scorecard · /review/plans/:id/submissions/:id | `10px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:367` | Reviewer queue · /review/plans/:id | `30px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:377` | Reviewer queue · /review/plans/:id | `16px 0 22px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:455` | Plan editor · /review/plans/:id | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:461` | Plan editor · /review/plans/:id | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:462` | Plan editor · /review/plans/:id | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:466` | Plan editor · /review/plans/:id | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:492` | Plan editor · /review/plans/:id | `11px 0 8px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:500` | Plan editor · /review/plans/:id | `0 12px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:508` | Plan editor · /review/plans/:id | `16px 0 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:552` | Plan editor · /review/plans/:id | `15px 17px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:680` | Plan editor · criteria frozen | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:686` | Plan editor · criteria frozen | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:686` | Plan editor · criteria frozen | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:689` | Plan editor · criteria frozen | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:723` | New plan · /review/plans/new | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:729` | New plan · /review/plans/new | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:729` | New plan · /review/plans/new | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:732` | New plan · /review/plans/new | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:739` | New plan · /review/plans/new | `11px 0 8px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:747` | New plan · /review/plans/new | `0 12px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:755` | New plan · /review/plans/new | `16px 0 18px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:841` | Your plans · /review | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:880` | Plan editor · save rejected | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:885` | Plan editor · save rejected | `26px 32px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:51` | Event, form, publishing, data · 1600 | `26px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:184` | Event, form, publishing, data · 1600 | `4px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:185` | Event, form, publishing, data · 1600 | `4px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:186` | Event, form, publishing, data · 1600 | `4px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:187` | Event, form, publishing, data · 1600 | `4px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:188` | Event, form, publishing, data · 1600 | `4px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:239` | Event, form, publishing, data · 1600 | `8px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:240` | Event, form, publishing, data · 1600 | `8px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:241` | Event, form, publishing, data · 1600 | `8px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:242` | Event, form, publishing, data · 1600 | `8px 13px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:618` | Settings · editing the call for papers | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:642` | Settings · editing the call for papers | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:662` | Settings · editing the call for papers | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:709` | Settings · editing the event | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:733` | Settings · editing the event | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:750` | Settings · editing the event | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:799` | Settings · editing tracks and rooms | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:880` | Settings · editing the speaker portal | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:904` | Settings · editing the speaker portal | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:914` | Settings · editing the speaker portal | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:961` | Settings · editing people and roles | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:986` | Settings · editing people and roles | `14px 0 8px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:995` | Settings · editing people and roles | `0 12px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1032` | Settings · editing one saved embed | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1057` | Settings · editing one saved embed | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1226` | Settings · save rejected by the server | `30px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1283` | Invite someone | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1331` | Invite · the one-time password | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1364` | Invite · rejected | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1404` | Confirm · reversible | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1426` | Confirm · irreversible | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1452` | Portal resource · add | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:1489` | Reset a password | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:60` | Onboarding grid · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:61` | Onboarding grid · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:62` | Onboarding grid · 1600 | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:76` | Onboarding grid · 1600 | `0 0 10px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:198` | New task | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:239` | Task response | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:330` | Speaker detail · /admin/speakers/:contactId | `26px 34px 36px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:466` | Speakers · search found nothing | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:477` | Speakers · search found nothing | `30px 0 24px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:504` | Review these reminders | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:518` | Review these reminders | `22px 24px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:560` | Speakers · a write failed | `30px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:578` | Speakers · a write failed | `0 0 10px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:609` | One task, every speaker | `30px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:617` | One task, every speaker | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:618` | One task, every speaker | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:619` | One task, every speaker | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:676` | One task · still waiting | `30px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:684` | One task · still waiting | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:685` | One task · still waiting | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:60` | Triage at volume · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:61` | Triage at volume · 1600 | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:62` | Triage at volume · 1600 | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:86` | Triage at volume · 1600 | `6px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:87` | Triage at volume · 1600 | `6px 11px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:207` | Submission detail · /submissions/:id | `24px 34px 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:265` | Submission detail · /submissions/:id | `16px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:280` | Submission detail · /submissions/:id | `24px 0 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:281` | Submission detail · /submissions/:id | `0 0 8px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:403` | CFP form builder · /submissions/forms | `20px 32px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:409` | CFP form builder · /submissions/forms | `9px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:410` | CFP form builder · /submissions/forms | `10px 15px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:414` | CFP form builder · /submissions/forms | `22px 32px 34px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:416` | CFP form builder · /submissions/forms | `13px 14px 13px 0` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:506` | New submission | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:542` | Save this view | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:585` | Submissions · before the CFP opens | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:590` | Submissions · before the CFP opens | `44px 0 40px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:629` | Submissions · triage queue clear | `34px 34px 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:641` | Submissions · triage queue clear | `30px 0 24px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:667` | CFP form · edit a question | `20px 26px 26px` | not adjudicated this wave | UNMATCHED |

Total: 252 rows, matching `PACK_PADDING_UNMATCHED_CEILING`.

## Repair

Not this lane's spend. This instrument measures and ratchets only; desktop
stays frozen. Because this ceiling is PARKED (OUT_OF_CAMPAIGN_SCOPE only,
per DEC-069 wave-53 clause (b)), promotion into `CAMPAIGN_CONSTANT_NAMES` +
`TIER2_CEILING_NAMES` is a later wave's ruling, once the offender roster
above is individually adjudicated against its own render site — the same
disposition already given to `PACK_GRID_TRACK_UNMATCHED_CEILING` and
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING`.
