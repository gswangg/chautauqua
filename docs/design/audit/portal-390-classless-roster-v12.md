# Portal-390 classless-interactive-element roster (task w50-c, DEC-996)

> Companion to `docs/design/audit/public-390-classless-roster-v12.md`
> (task w39-e, DEC-996 wave-39). That doc graded the 17 `src/routes/public/**`
> rows of the w35-h classless-interactive roster and closed with: "the 5
> `src/routes/portal/**` rows remain ungraded, out of this task's scope per
> `v12m-w38-a`/`v12m-w38-f`'s in-flight writes to `src/routes/portal/portal.css.ts`".
> Those two branches no longer exist (field-guide wave-50, DEC-996). This
> doc grades the portal half.

## Portal-row verdicts (task w50-c, DEC-996 wave-50)

The wave-35-h roster listed five `src/routes/portal/**` rows by line number
at sha `1e38e4182` (edit.tsx line 240 input, edit.tsx line 484 select,
tasks/views.tsx line 292 input, line 319 a, line 327 input — the last three
already marked STALE in the public-facing roster doc). Per this task's instruction,
none of the five are re-asserted from that stale coordinate: the population
is **re-derived live** against the current tree using the same
`classlessTagSites` walk (`app/src/phone-tap-target-scan/core.ts`), the
same tag set (`a`, `button`, `input`, `select`, `textarea`), scoped to
`src/routes/portal/**`, with `<input type="hidden">` excluded (inert, no
hit-box, out of population by the roster's own construction — same
discipline the public doc used).

**Live population: 4 classless interactive elements** (the wave-35-h `<a>`
row no longer resolves — confirmed STALE; `tasks/views.tsx` renders no bare
classless anchor today). Verdict grammar (DEC-996 wave-39, unchanged this
wave): **VERIFIED** — an ancestor-scoped selector effective at 390 (top
level or inside a `@media (max-width: <=700px)` block) declares
`min-height >= 44px` plus non-zero horizontal padding, reaching the
element; **EXEMPT** — an executable `tap-floor-exempt:` receipt naming a
checkable companion; **OFFENDER** — nothing reaches it (none found this
wave).

Row shape (drift-proof, per DEC-967 wave-115/citation-form-drift
discipline): every citation below is a bare path immediately followed by a
backtick-quoted literal that appears verbatim anywhere in that file — never
a `path:line` form, so a later edit that shifts the line number never
reddens `citation-form-drift.scan.test.ts` or
`decision-doc-citation.scan.test.ts`. Line numbers, where given, are prose
(no colon binds them to the path) and are informational only.

| File | Line (informational) | Tag | Verdict | Reaching selector / receipt |
|---|---|---|---|---|
| src/routes/portal/edit.tsx`type="checkbox" name="trackIds"` | 259 | input | VERIFIED | src/routes/portal/portal.css.ts`.chq-cfp-option {` — the checkbox's sole parent is `<label class="chq-cfp-option">`, top-level rule (`min-height:46px; padding:0 14px; display:flex; align-items:center`, not gated by any media query, effective at every width including 390) — same shape and same shared-vocabulary class (DEC-696) as the public doc's `label.chq-cfp-option > input` rows; native `<label>` click-delegation makes the label the input's real hit box. The rule also carries a `tap-floor-exempt: composition` receipt naming this exact construct, but the reaching mechanism here is the ancestor selector meeting the VERIFIED clause directly (same grading the public doc gave its analogous rows) |
| src/routes/portal/edit.tsx`id="cp-role" form="chq-portal-edit-form" name="role"` | 503 | select | VERIFIED | src/routes/portal/portal.css.ts`.chq-portal-copresenter-role select {` — two same-selector phone rules inside the terminal `@media (max-width: 700px)` block (v12m-w40-e, DEC-393): `min-height:48px` on one, `display:flex; align-items:center; padding:0 12px` on the other — the same split-rule idiom this codebase uses elsewhere (e.g. `.chq-nav a`, DEC-393 wave-w17-i) so an earlier rule's line stays byte-identical for other citations |
| src/routes/portal/tasks/views.tsx`type="file"` | 295 (first of two `<input type="file">` pickers, inside `<div class="chq-portal-actions">`) | input | VERIFIED | src/routes/portal/portal.css.ts`chq-portal-actions input[type=file],` — inside the terminal `@media (max-width: 700px)` block (v12m-w40-e, DEC-393): `display:flex; align-items:center; min-height:44px; padding:0 12px` |
| src/routes/portal/tasks/views.tsx`type="file"` | 344 (second of two `<input type="file">` pickers, inside `<section aria-label="Uploaded file" class="chq-card">`) | input | VERIFIED | src/routes/portal/portal.css.ts`chq-card input[type=file] {` — same rule as the row above, one comma-joined selector in the same terminal phone block |

**Zero offenders.** All 4 live portal rows resolve VERIFIED — every one was
already reachable by a rule an earlier wave (DEC-696's `.chq-cfp-option`
shared vocabulary, v12m-w40-e's DEC-393 select/file-input floors) built
before this task ran; nothing needed a new phone-media floor this wave. No
CSS changed. This closes the last ungraded half of the population
`public-390-classless-roster-v12.md`'s "Public-row verdicts" section
declared complete on the public side.

`test/portal-390-classless-roster.scan.test.ts` re-derives the population
live (the same `classlessTagSites` walk, scoped to `src/routes/portal/**`)
and pins every verdict above against the live CSS text, so this table
cannot rot silently — the same discipline
`test/public-390-request-verdicts-classless-roster.scan.test.ts` uses for
the public half.
