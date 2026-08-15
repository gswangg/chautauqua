## 2026-08-15 task-w28-d — render-sweep @ c6dbdb7c

QUALIFYING (advisory to the DEC-069 predicate — the predicate's four required gates are build+test, walkthrough, perf-smoke, spec-audit; this section informs triage and does not itself satisfy a required row)

INVALIDATED BY: src/** app/src/** migrations/** package.json

Live `npm run gate:render-sweep` at HEAD `c6dbdb7cc615248d1a49485d63320570168f4c7b`
(short `c6dbdb7c`, log-only wave, nothing under `src/`, `app/src/`,
`scripts/`, `test/`, `migrations/`, `package.json` touched). Full sequence
(`ensure-dev-vars` -> `vite build` -> `db:migrate` -> `seed` ->
`gate:render-sweep`, own wrangler dev on OS-assigned port 49397) ran clean
through to the gate itself. Score lines: desktop `60/60`, public-mobile
`26/26`, admin-mobile `28/28` (advisory), font-floor `114/114` (advisory),
type-role `7/7` (advisory), contrast `57/60` (advisory but
`CONTRAST_BLOCKING = true` so it flips exit code), interaction-state `2/4`
(advisory, non-blocking). **Exit code 1** — the sole cause is 3 contrast FAIL
rows (`CONTRAST_BLOCKING = true`); desktop and both mobile passes were 100%
clean.

Six repairs, confirmed against this run (full quoted rows in the companion
per-row file):
- (i) `/admin/submissions/forms` clip row: **GONE** — clean `PASS`, no clip
  annotation, zero hits for `chq-forms-header-titles` anywhere in the log.
  DEC-991's wave-27 amendment holds.
- (ii) `/portal/tasks` public-mobile overflow: **GONE** — `overflowPx=0,
  minControlPx=44, PASS`.
- (iii) `/admin/submissions` mobile search tap-target: **PASS** —
  `minControlPx=44`, at the floor not under it.
- (iv) `cfp-primary-focus` real-Tab probe: **still FAIL**, but now for a
  genuine reason — `.chq-cfp-step-next` is unreachable via 25 sequential Tab
  presses. The rewritten probe (real `page.keyboard.press("Tab")` walk)
  itself works and reports truthfully; this is the first live-server reading
  since task-w25-e recorded it UNVERIFIED END-TO-END. OPEN ITEM, not an
  instrument defect.
- (v) `review-anonymize-disabled`: **mixed** — PASS on the `organizer` visit
  to `/admin/review/plans/seed_evaluation_plan_0001`, FAIL ("selector never
  resolved") on the `reviewer` visit to the identical path, because the
  reviewer's plan-detail layout does not render the disabled anonymize
  checkbox at all. The `waitFor({state:"attached"})` fix works correctly;
  the two-row split is a real per-role DOM fact, not an instrument bug.
- (vi) contrast on `/admin/review/plans/seed_evaluation_plan_0001`
  (`label.chq-review-checkbox-label`): **still FAIL** — ratio rose from the
  prior 2.43 reading to 3.09 (confirms `--chq-disabled` is now `#7D7869`,
  `rgb(125,120,105)`, against bg `#DDD8C8`) but 3.09 < 4.5 (WCAG AA normal
  text floor). Genuinely open, not resolved.

`KNOWN_CLIP_EXCEPTIONS` (scripts/render-sweep.ts:219-225) holds exactly ONE
entry — `"/admin/agenda::div.chq-session-card-title":
"intentional 3-line -webkit-line-clamp truncation"` — matching DEC-991's
one-entry rule. No additional entries, no open items from that map.

Full per-row tables, quoted log lines, and source citations:
`docs/verification-log/task-w28-d-render-sweep-c6dbdb7c.md`.

RESULT: FAIL — exit code 1, driven entirely by 3 pre-existing contrast rows (CONTRAST_BLOCKING=true); all three of (i)/(ii)/(iii) repairs confirmed landed, (iv)/(v)/(vi) remain genuinely open (not instrument defects).
OPEN ITEMS: 3

