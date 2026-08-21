# Phone drawn-floor divergence (DEC-393 wave-147 amendment)

Measured on branch `v12m-w7-da` by `test/frame-control-floor.scan.test.ts`, forcing `FRAME_FLOOR_DIVERGENCE_CEILING` to `-1` and reading the printed offender list back. Population: 235 drawn phone controls across all 13 `docs/design/*.dc.html` files (155 resolved to a source element, 153 of those to no `chq-` rule or no exact-text match and are counted UNRESOLVED rather than offenders -- see the scan's own header for the disposition rule). 7 controls declare a `min-height` STRICTLY BELOW the floor their own frame draws.

Wave-155 pb (DEC-393) drained all 7: each fixed at the token the scan resolved, in a scoped rule inside the owning sheet's terminal `@media (max-width: 700px)` block (DEC-385 single-direction, no house register raised). `FRAME_FLOOR_DIVERGENCE_CEILING` is `0`.

## Drained (formerly Offenders, wave-155 pb)

1. **"Sign in"** -- docs/design/Chautauqua Account.dc.html:136 draws `min-height:50px`. Token `.chq-btn.chq-btn-primary`. Landed rule, `src/routes/auth.css.ts`: `` .chq-auth-stack .chq-auth-card .chq-btn.chq-btn-primary { width: 100%; min-height: 50px; border-radius: 6px; font-size: 15px; } ``

2. **"Edit"** -- docs/design/Chautauqua Contacts.dc.html:435 draws `min-height:48px`. Token `.chq-link-button.chq-settings-inline-action`. Landed rule, `app/src/pages/settings/settings.css`: `` .chq-link-button.chq-settings-inline-action { min-height: 48px; } ``

3. **"Edit"** -- docs/design/Chautauqua Public and Portal.dc.html:589 draws `min-height:48px`, the same `.chq-link-button.chq-settings-inline-action` token and landed rule as row 2.

4. **"‹ Previous"** -- docs/design/Chautauqua Docs.dc.html:201 draws `min-height:46px`. Token `.chq-detail-position-prev`. Landed rule, `app/src/pages/submissions/detail.css`: `` .chq-detail-position-prev, .chq-detail-position-next { min-height: 46px; } ``

5. **"Next ›"** -- docs/design/Chautauqua Docs.dc.html:202 draws `min-height:46px`, the same `.chq-detail-position-next` token and landed rule as row 4.

6. **"Download .ics"** -- docs/design/Chautauqua Public and Portal.dc.html:401 draws `min-height:46px`. Token `.chq-pub-itinerary-cta`. Landed rule, `src/routes/public/css/agenda.css.ts`: `` .chq-pub-itinerary-cta { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; } ``

7. **"Download .ics"** -- docs/design/Chautauqua Public and Portal.dc.html:885 draws `min-height:48px`, the same `.chq-pub-itinerary-cta` token and landed rule as row 6 -- 48px satisfies both drawn values (46px and 48px) with one rule.

## Not offenders (UNRESOLVED, 153 of 235)

The remaining unresolved population is exactly the shape the scan's own header predicts: a label composed at render (a shared helper, a live count, a template literal such as the admin tabbar's `{{ t.label }}` row), a label with no exact flat tag/text match in the source corpus, or a matched element whose token carries no CSS rule at all. None of these 153 rows is a claim this document makes -- `frame-control-label.scan.test.ts` already grades whether the app renders the WORDS; this ledger only grades the HEIGHT of a control this scan could positively resolve to a source token.
