# task-w28-d — render-sweep full detail @ c6dbdb7c

HEAD at run start: `c6dbdb7cc615248d1a49485d63320570168f4c7b` (short `c6dbdb7c`,
"scribe wave 28"). Log-only wave; nothing under `src/`, `app/src/`,
`scripts/`, `test/`, `migrations/`, `package.json` was touched.

Sequence run: `npx tsx scripts/ensure-dev-vars.ts` (created `.dev.vars` from
example — none present in worktree, no secrets required) -> `npx vite build
--config app/vite.config.ts` (OK) -> `npm run db:migrate` (0001-0039, all
applied clean on a fresh local D1) -> `npm run seed` (OK, 35 R2 objects) ->
`npm run gate:render-sweep` (own wrangler dev on OS-assigned free port
49397, torn down at process exit).

Full raw stdout/stderr captured at (worktree-local, not committed):
`render-sweep-output.log` (6285 lines).

## Score lines (as asked)

- **desktop**: `60/60 routes passed` (log line 5909)
- **public-mobile** (`render-sweep: mobile pass (390x844)...`): `26/26 mobile
  routes passed` (log line 5941)
- **admin-mobile** (advisory): `28/28 mobile routes passed` (log line 5975)
- **font-floor** (`type-floor pass`, advisory): `114/114 font-floor checks
  passed` (log line 6095)
