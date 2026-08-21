# Phone drawn-floor divergence (DEC-393 wave-147 amendment)

Measured on branch `v12m-w7-da` by `test/frame-control-floor.scan.test.ts`, forcing `FRAME_FLOOR_DIVERGENCE_CEILING` to `-1` and reading the printed offender list back. Population: 235 drawn phone controls across all 13 `docs/design/*.dc.html` files (155 resolved to a source element, 153 of those to no `chq-` rule or no exact-text match and are counted UNRESOLVED rather than offenders -- see the scan's own header for the disposition rule). 7 controls declare a `min-height` STRICTLY BELOW the floor their own frame draws.

This document only records the measured divergence. No product CSS byte changes with it -- draining these seven is a later, separately-ruled act (the same disposition DEC-967 wave-133 gave `LINE_KEYED_CITATION_CEILING`).

## Offenders

1. **"Sign in"** -- docs/design/Chautauqua Account.dc.html:136 draws `min-height:50px`. Rendered by `src/routes/auth-views.tsx` line 129 as a `.chq-btn.chq-btn-primary` control. `app/src/styles.css`\`.chq-btn { min-height: 44px;` declares 44px (checked; `.chq-btn-primary` adds no further height) -- 6px short of the frame's 50px.

2. **"Edit"** -- docs/design/Chautauqua Contacts.dc.html:435 draws `min-height:48px`. Rendered as a `.chq-link-button.chq-settings-inline-action` control. `app/src/styles.css`\`.chq-link-button {` carries the shared house link register's phone floor of 44px -- 4px short of the frame's 48px.

3. **"Edit"** -- docs/design/Chautauqua Public and Portal.dc.html:589 draws `min-height:48px`, the same `.chq-link-button.chq-settings-inline-action` control as offender 2 above and the same 44px-declared shortfall.

4. **"‹ Previous"** -- docs/design/Chautauqua Docs.dc.html:201 draws `min-height:46px`. Rendered by `app/src/pages/submissions/SubmissionDetailPage.tsx` as `.chq-detail-position-prev`. `app/src/pages/submissions/detail.css`\`.chq-detail-position-prev,` declares 44px -- 2px short of the frame's 46px (DEC-393 wave-92's own amendment already names this exact pager pair as drawing 46px on the Docs frame, but the ruling closed the Docs sheet's own pager, not the shared submissions-detail token this label actually resolves to).

5. **"Next ›"** -- docs/design/Chautauqua Docs.dc.html:202 draws `min-height:46px`, the same `.chq-detail-position-next` sibling token, same 44px-declared shortfall.

6. **"Download .ics"** -- docs/design/Chautauqua Public and Portal.dc.html:401 draws `min-height:46px`. Rendered across `src/routes/public/agenda.tsx`/`agenda-rail.tsx`/`sessions.tsx`/`detail.tsx` as `.chq-pub-itinerary-cta`. `src/routes/public/css/agenda.css.ts`\`.chq-pub-itinerary-cta { min-height: 44px; display: inline-flex;` declares 44px -- 2px short of the frame's 46px.

7. **"Download .ics"** -- docs/design/Chautauqua Public and Portal.dc.html:885 draws `min-height:48px`, the same `.chq-pub-itinerary-cta` token as offender 6, 4px short of the frame's 48px this time (the same token is drawn at two different heights by two different frame instances -- a fact about the pack, not a fact this scan resolves further).

## Not offenders (UNRESOLVED, 153 of 235)

The remaining unresolved population is exactly the shape the scan's own header predicts: a label composed at render (a shared helper, a live count, a template literal such as the admin tabbar's `{{ t.label }}` row), a label with no exact flat tag/text match in the source corpus, or a matched element whose token carries no CSS rule at all. None of these 153 rows is a claim this document makes -- `frame-control-label.scan.test.ts` already grades whether the app renders the WORDS; this ledger only grades the HEIGHT of a control this scan could positively resolve to a source token.
