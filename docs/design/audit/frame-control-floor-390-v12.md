# Phone drawn-floor divergence (DEC-393 wave-147 amendment)

Measured on branch `v12m-w7-da` by `test/frame-control-floor.scan.test.ts`, forcing `FRAME_FLOOR_DIVERGENCE_CEILING` to `-1` and reading the printed offender list back. Population: 235 drawn phone controls across all 13 `docs/design/*.dc.html` files. `FRAME_FLOOR_DIVERGENCE_CEILING` is `0`.

## Wave-22 correction (DEC-995): the label join was ambiguity-blind

The scan's original join kept the FIRST flat `<TAG attrs>TEXT</TAG>` source match per label ("first occurrence wins, deterministic file order"). Re-measured on this branch: **82 of 720 labels in the whole source corpus carry more than one DISTINCT `chq-` token set** across their sites (comparing each site's sorted, joined token list; a site with no `chq-` token is itself a distinct set). Five of the seven rows below (all but the "‹ Previous"/"Next ›" pair) resolved through exactly this defect -- the first-hit token set the old join picked was not necessarily the token set the actual frame's control loads. The scan now collects every site per label and grades a label ambiguous (`reason: 'ambiguous-source-match'`) the moment its sites disagree; an ambiguous control falls into the UNRESOLVED bucket and can never be an offender. This can only ever move controls OUT of the offender bucket, never in -- re-measured on this branch, `FRAME_FLOOR_DIVERGENCE_CEILING` remains `0` (0 offenders).

Corrected population, measured on this branch: 235 drawn controls total, 33 resolve to a single, unambiguous source element and CSS rule (all 33 conforming -- 0 offenders), 202 are UNRESOLVED (`UNRESOLVED_COUNT_TRIPWIRE = 202`), of which 60 are specifically `ambiguous-source-match` (`AMBIGUOUS_COUNT_TRIPWIRE = 60`) and the remaining 142 resolve to no source match, no class token, or no CSS rule at all, exactly as before.

## Proven (unambiguous single-site match, still DRAINED)

Only these two rows resolve through a label with exactly ONE site in the whole corpus -- there is no other element in the app that could be credited instead, so these two remain proven, conforming, drained fixes from wave-155 pb (DEC-385 single-direction, no house register raised):

1. **"‹ Previous"** -- docs/design/Chautauqua Docs.dc.html:201 draws `min-height:46px`. Token `.chq-detail-position-prev` (the label's ONLY site in the corpus). Landed rule, `app/src/pages/submissions/detail.css`: `` .chq-detail-position-prev, .chq-detail-position-next { min-height: 46px; } ``

2. **"Next ›"** -- docs/design/Chautauqua Docs.dc.html:202 draws `min-height:46px`, the same `.chq-detail-position-next` token and landed rule as row 1 (also the label's only site).

## Now AMBIGUOUS (formerly presented as Drained -- DEC-995, DEC-976 same-commit correction)

These five rows previously credited a Settings/Account/public-agenda-only rule to a frame that does not necessarily load it. Each label's sites disagree on their `chq-` token set, so none of them resolves to a single owning rule here and none is (or ever was, under the corrected join) provably an offender either -- they are UNRESOLVED, not proven-conforming and not proven-divergent:

3. **"Sign in"** -- docs/design/Chautauqua Account.dc.html:136 (drawn `min-height:50px`). The label "Sign in" has 4 sites in the corpus with 4 distinct token sets: `chq-btn,chq-btn-primary` (Account), `chq-home-signin`, `chq-home-action-secondary`, `chq-home-action-primary` (three more Home.dc.html-drawn sites: Chautauqua Home.dc.html:119, 234, 305/313). The old join's first-hit pick (`.chq-btn.chq-btn-primary`, declared 48px) was one of four candidates, not a determined answer -- ambiguous, not proven.

4. **"Edit"** -- docs/design/Chautauqua Contacts.dc.html:435 (drawn `min-height:48px`). The label "Edit" has 6 sites across the corpus (Contacts:435, Public and Portal:589, Settings:364/379/469, Submissions:481) with 3 distinct token sets: `chq-link-button,chq-settings-inline-action`; `chq-link-button` alone; `chq-settings-phone-action,chq-settings-tracks-rooms-row-edit`. Ambiguous.

5. **"Edit"** -- docs/design/Chautauqua Public and Portal.dc.html:589 (drawn `min-height:48px`), the same ambiguous "Edit" label as row 4.

6. **"Download .ics"** -- docs/design/Chautauqua Public and Portal.dc.html:401 (drawn `min-height:46px`). The label "Download .ics" has 3 sites with 3 distinct token sets: `chq-pub-itinerary-cta` alone; `chq-pub-agenda-dock-ics,chq-pub-itinerary-cta`; `chq-pub-itinerary-cta,chq-pub-schedule-dock-ics`. Ambiguous.

7. **"Download .ics"** -- docs/design/Chautauqua Public and Portal.dc.html:885 (drawn `min-height:48px`), the same ambiguous "Download .ics" label as row 6.

None of rows 3-7 is a defect claim -- adjudicating which of a label's several distinct token sets actually owns a given frame's control (rather than merely co-occurring with the same visible words elsewhere in the app) is outside this scan's join, which only ever proves an EXACT single-site match. That adjudication, if it happens, is a design-authority act over the frames themselves, not a re-run of this ledger.

## Not offenders (UNRESOLVED, 202 of 235)

The UNRESOLVED population is exactly the shape the scan's own header predicts, now split into two disposition: `ambiguous-source-match` (60 -- see above, a label whose sites disagree on token set) and everything else (142 -- a label composed at render such as a shared helper, a live count, or a template literal like the admin tabbar's `{{ t.label }}` row; a label with no exact flat tag/text match in the source corpus at all; or a matched element whose token carries no CSS rule at all). None of these 202 rows is a claim this document makes -- `frame-control-label.scan.test.ts` already grades whether the app renders the WORDS; this ledger only grades the HEIGHT of a control this scan could positively, unambiguously resolve to a single source token.