- **type-role** (advisory): `7/7 type-role checks passed` (log line 6108)
- **contrast** (advisory but `CONTRAST_BLOCKING = true` in
  `scripts/render-sweep-contrast.ts:34`, so this pass's failures DO flip the
  gate's exit code): `57/60 contrast checks passed` (log line 6174)
- **interaction-state** (advisory, `INTERACTION_STATE_BLOCKING = false`):
  `2/4 interaction-state checks passed` (log line 6184)

**Exit code: 1 (FAIL)** — inferred from source, not a literal shell echo: the
script only reaches `console.error("--- wrangler dev log (tail) ---")`
(printed, log line 6185) and skips `console.log("gate:render-sweep OK")`
(never printed) when `failed` is true (`scripts/render-sweep.ts:1328-1337`).
`failed` is set at line 1308-1309 by
`if (!allContrastPassed(contrastResults) && CONTRAST_BLOCKING) { failed = true; }`
with `CONTRAST_BLOCKING = true` (`scripts/render-sweep-contrast.ts:34`,
DEC-426's flip-rule: "flip only if your own run reads all-PASS" — this run
does not, 3/60 contrast rows FAIL) and the desktop/mobile passes were
themselves 100% clean, so contrast is the sole source of the nonzero exit.
`TYPE_ROLE_BLOCKING = false` and `INTERACTION_STATE_BLOCKING = false`
(`scripts/render-sweep-lib.ts:608,810`) so those two advisory passes'
failures did not themselves contribute to `failed`.

## Every FAIL row, route + selector

Contrast pass (3 FAIL, all pre-existing/unrelated to the six repairs under
test):

```
/admin/speakers                  organizer  1.02  FAIL  worst: span.chq-participation-menu-caret ratio=1.02 fg=rgb(86,90,75) bg=rgb(78,92,49)
/admin/speakers/seed_contact_0001 organizer  1.02  FAIL  worst: span.chq-participation-menu-caret ratio=1.02 fg=rgb(86,90,75) bg=rgb(78,92,49)
/admin/review/plans/seed_evaluation_plan_0001 organizer 3.09 FAIL  worst: label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105) bg=rgb(221,216,200)
```

Interaction-state pass (2 FAIL):

```
.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  FAIL  (instrument-blocked: selector never resolved: .chq-review-field-disabled .chq-review-checkbox-label)
.chq-cfp-step-next                                     cfp-primary-focus          focus     FAIL  (instrument-blocked: selector unreachable via keyboard Tab within 25 presses: .chq-cfp-step-next)
```

Desktop, public-mobile, admin-mobile, font-floor, type-role passes: zero FAIL
rows (all summary lines above are N/N).

## The six questions

**(i) `/admin/submissions/forms` clip row — GONE.** Desktop pass row is a
clean `PASS` with no clip annotation:
```
/admin/submissions/forms                                                        organizer  PASS
```
(log line 5850). Grepping the full 6285-line log for the offender's own
class name (`chq-forms-header-titles`) or any `clip=` annotation on this
route returns zero hits. DEC-991's wave-27 amendment landed and holds at
this tip; no clip px to report because none was measured.

**(ii) `/portal/tasks` public-mobile overflow — GONE.**
```
/portal/tasks                                                0             44  PASS
```
(log line 5937, `mobile pass (390x844)` section). `overflowPx` is `0`.

**(iii) `/admin/submissions` mobile search input tap-target — clears the 44px
floor.**
```
/admin/submissions                                                                       0             44  PASS
```
(log line 5947, `admin mobile pass (390x844, advisory)` section).
`minControlPx` reads `44`, at the floor, not under it — PASS.

**(iv) `cfp-primary-focus` — still FAIL, now for a real reason.** The probe
was rewritten (task-w25-e) to do a genuine `page.keyboard.press("Tab")` walk
instead of a programmatic `.focus()` call (`scripts/render-sweep.ts:461-467`
comment, `:470-485` `measureFocusState`). This live run is that end-to-end
verification, and the result is:
```
.chq-cfp-step-next  cfp-primary-focus  focus  FAIL  (instrument-blocked: selector unreachable via keyboard Tab within 25 presses: .chq-cfp-step-next)
```
(log line 6182). The rewritten probe itself works as designed (it ran a real
keyboard walk and reported truthfully) but `.chq-cfp-step-next` on
`/submit/<slug>` step 1 is genuinely not reachable via 25 sequential Tab
presses from an unfocused baseline in this seeded state — an open item, not
an instrument defect. Not fixed by this wave (log-only; no product code
touched).

**(v) `review-anonymize-disabled` — mixed: resolves for one visiting role,
not the other.** `INTERACTION_STATE_ENTRIES` has exactly one entry for this
selector, keyed to path `/admin/review/plans/seed_evaluation_plan_0001`
(`scripts/render-sweep.ts:446-455`), and that path is visited twice in the
desktop sweep — once as `organizer` (log line 5864) and once as `reviewer`
(log line 5868) — so `measureInteractionStatesForRoute` runs the probe on
both visits (`scripts/render-sweep.ts:582-606`, no role filter). Result:
```
.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  PASS
.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  FAIL  (instrument-blocked: selector never resolved: .chq-review-field-disabled .chq-review-checkbox-label)
```
(log lines 6180-6181, in visit order organizer-then-reviewer matching the
desktop route table's order). The `waitFor({ state: "attached" })` fix (vs.
the prior unwaited `.count()`) does let the probe correctly resolve and PASS
on the organizer visit — the expected `colorHex: #7D7869,
backgroundColorHex: #DDD8C8` pairing evaluated true (no separate FAIL detail
printed for that row, meaning `evaluateInteractionState` found a match). On
the reviewer visit the element plain does not exist in that role's DOM
(reviewer's plan page renders a different layout without the disabled
anonymize-checkbox label), so the wait times out and it reports
"selector never resolved" — a real state fact (reviewer never sees this
control), not an instrument regression. OPEN ITEM: the probe table (single
`path`-only key) cannot distinguish "role never renders this control" from
"instrument still broken" in its own printed row — worth a role-qualified
entry key in a future wave, not this log-only one.

**(vi) contrast on `/admin/review/plans/seed_evaluation_plan_0001` —
STILL FAILS, ratio improved but not enough.** Prior reading (before
`--chq-disabled` was darkened to `#7D7869`) was ratio 2.43 on
`label.chq-review-checkbox-label`. This run:
```
/admin/review/plans/seed_evaluation_plan_0001  organizer  3.09  FAIL  (contrast below WCAG AA threshold — worst: label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105) bg=rgb(221,216,200))
```
(log line 6129). `rgb(125,120,105)` = `#7D7869` (confirms the ink-token
darkening from `src/views/theme.ts:38` / `app/src/styles.css:30` is live in
this render), and `rgb(221,216,200)` = `#DDD8C8` (the disabled-bg token,
unchanged). Ratio rose from 2.43 to 3.09 but WCAG AA requires 4.5:1 for
normal text (3.09 < 4.5) — still FAIL. This is the same row named at
`docs/verification-log.md:3569-3571`-adjacent history and is a genuinely
open item, not a repaired one.

## KNOWN_CLIP_EXCEPTIONS (scripts/render-sweep.ts:219-225)

```ts
export const KNOWN_CLIP_EXCEPTIONS: Readonly<Record<string, string>> = {
  "/admin/agenda::div.chq-session-card-title": "intentional 3-line -webkit-line-clamp truncation",
};
```

Exactly ONE entry, matching DEC-991's rule (agenda card's deliberate
`-webkit-line-clamp` truncation). No additional entries — no open items from
this section.

## OPEN ITEMS carried by this section (3)

1. `cfp-primary-focus` (question iv): `.chq-cfp-step-next` on
   `/submit/devflow-conf-2027` step 1 is unreachable via 25 sequential Tab
   presses from an unfocused baseline — a real keyboard-navigation gap (or a
   probe-tuning gap; the probe itself now runs a genuine Tab walk so its
   report is trustworthy), not fixed by this log-only wave.
2. `review-anonymize-disabled` reviewer-role row (question v): the probe
   table cannot distinguish "role never renders this control" from
   "instrument broken" — same selector reports PASS as organizer, FAIL as
   reviewer on the identical path.
3. Contrast: 3 FAIL rows remain — `span.chq-participation-menu-caret` on
   `/admin/speakers` and `/admin/speakers/seed_contact_0001` (ratio 1.02,
   unrelated to this wave's six questions) and
   `label.chq-review-checkbox-label` on
   `/admin/review/plans/seed_evaluation_plan_0001` (ratio 3.09, question vi
   — improved from 2.43 but still under the 4.5 AA floor). Because
   `CONTRAST_BLOCKING = true`, these three rows are the sole reason
   `gate:render-sweep` exits 1.
