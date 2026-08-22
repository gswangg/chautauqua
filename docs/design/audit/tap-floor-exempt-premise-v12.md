# tap-floor-exempt receipt premise audit (DEC-393 wave-30 amendment, second floor-grammar tier added wave-34)

Instrument: `test/tap-floor-exempt-premise.scan.test.ts`. Population: every
real `/* tap-floor-exempt: ... */` (or JSX `{/* ... */}`) comment under
`src/**` and `app/src/**` (excluding `*.test.ts(x)` and this campaign's own
scan-library directories, `app/src/phone-tap-target-scan/` and
`app/src/phone-overflow-scan/`, whose prose ABOUT the token is not a real
receipt — verified by hand against `app/src/phone-tap-target-scan/
undeclared.ts`'s literal `<reason>` grammar placeholder). Measured: **98
receipts** — 19 `composition`, 11 `inline-*`, 68 `other` (by the reason's own
first word).

Wave 34 gave the instrument a SECOND floor-grammar tier, derived from the
sheet's own rules (never a hand-listed selector allowlist, DEC-367/DEC-808):
a companion co-styled with an `img` element selector in the same CSS rule
(the pack's own idiom for pairing a real `<img>` with its no-photo fallback,
e.g. `.chq-foo img, .chq-foo-fallback { ... }`) satisfies the 44px hit-box
floor through its OWN resolved width/height (or min-width/min-height) rules
reaching >=44px on BOTH axes — independent of `display:flex` /
`align-items:center` / padding, which a replaced-content box (no text to
centre or pad around) has no reason to declare. Re-measured by forcing both
ceilings to `-1` and reading the roster back: `FALSE-PREMISE` 1 -> **0**;
`UNVERIFIABLE-PREMISE` unchanged at **86**.

## Verdict counts

| Verdict | Count | Meaning |
|---|---|---|
| VERIFIED | 12 | the receipt names a companion class, and that class satisfies EITHER floor-grammar tier: (1) a real min-height:44px + centred flex (`flex`/`inline-flex`) + non-zero horizontal padding rule (merged across every rule mentioning it — this codebase's idiom splits display/align-items on a base rule from min-height/padding on a phone-media rule for the same selector), or (2) wave-34's replaced-content tier — the companion is co-styled with an `img` element selector and its own merged width/height (or min-width/min-height) rules put both axes at >=44px — and the companion appears in real product markup. |
| UNVERIFIABLE-PREMISE | 86 | this wave's instrument cannot express a check for the receipt — either its reason family (`other`) has no predicate yet, or a `composition`/`inline-*` reason names no companion class distinct from the receipted selector itself. Per DEC-393 wave-30 clause (c): a roster row, not a silent pass. |
| FALSE-PREMISE | 0 | the receipt names a companion class that is real but does NOT carry either floor-grammar tier this instrument checks for. |

## The worked example (built this wave)

`src/routes/public/css/agenda.css.ts` `.chq-pub-agenda-day-footer a` — the
receipt previously argued only typography ("a 44px box would break the line
box"). Rewritten to also name the load-bearing premise: `agenda.tsx`
renders `<DaySwitcher`, whose `.chq-pub-day-pill` anchors
(`src/routes/public/css/agenda.css.ts`, min-height:44px + flex +
align-items:center + padding:0 8px) build their href from the same
`agendaQs(current, {day})` helper with the same `nextDay`, reaching the
identical destination. `test/public-agenda-phone-frames.render.test.ts` gained
a pin asserting `.chq-pub-day-switcher`/`.chq-pub-day-pill` render on a real
`/e/:slug/agenda` request at 390, so the premise cannot rot silently. Now
resolves VERIFIED (see roster below).

## The former FALSE-PREMISE row, now VERIFIED: a second floor-grammar tier closed the predicate-grammar mismatch

`src/routes/public/css/cards.css.ts` `.chq-pub-headshot-link`'s
`composition` receipt names `.chq-pub-headshot-fallback` as the floored
companion. That class's real claim was always a REPLACED-CONTENT sizing one
— the anchor "carries no size of its own"; its `<img>`/
`.chq-pub-headshot-fallback` child is sized to fill a >=44px tile via
width/height rules (`.chq-pub-speaker-list-photo .chq-pub-headshot-fallback`
76px/64px, `.chq-pub-speaker-grid img, .chq-pub-headshot-fallback` 100% of a
>=~106px tile, both co-styled with an `img` element selector in the same
rule) — never the flex+padding grammar this instrument checked before wave
34, because there is no text content to centre or pad around. DESIGN-
RULINGS.md's 44px floor is about the HIT BOX, which a sized replaced-content
box satisfies without flex/padding at all; the gap was in THIS instrument's
grammar, not a real 44px defect. Wave 34 built the second tier the previous
wave named as its first option: a companion co-styled with an `img` element
selector (derived from the sheet's own rules, never a hand-listed
allowlist) is judged on its own merged width/height rules reaching >=44px on
both axes, independent of flex/padding. `.chq-pub-headshot-fallback`'s
merged rules carry an explicit `width:76px; height:76px` (the list-view
size), which alone clears both axes, so the row now resolves VERIFIED. The
new tier is guarded by two negative controls in the scan itself (a
replaced-content companion sized 40px still grades FALSE-PREMISE; a
text-bearing companion with no `img` pairing and no flex/padding still
grades FALSE-PREMISE even when sized >=44px), so it cannot silently pass a
real text-control defect through the replaced-content door.

## Full roster (98 rows)

| Verdict | Family | File:line | Detail |
|---|---|---|---|
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/agenda/agenda.css:1003` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/content/content.css:76` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/overview/overview.css:429` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/review/review.css:90` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/speakers/speakers.css:1313` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `app/src/pages/speakers/speakers.css:1876` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `src/routes/public/css/agenda.css.ts:765` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | composition | `src/views/error-states.css.ts:72` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/portal/tasks/views.tsx:314` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts:135` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts:480` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/cfp.css.ts:51` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:625` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:783` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:924` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/routes/public/submit-views.tsx:950` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/views/theme.ts:620` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | inline | `src/views/theme.ts:670` | no companion class named in reason text (distinct from the receipted selector itself) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/agenda/agenda.css:280` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/agenda/agenda.css:440` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/agenda/agenda.css:478` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/agenda/agenda.css:534` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/agenda/agenda.css:693` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/agenda/agenda.css:777` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:1235` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:158` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:2265` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:228` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:250` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/comms/comms.css:670` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts-panels.css:289` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts-panels.css:991` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts.css:581` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/contacts/contacts.css:596` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:143` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:23` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:432` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:504` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:671` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:761` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:879` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/content/content.css:908` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/forms/forms.css:348` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/forms/forms.css:361` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css:148` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css:564` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/overview/overview.css:608` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1256` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1291` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1521` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1562` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1679` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:1781` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:316` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/review.css:331` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/review/scorecard.css:98` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/settings/settings.css:2583` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/speakers/task-view.css:284` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:269` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:278` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:378` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/detail.css:731` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:1157` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:206` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:27` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:403` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/pages/submissions/submissions.css:620` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1365` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1388` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1444` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1704` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1772` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:1948` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:2879` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `app/src/styles.css:997` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/docs-site.css.ts:507` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/docs-site.css.ts:98` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/portal/portal.css.ts:102` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/portal/portal.css.ts:359` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/css/chrome.css.ts:36` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/css/rail.css.ts:671` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/routes/public/home.css.ts:152` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/views/error-states.css.ts:46` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/views/theme.ts:461` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/views/theme.ts:486` | reason family has no automated predicate this wave (roster row) |
| UNVERIFIABLE-PREMISE | other | `src/views/theme.ts:538` | reason family has no automated predicate this wave (roster row) |
| VERIFIED | composition | `app/src/pages/agenda/agenda.css:1121` | companion .chq-phone-footer-actions floored (min-height:44px+flex+centre+h-padding across 4 rule(s)) and present in markup |
| VERIFIED | composition | `app/src/pages/content/content.css:60` | companion .chq-btn floored (min-height:44px+flex+centre+h-padding across 86 rule(s)) and present in markup |
| VERIFIED | composition | `app/src/pages/overview/overview.css:404` | companion .chq-overview-link-btn floored (min-height:44px+flex+centre+h-padding across 9 rule(s)) and present in markup |
| VERIFIED | composition | `app/src/pages/overview/overview.css:457` | companion .chq-overview-link-btn floored (min-height:44px+flex+centre+h-padding across 9 rule(s)) and present in markup |
| VERIFIED | composition | `app/src/pages/speakers/speakers.css:2034` | companion .chq-btn floored (min-height:44px+flex+centre+h-padding across 86 rule(s)) and present in markup |
| VERIFIED | composition | `app/src/pages/speakers/speakers.css:2071` | companion .chq-btn floored (min-height:44px+flex+centre+h-padding across 86 rule(s)) and present in markup |
| VERIFIED | composition | `src/routes/docs-site.css.ts:215` | companion .chq-docs-article-title floored (min-height:44px+flex+centre+h-padding across 2 rule(s)) and present in markup |
| VERIFIED | composition | `src/routes/portal/portal.css.ts:265` | companion .chq-portal-standalone-link floored (min-height:44px+flex+centre+h-padding across 2 rule(s)) and present in markup |
| VERIFIED | composition | `src/routes/public/css/agenda.css.ts:581` | companion .chq-pub-day-pill floored (min-height:44px+flex+centre+h-padding across 1 rule(s)) and present in markup |
| VERIFIED | composition | `src/routes/public/css/agenda.css.ts:814` | companion .chq-pub-day-pill floored (min-height:44px+flex+centre+h-padding across 1 rule(s)) and present in markup |
| VERIFIED | inline | `src/routes/public/css/agenda.css.ts:793` | companion .chq-pub-day-pill floored (min-height:44px+flex+centre+h-padding across 1 rule(s)) and present in markup |
| VERIFIED | composition | `src/routes/public/css/cards.css.ts:239` | companion .chq-pub-headshot-fallback is a replaced-content box (co-styled with an img selector) whose own width/height rules put both axes at >=44px and present in markup |
