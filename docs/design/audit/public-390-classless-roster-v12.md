# Public-390 classless-interactive-element roster (task w35-h/w39-e, DEC-996)

> Extracted from `docs/design/audit/public-390-request-verdicts-v12.md`
> (custodian task custodian-docs_design_audit_public_390_request_verdicts_v12_md,
> contention decomposition: that file had been party to 4 merge conflicts).
> This was that file's "Classless-interactive-element roster" section
> (originally lines 134-206) — moved verbatim, no wording or verdict
> changed, no behavior change. `public-390-request-verdicts-v12.md` keeps
> a pointer to this file where the section used to live.

## Classless-interactive-element roster (task w35-h, DEC-996 wave-35)

Measured at sha `1e38e4182` (branch `v12m-w35-h`, off `main`). `app/src/phone-tap-target-ssr-classless-anchor.scan.test.ts`'s `SSR_CLASSLESS_ANCHOR_CEILING` grades a classless `<a>` by walking outward to its nearest ENCLOSING `chq-` token — a live render sweep keying on the ELEMENT's own class reads a different, larger population from the identical markup (wave-35 field-guide finding). This section widens that same walk (`classlessTagSites` in `app/src/phone-tap-target-scan/core.ts`) to every interactive tag — `<a>`, `<button>`, `<input>`, `<select>`, `<textarea>` — declaring no `class`/`className` attribute at all, over `src/routes/public/**` and `src/routes/portal/**`. **This section only makes the population visible; it fixes nothing** (same discipline as the existing per-frame table above, which grades, and this new section, which only rosters).

**Population: 59 classless interactive elements, none reaching any enclosing `chq-` token** (every row below reads `(no enclosing chq- token)` — no CSS rule anywhere in the tree could reach any of them by class selector, so none of these 59 can be VERIFIED, UNVERIFIABLE, or FALSE under `tap-floor-exempt-premise`'s grammar; they are simply invisible to it). 37 of the 59 are `<input type="hidden">` — inert, unrendered, out of the tap-floor population by construction (no visible surface, nothing to tap) — leaving **22 real candidate rows**: 15 `<a>`, 6 visible `<input>` (text/checkbox-shaped, not hidden), 1 `<select>`.

Row shape (wave 40): the File:line column and the Tag column are never
adjacent in citation shape (no bare `path:line` immediately followed by a
backtick quote) — `path:line` sat next to a backtick-quoted `<a>`/`<input>`/
`<select>` and both citation-form-drift.scan.test.ts's LINE_KEYED_CITATION
lens and decision-doc-citation.scan.test.ts's WIDENED_UNRESOLVED_CITATION
lens read that pair as a quoted code receipt, which it never was — a
classification label, not a citation. The line numbers below were measured
at wave-35-h's own sha and are the roster's ORIGINAL evidence coordinate;
several have already drifted under later edits (views.tsx's row now reads a
`<p class="chq-portal-detail">` at that line; the submit-views.tsx rows for
630, 787, 928, 954, 967 and 972 sit inside prose/comment regions today) and
are marked STALE below rather than silently re-asserted as still-accurate.

| File (evidence: line at wave-35-h sha `1e38e4182`) | Tag | Note |
|---|---|---|
| src/routes/portal/edit.tsx (line 240) | input | visible |
| src/routes/portal/edit.tsx (line 484) | select | visible |
| src/routes/portal/tasks/views.tsx (line 292, STALE — now line 294) | input | visible |
| src/routes/portal/tasks/views.tsx (line 319, STALE — no longer resolves) | a | visible |
| src/routes/portal/tasks/views.tsx (line 327, STALE — no longer resolves) | input | visible |
| src/routes/public/agenda-grid.tsx (line 200) | a | visible |
| src/routes/public/agenda-rail.tsx (line 131) | a | visible |
| src/routes/public/agenda-rail.tsx (line 163) | a | visible |
| src/routes/public/sessions.tsx (line 82) | a | visible |
| src/routes/public/shell.tsx (line 259) | a | visible |
| src/routes/public/submit-views.tsx (line 128) | a | visible |
| src/routes/public/submit-views.tsx (line 203) | a | visible |
| src/routes/public/submit-views.tsx (line 205) | a | visible |
| src/routes/public/submit-views.tsx (line 264) | input | visible |
| src/routes/public/submit-views.tsx (line 304) | input | visible |
| src/routes/public/submit-views.tsx (line 348) | input | visible |
| src/routes/public/submit-views.tsx (line 630, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 787, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 928, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 954, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 967, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 972, STALE — no longer resolves) | a | visible |

The remaining 37 (`<input type="hidden">`, every one under `src/routes/portal/{edit,index,profile,shared,tasks/views}.tsx` and `src/routes/public/{agenda-controls,sessions,speakers,submit-views}.tsx`) are listed for completeness but are not candidate defects: an unrendered form field carries no hit-box to floor.

~~Not a fix lane: per this wave's `PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING` and `ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING` field-guide findings, a raw roster like this one is not itself a defect count until each row is individually graded against a real CSS rule (most of these 22 sit inside a parent that DOES carry a class — e.g. `.chq-cfp-links a`, `.chq-portal-actions input` — the walk here only proves the ELEMENT itself carries no class, not that it is unreachable; several may already be grounded the same way this lane's `chq-pub-agenda-day-footer-next` was). A later lane's job is to grade these 22, not this one's.~~ **SUPERSEDED (task w39-e, DEC-996 wave-39 amendment; portal half superseded again by task w51-c, DEC-996 wave-51)** — the public half of these 22 (the 17 `src/routes/public/**` rows below) is graded in "Public-row verdicts"; the portal half (the 5 `src/routes/portal/**` rows) is graded below that, in "Portal-row verdicts".

