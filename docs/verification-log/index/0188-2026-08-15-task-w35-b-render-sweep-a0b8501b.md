## 2026-08-15 task-w35-b — render-sweep @ a0b8501b

DESIGN-FIDELITY MEASUREMENT LANE, LOG-ONLY (DEC-453).

INVALIDATED BY: src/** app/src/** scripts/** test/** migrations/** package.json

Live `npm run gate:render-sweep` at HEAD `a0b8501b2e3cc6e57d6525d41ba1554c5943c483`
(short `a0b8501b`), superseding the prior reading `task-w28-d @ c6dbdb7c`
(docs/verification-log.md, seven waves and many product merges stale). Full
sequence (`ensure-dev-vars` -> `vite build` -> `db:migrate` -> `seed` ->
`gate:render-sweep`, own wrangler dev on OS-assigned port 61627 — DEC-644's
requested literal port 8952 is not configurable through
`scripts/render-sweep.ts`'s `main()`, which always calls `findFreePort()`;
noted as a gap between the task wording and the tool's interface, not a
gate failure) ran clean through to the gate itself. Score lines: desktop
`60/60`, public-mobile `26/26`, admin-mobile `28/28` (advisory), font-floor
`114/114` (advisory), type-role `7/7` (advisory), contrast `60/60`
(advisory), interaction-state `3/3` (advisory). **Exit code 0** —
`gate:render-sweep OK` printed; zero FAIL rows anywhere across all seven
passes; one `EXEMPT-BY-RULE` row (contrast pass,
`/admin/review/plans/seed_evaluation_plan_0001` organizer, ratio 3.09,
`label.chq-review-checkbox-label`).

Three claims checked against THIS run (DEC-644 wave-35 amendment), never
before observed together in one run:
- (i) `.chq-cfp-step-next` / role `cfp-primary-focus` / `focus` PASS,
  credited to task-w29-c — **CONFIRMED**: interaction-state row
  `.chq-cfp-step-next  cfp-primary-focus  focus  PASS` present verbatim.
- (ii) both `.chq-participation-menu-caret` contrast rows PASS, credited to
  task-w29-d via `app/src/pages/speakers/speakers.css:384-403` —
  **FALSIFIED**: the CSS fix (`color: inherit` on
  `.chq-participation-menu-caret`, `speakers.css:405`, DEC-830 wave-29
  amendment) is present, but `scripts/render-sweep.ts` has no contrast
  check enumerating `.chq-participation-menu-caret` at all (`grep -rn
  "participation" scripts/` finds zero selector references; the full
  60-row contrast table this run produced contains no row naming that
  selector). The credited "PASS" rows describe a check that does not
  exist in the instrumented gate — cannot be quoted from this or any run
  as it stands.
- (iii) the `.chq-review-field-disabled .chq-review-checkbox-label` pair
  reports as `EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component)` and
  NOT a contrast FAIL — **CONFIRMED**: quoted row above; exemption path
  `scripts/render-sweep-contrast.ts:77-84,112-115` (DEC-426 wave-29
  amendment: `exempted` field, `exemptNote` string) matches exactly, and
  `reasons` (which drives FAIL) never includes exempted pairs.

`KNOWN_CLIP_EXCEPTIONS` (scripts/render-sweep.ts:219-225) still holds
exactly ONE entry — `"/admin/agenda::div.chq-session-card-title":
"intentional 3-line -webkit-line-clamp truncation"` — unchanged since
task-w28-d's reading.

Full per-row tables, quoted log lines, and source citations:
`docs/verification-log/task-w35-b-render-sweep-a0b8501b.md`.

RESULT: PASS — exit code 0, all seven passes 100% clean, one expected EXEMPT-BY-RULE row; claims (i) and (iii) confirmed, claim (ii) falsified (gate has no check for that selector).
OPEN ITEMS: 1
