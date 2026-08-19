# Meta-fidelity probe: desktop (speakers cluster + admin spot-checks).
# Verdict: v12 speakers CORE frame-complete; edges + one live regression.

## Campaign regression (fix first)
- PlanEditor.tsx:1565/:2170 mount chq-review-criteria-count-phone /
  chq-review-reviewers-count-phone whose only rules are inside the 700px
  block (review.css:2328/:2475) — bare numerals paint on desktop and shove
  the section-head eyebrow to mid-page (space-between third child).
  From 75ade503 (v12m-w5-b). Needs desktop-scope hiding + SCAN WIDENING:
  leak scans match chq-phone-* prefix only; widen predicate to /phone/
  anywhere + require a desktop hiding rule.

## Speakers-cluster edge MAJORs
- Filtered-empty state keeps table footer chrome (legend + disabled pager)
  beneath the empty block (frame Speakers.dc.html:442-483).
- Speaker-detail rail uses full-page empty block (24px headline in a 320px
  rail; frame :414-424 draws a 14px/13px two-line list).
- "Review these reminders" modal body lacks the drawn anatomy (frame
  :505-541: per-recipient outstanding task names + overdue/due-soon flags,
  rendered email card, "Logged in Comms history" line).

## Pre-campaign admin MAJORs
- Plan criteria column heads off by one track ("Type" missing; WEIGHT over
  Type column) — 1d2d9bdb.
- .chq-detail-footer shrink-wraps; "Delete this session" centres at x=739
  in a left-ragged layout.
- .chq-settings-row-hint inherits text-align:right; tracks/rooms refusal
  captions float mid-page.

## Register minors worth taking
"reminded in the last hour" vs task-view "emailed" self-inconsistency;
speaker-detail drops reminder counts TaskView derives from the same log;
"Was due"/"Due" tense lost; sessions row bordered chip vs frame's bare
olive caps + session code printed twice; bulk-bar primary 35px vs 36px
uniform; not-chasing caption italic (style appears nowhere in the frames).