### Public-row verdicts (task w39-e, DEC-996 wave-39 amendment)

Re-derived against the current tree (`v12m-w39-e`, off `main`) rather than trusted at the sha-`1e38e4182` line numbers above — two of the original nine `submit-views.tsx` anchors have since gained their own class token and dropped out of the classless population entirely (noted below); every other row's line number is unchanged. Verdict grammar (DEC-996 wave-39): **VERIFIED** — an ancestor-scoped selector effective at 390 (top-level or inside a `@media (max-width: <=700px)` block) declares `min-height >= 44px` plus non-zero horizontal padding, reaching the element; **EXEMPT** — an executable `tap-floor-exempt:` receipt naming a checkable companion; **OFFENDER** — nothing reaches it (none found this wave — see below). `test/public-390-request-verdicts-classless-roster.scan.test.ts` re-derives the population live (the same `classlessTagSites` walk this section's header names, scoped to `src/routes/public/**`) and pins every verdict below against the live CSS text, so this table cannot rot silently.

Citation shape (task w51-c, DEC-967 wave-51 repair): every cell below uses the row-shape prose form this doc's own header names (File location in parentheses, Tag as plain unquoted text) and every CSS receipt uses the drift-proof bare-path shape (a bare repo-relative path immediately followed, with no gap, by a backtick-quoted literal that must appear verbatim ANYWHERE in that file — no `:line`) rather than the retired `path:line` + backtick-Tag shape that both citation-form-drift.scan.test.ts and decision-doc-citation.scan.test.ts read as an unresolved quoted receipt.

