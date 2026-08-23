# Public/portal mobile tap-floor offender roster (390px, DEC-253/DEC-367/DEC-808 wave-30 amendment)

MACHINE-WRITTEN by `npm run gate:render-sweep` (scripts/render-sweep.ts). Do not hand-edit — the next gate run overwrites this file unconditionally.

Lists every visible interactive control under the 44px tap-target floor (`MIN_TAP_TARGET_PX`, either dimension) found by the public/portal 390x844 mobile pass, one route section per route with at least one offender, sorted by route path. Each line is classified EXEMPT (naming the receipt token that reaches it) or CANDIDATE (DEC-996 wave-24 amendment) — a bare count over this mixed population is not a measurement.

## /docs/api

- a.chq-wordmark w=113px h=28px — **EXEMPT** (receipt: `chq-wordmark`)
- a w=41px h=19px — **CANDIDATE**

## /docs/start-here

- a.chq-docs-phone-back w=38px h=44px — **REPAIRED-SINCE-SNAPSHOT** (min-height:44px + padded past the width floor, `src/routes/docs-site.css.ts` `.chq-docs-phone-back` inside `@media (max-width: 700px)`, DEC-393 wave-33)

## /e/devflow-conf-2027/agenda

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- a w=108px h=15px — **CANDIDATE**

## /e/devflow-conf-2027/gallery

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)

## /e/devflow-conf-2027/sessions

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)

## /e/devflow-conf-2027/sessions/seed_submission_0001

- a.chq-pub-detail-speaker-link w=88px h=19px — **EXEMPT** (receipt: `chq-pub-detail-speaker-link`)

## /e/devflow-conf-2027/speakers

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)

## /embed/devflow-conf-2027/agenda

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- a w=108px h=15px — **CANDIDATE**

## /embed/devflow-conf-2027/gallery

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)

## /embed/devflow-conf-2027/sessions

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)

## /embed/devflow-conf-2027/speakers

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)

## /embed/e/seed_embed_0001

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- a.chq-pub-activefilters-clear w=40px h=44px — **REPAIRED-SINCE-SNAPSHOT** (min-height:44px + padded past the width floor, `src/routes/public/css/chrome.css.ts` `.chq-pub-activefilters-clear` inside `@media (max-width: 700px)`, DEC-393 wave-139)

## /portal/profile

- input.chq-portal-headshot-pick-input w=1px h=44px — **EXEMPT** (receipt: `chq-portal-headshot-pick-input`)

## /portal/submissions/seed_submission_0001/edit

- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**

## /portal/tasks

- a w=194px h=19px — **CANDIDATE**

## /submit/devflow-conf-2027

- a w=132px h=19px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- input w=18px h=18px — **CANDIDATE**
- a w=163px h=15px — **CANDIDATE**

Measured total: 41 (exempt: 19, candidate defects: 20, repaired-since-snapshot: 2)

DEC-808 wave-42 amendment: this roster is machine-written by a LIVE gate run at wave-30 (sha b9c5a45d8) and has not been re-run since (running `gate:render-sweep` is a heavy gate forbidden inside a code wave, DEC-644). The two rows above marked **REPAIRED-SINCE-SNAPSHOT** were re-classified STATICALLY, by checking each CANDIDATE row's class token against the tree's current stylesheets for a `min-height`/`height` rule effective at 390 (`test/public-390-offender-roster.scan.test.ts`) — not by re-running the gate — so their `w=`/`h=` columns above are the stale wave-30 reading, not a re-measurement. Every other CANDIDATE row is a bare `a`/`input` tag with no class token this static check can address; a live gate run is still the only way to confirm their current geometry.

## Vacuity clause (DEC-808 wave-30 amendment, clause d; re-grounded DEC-808 wave-42 amendment)

Routes below matched zero elements under the INTERACTIVE_CONTROL_SELECTOR population (minControlHeight === null) — the BLOCKING public mobile gate's height/width check has been passing on these routes vacuously, since there was nothing for it to measure. (DEC-808 wave-42 amendment: this clause used to name a six-selector hand list that has since been retired at wave 35 — visitMobileRoute's controlSelector default is INTERACTIVE_CONTROL_SELECTOR now; the four routes below are the wave-30 reading under the since-retired narrower population and have not been re-confirmed under the wide one, which a static scan cannot do — see PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR's own comment in scripts/render-sweep-lib.ts.)

- /
- /e/devflow-conf-2027/programme
- /embed/devflow-conf-2027/schedule
- /docs/api

Vacuous-narrow count: 4 (of 28 routes measured)
