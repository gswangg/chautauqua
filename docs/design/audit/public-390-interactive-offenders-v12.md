# Public/portal mobile tap-floor offender roster (390px, DEC-253/DEC-367/DEC-808 wave-30 amendment)

MACHINE-WRITTEN by `npm run gate:render-sweep` (scripts/render-sweep.ts). Do not hand-edit — the next gate run overwrites this file unconditionally.

Lists every visible interactive control under the 44px tap-target floor (`MIN_TAP_TARGET_PX`, either dimension) found by the public/portal 390x844 mobile pass, one route section per route with at least one offender, sorted by route path. Each line is classified EXEMPT (naming the receipt token that reaches it) or CANDIDATE (DEC-996 wave-24 amendment) — a bare count over this mixed population is not a measurement.

## /docs/api

- a.chq-wordmark w=113px h=28px — **EXEMPT** (receipt: `chq-wordmark`)
- a.chq-docs-auth-link w=41px h=19px — **EXEMPT** (receipt: `chq-docs-auth-link`)

## /e/devflow-conf-2027/agenda

- button.chq-visually-hidden w=1px h=44px — **EXEMPT** (receipt: `chq-visually-hidden`)
- a.chq-pub-agenda-day-footer-next w=108px h=15px — **EXEMPT** (receipt: `chq-pub-agenda-day-footer-next`)

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
- a.chq-pub-agenda-day-footer-next w=108px h=15px — **EXEMPT** (receipt: `chq-pub-agenda-day-footer-next`)

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

## /portal/submissions/seed_submission_0001/edit

- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)

## /portal/tasks

- a.chq-portal-file-link w=194px h=19px — **EXEMPT** (receipt: `chq-portal-file-link`)

## /submit/devflow-conf-2027

- a.chq-cfp-intro-cta-link w=132px h=19px — **EXEMPT** (receipt: `chq-cfp-intro-cta-link`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option.chq-cfp-pill > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option.chq-cfp-pill > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- label.chq-cfp-option.chq-cfp-pill > input w=18px h=18px — **EXEMPT** (receipt: `chq-cfp-option`)
- a.chq-cfp-identity-note-link w=163px h=15px — **EXEMPT** (receipt: `chq-cfp-identity-note-link`)

Measured total: 38 (exempt: 38, candidate defects: 0)

## Vacuity clause (DEC-808 wave-30 amendment, clause d)

Routes below matched zero elements under the INTERACTIVE_CONTROL_SELECTOR population (minControlHeight === null) — the BLOCKING public mobile gate's height/width check has been passing on these routes vacuously, since there was nothing for it to measure. (DEC-808 wave-42 amendment: this clause used to name a six-selector hand list that has since been retired -- visitMobileRoute's controlSelector default is INTERACTIVE_CONTROL_SELECTOR now.)

- /e/devflow-conf-2027/programme

Vacuous-narrow count: 1 (of 28 routes measured)
