# Review v12 fidelity audit — 390 (task w3-g)

Numbered findings the task window could not resolve within scope.

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106).

## 1. RESOLVED (wave 106, app/src/pages/review/Scorecard.tsx:481, app/src/styles.css:2302, app/src/App.tsx:474) — Neither reviewer-scorecard 390 frame draws a tab bar

`docs/design/Chautauqua Review.dc.html:280-350` ("Reviewer scorecard ·
/review/plans/:id/submissions/:id") and `:934-1138` ("Scorecard · a
criterion unscored") both draw the phone device box edge-to-edge with no
tab bar row. Re-derived against main: the shell-level decision this
finding correctly deferred has since been made. `App.tsx`'s `PhoneTabBar`
mounts unconditionally in the shell (`App.tsx:474` — `<PhoneTabBar />`), but
`styles.css:2302` gives the shell a general attribute contract — any
page root that sets `data-chq-phone-dock` suppresses the tab bar via
`.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar { display: none }`.
`Scorecard.tsx:481` opts the reviewer scorecard's page root into that
contract with `{...(isPhone ? { 'data-chq-phone-dock': true } : {})}`,
matching both frames' edge-to-edge, no-tab-bar rendering. The contract
itself is now enforced app-wide by
`app/src/phone-dock-declares.scan.test.ts` (DEC-576 wave-98). Closed.
