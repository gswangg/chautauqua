# Meta-fidelity probe: desktop (speakers cluster + admin spot-checks).
# Verdict: v12 speakers CORE frame-complete; edges + one live regression.

## Campaign regression (fix first)
- PlanEditor.tsx:1565/:2171 mount chq-review-criteria-count-phone /
  chq-review-reviewers-count-phone whose only rules are inside the 700px
  block (review.css:2367/:2514) — bare numerals paint on desktop and shove
  the section-head eyebrow to mid-page (space-between third child).
  From 75ade503 (v12m-w5-b). Needs desktop-scope hiding + SCAN WIDENING:
  leak scans match chq-phone-* prefix only; widen predicate to /phone/
  anywhere + require a desktop hiding rule.
  RESOLVED (v12m-w5-k, DEC-919 wave-109 amendment): review.css now
  declares `.chq-review-criteria-count-phone { display: none; }` and
  `.chq-review-reviewers-count-phone { display: none; }` top-level at
  review.css:2044/:2048, before the terminal 700px block, so both are
  hidden at desktop widths and only re-shown by the later phone rule
  (source-order win, DEC-385). The SCAN WIDENING also landed:
  app/src/phone-block-visibility.test.ts:335 now tests
  `/phone/.test(token)` rather than a `chq-phone-*` prefix only.
  CLOSED (wave 115): app/src/pages/review/review.css:2044 `.chq-review-criteria-count-phone {`
  CLOSED (wave 115): app/src/pages/review/review.css:2048 `.chq-review-reviewers-count-phone {`
  CLOSED (wave 115): app/src/phone-block-visibility.test.ts:335 `if (token && /phone/.test(token))`

## Speakers-cluster edge MAJORs
- Filtered-empty state keeps table footer chrome (legend + disabled pager)
  beneath the empty block (frame Speakers.dc.html:442-483).
  CLOSED (wave 118): app/src/pages/speakers/OnboardingGrid.tsx:1365 `{!gridRead.loading && grid && visibleRows.length > 0 && (`
- Speaker-detail rail uses full-page empty block (24px headline in a 320px
  rail; frame :414-424 draws a 14px/13px two-line list).
  CLOSED (wave 120, DEC-829 wave-110 amendment; re-derived by task w9-n and
  merged with the wave-119 receipt in the wave-120 megabatch): the rail
  scopes both the block and its headline --
  app/src/pages/speakers/speakers.css`.chq-speaker-detail-rail .chq-empty-block-fresh {`
  and app/src/pages/speakers/speakers.css`.chq-speaker-detail-rail .chq-empty-what {`
  (drift-proof citations, DEC-967 wave-115).
- "Review these reminders" modal body lacks the drawn anatomy (frame
  :505-541: per-recipient outstanding task names + overdue/due-soon flags,
  rendered email card, "Logged in Comms history" line).
  CLOSED (wave 118): app/src/pages/speakers/RemindPreviewModal.tsx:86 `{!isZeroState && <span className="chq-speakers-remind-logged">Logged in Comms history</span>}`

## Pre-campaign admin MAJORs
- Plan criteria column heads off by one track ("Type" missing; WEIGHT over
  Type column) — 1d2d9bdb.
  CLOSED (wave 115): app/src/pages/review/PlanEditor.tsx:1701 `reviewers · optional</span><span>Type</span><span>Weight</span>`
- .chq-detail-footer shrink-wraps; "Delete this session" centres at x=739
  in a left-ragged layout.
  NOT-A-FRAME-DIVERGENCE (wave 120): the string "Delete this session" does
  not appear anywhere in `docs/design/Chautauqua Submissions.dc.html`
  (grepped in full, zero matches). The control is a DEC-886 wave-2
  discoverability affordance the v12 frames never drew, per its own
  comment: app/src/pages/submissions/SubmissionDetailPage.tsx:1966 `{/* DEC-886 (wave 2 amendment): the blast-radius delete page already`.
  Under the mandate's desktop freeze a desktop change is legal only when a
  v12 desktop frame demands it -- there is no frame row here to conform
  the footer's layout to, so there is nothing to implement.
- .chq-settings-row-hint inherits text-align:right; tracks/rooms refusal
  captions float mid-page.

## Still live at wave 120
- `.chq-settings-row-hint`'s base desktop rule (app/src/pages/settings/settings.css:1142
  `.chq-settings-row-hint {`, through settings.css:1146 `text-align: right;`)
  is unchanged by the merged `v12m-w8-b` fix at settings.css:1593-1599 — that
  commit (diffed against its merge-base 885bceb8, tip 98fefd31) only added a
  phone-width (`max-width: 700px`) override at settings.css:1599
  `text-align: left;` and moved ONE consumer (CallForPapersPanel's
  tracks-empty hint) to a new class, `.chq-settings-note`
  (app/src/pages/settings/CallForPapersPanel.tsx:565
  `<p className="chq-settings-note">`). The desktop rule
  `.chq-settings-row-hint { ... text-align: right; }` still governs
  TrackEditRow.tsx:99 `{inUse ? <p className="chq-settings-row-hint">In use — retire it instead of removing</p> : null}`
  and RoomEditRow.tsx:96 `{inUse ? <p className="chq-settings-row-hint">Has scheduled sessions — cannot be removed</p> : null}`,
  both rendered inside .chq-settings-edit-row's 3-column grid (defined at
  settings.css:1061-1067; no grid-column property is set on the hint
  paragraph itself, so it lands in the leading minmax(0, 1fr) track and
  right-aligns mid-row rather than reading as a left-flush caption). The frame draws the
  equivalent global note left-aligned with no `text-align` override at all
  (`docs/design/Chautauqua Settings.dc.html:835`
  `<div style="padding:12px 0 0; font-size:13px; color:#565A4B; line-height:1.5">The swatch is how a track reads on the agenda and the public pages · a track in use cannot be removed — retire it instead and it stops appearing on the form</div>`).

## Register minors worth taking
"reminded in the last hour" vs task-view "emailed" self-inconsistency;
speaker-detail drops reminder counts TaskView derives from the same log;
"Was due"/"Due" tense lost; sessions row bordered chip vs frame's bare
olive caps + session code printed twice; bulk-bar primary 35px vs 36px
uniform; not-chasing caption italic (style appears nowhere in the frames).