| File (current line) | Tag | Verdict | Reaching selector / receipt |
|---|---|---|---|
| src/routes/public/agenda-grid.tsx (line 200) | a | VERIFIED | src/routes/public/css/rail.css.ts`.chq-pub-agenda-block-title a` — terminal phone block, min-height 44px + flex-centred + padding 0 4px |
| src/routes/public/agenda-rail.tsx (line 131) | a | VERIFIED | src/routes/public/css/rail.css.ts`.chq-pub-rail-day-row a` — terminal phone block, same floor, shared by RoomsRailSection/TrackHighlightRailSection/DayIndexRailSection |
| src/routes/public/agenda-rail.tsx (line 163) | a | VERIFIED | src/routes/public/css/rail.css.ts`.chq-pub-rail-day-row a` — same rule as above, TrackHighlightRailSection's row shares the identical ancestor class |
| src/routes/public/sessions.tsx (line 82) | a | VERIFIED | src/routes/public/css/rail.css.ts`.chq-pub-rail-day-row a` — same rule, DayIndexRailSection's row |
| src/routes/public/shell.tsx (line 236) | a | VERIFIED | src/views/theme.ts`.chq-nav a` — terminal phone block, min-height 44px plus padding-inline restated on a second same-selector rule (DEC-393 wave-w17-i) |
| src/routes/public/submit-views.tsx (line 129) | a | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-links a` — terminal phone block, min-height 44px + display flex + padding 0 2px; the CFP-closed dead-end's "Browse the sessions" link |
| src/routes/public/submit-views.tsx (line 204) | a | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-links a` — same rule, last-year branch |
| src/routes/public/submit-views.tsx (line 206) | a | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-links a` — same rule, else branch |
| src/routes/public/submit-views.tsx (line 264) | input | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-option` — label.chq-cfp-option, the immediate parent, min-height 46px + padding 0 14px, top-level (effective at every width including 390); native label click-delegation makes the label the input's real hit box |
| src/routes/public/submit-views.tsx (line 304) | input | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-option` — same rule |
| src/routes/public/submit-views.tsx (line 348) | input | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-option.chq-cfp-pill` — same base rule plus the pill variant's terminal-phone-block min-height 44px restatement |
| src/routes/public/submit-views.tsx (line 641, originally 630) | a | **DRIFTED, EXEMPT** | No longer classless — now carries class="chq-cfp-intro-cta-link". EXEMPT via src/routes/public/cfp.css.ts`.chq-cfp-intro-cta-link, .chq-cfp-identity-note-link {}`, an empty-rule receipt, a rung-3 DEVIATIONS ground per DEC-393 wave-35's own amendment (neither the desktop nor 390 "Submit a talk" frame extent draws this as a control, and no same-surface floored twin reaches #chq-cfp-submit-form) |
| src/routes/public/submit-views.tsx (line 807, originally 787) | a | **DRIFTED, EXEMPT** | No longer classless — now carries class="chq-cfp-identity-note-link". Same receipt as above, same rung-3 ground (destination /login) |
| src/routes/public/submit-views.tsx (line 965, originally 928) | a | EXEMPT | src/routes/public/cfp.css.ts`.chq-cfp-confirm-actions a:not(.chq-btn)` — inline-in-prose receipt (DEC-393 wave-142): "Already have a password? Log in ›" is a phrase inside one running sentence, not a standalone row |
| src/routes/public/submit-views.tsx (line 1001, originally 954) | a | EXEMPT | Same receipt as above — the confirmation page's other branch renders the identical phrase |
| src/routes/public/submit-views.tsx (line 1014, originally 967) | a | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-links a` — same rule as line 129, the fresh-confirmation tail-links row shares the class |
| src/routes/public/submit-views.tsx (line 1019, originally 972) | a | VERIFIED | src/routes/public/cfp.css.ts`.chq-cfp-links a` — same rule |

**Zero offenders.** All 17 public rows resolve VERIFIED or EXEMPT — every one was already reachable by a rule an earlier wave (w17-d/w14-dd/w17-i/w35-b) built for an ancestor or sibling this roster's element-only walk never cross-referenced; nothing needed a new phone-media floor this wave. No CSS changed.

### Portal-row verdicts (task w51-c, DEC-996 wave-51)

The header's earlier deferral read "the 5 portal rows are out of this task's scope — v12m-w38-a/v12m-w38-f are both writing src/routes/portal/portal.css.ts". Verified this wave (`git branch -a | grep w38` at sha `a28a66cf9`, and again at this task's own worktree HEAD): **neither branch exists.** That deferral is retired.

Re-derived live (never transcribed from the sha-`1e38e4182` line numbers above, several of which are already marked STALE) with `classlessTagSites` — the same walk `app/src/phone-tap-target-scan/core.ts` exports and the public half above uses — scoped to `src/routes/portal/**`, `<input type="hidden">` dropped as before. The live population is 4 rows, not 5: one of the original two `src/routes/portal/tasks/views.tsx` anchors (originally line 319) has since gained its own class token (chq-portal-file-link, DEC-996 wave-35, named in-file where it renders) and dropped out of the classless population entirely, the same drift two `submit-views.tsx` rows underwent in the public half above. `test/public-390-request-verdicts-classless-roster.scan.test.ts` re-derives this population live and pins every verdict below against the live CSS text, exactly as it already does for the 17 public rows.

Same verdict grammar as the public half (DEC-996 wave-39, unchanged): VERIFIED — an ancestor-scoped selector effective at 390 (top-level or inside a @media (max-width: <=700px) block) declares min-height >= 44px plus non-zero horizontal padding, reaching the element; EXEMPT — an executable tap-floor-exempt: receipt naming a checkable companion; OFFENDER — nothing reaches it (none found this wave).

| File (current line) | Tag | Verdict | Reaching selector / receipt |
|---|---|---|---|
| src/routes/portal/edit.tsx (line 259) | input | VERIFIED | src/routes/portal/portal.css.ts`.chq-cfp-option {` — the checkbox's immediate parent is label.chq-cfp-option (edit.tsx's Tracks fieldset renders every trackIds checkbox as the sole child of this exact wrapper); the rule is top-level (effective at every width including 390), min-height 46px + padding 0 14px, and carries its own tap-floor-exempt: composition receipt naming this same construction |
| src/routes/portal/edit.tsx (line 503) | select | VERIFIED | src/routes/portal/portal.css.ts`.chq-portal-copresenter-role select {` — the select's immediate ancestor div carries chq-field and chq-portal-copresenter-role; this selector (terminal phone block) declares display flex + align-items center + padding 0 12px, and the sibling rule `.chq-portal-copresenter-role select` at the same block declares min-height 48px (v12m-w40-e, DEC-393 — added because a class-token-keyed scan cannot see a bare, classless select) |
| src/routes/portal/tasks/views.tsx (line 295, in the task-upload form) | input | VERIFIED | src/routes/portal/portal.css.ts`.chq-portal-actions input[type=file],` — the file input's enclosing div carries chq-portal-actions; terminal phone block, min-height 44px + display flex + align-items center + padding 0 12px (v12m-w40-e, DEC-393 — additive, phone-only floor reaching the bare `<input type="file">` by its enclosing token) |
| src/routes/portal/tasks/views.tsx (line 344, in the completed-task reupload form) | input | VERIFIED | src/routes/portal/portal.css.ts`.chq-card input[type=file] {` — the file input's enclosing section carries chq-card; same terminal-phone-block rule as above, its second selector |

**Zero offenders.** All 4 portal rows resolve VERIFIED — every one was already reachable by a rule an earlier wave (DEC-696/v12m-w40-e) built for the enclosing wrapper this roster's element-only walk never cross-referenced against; nothing needed a new phone-media floor this wave, and `src/routes/portal/portal.css.ts` was not edited.
