# Phone drawn-floor divergence (DEC-393 wave-147 amendment)

Measured on branch `v12m-w7-da` by `test/frame-control-floor.scan.test.ts`, forcing `FRAME_FLOOR_DIVERGENCE_CEILING` to `-1` and reading the printed offender list back. Population: 235 drawn phone controls across all 13 `docs/design/*.dc.html` files. `FRAME_FLOOR_DIVERGENCE_CEILING` is `0`.

## Wave 25 (DEC-393 amendment, task w25-b): the union join, ported from desktop

Wave 22's ambiguity-honest join (DEC-995) fixed a real mis-attribution risk but at a steep cost: any label whose several rendering sites disagreed on `chq-` token set graded `ambiguous-source-match` and fell permanently into UNRESOLVED, with no ceiling giving any signal over that bucket. Measured before this wave: 33 of 235 drawn controls (14%) resolved to anything at all; 202 were UNRESOLVED, 60 of them specifically `ambiguous-source-match`.

`test/desktop-control-floor.scan.test.ts` had already solved the underlying problem for the desktop half of the pack (its own wave-156/157 amendments): the reason the wave-22 join needed an ambiguity gate at all was that it kept only the FIRST occurrence per source blob and CONTAINS-matched the label, so a wrong first-hit site could silently mis-credit a row. The fix is not "refuse to grade a label with more than one rendering site" -- it is to find **every** site whose own text content **is** the label exactly (never a substring, never an aria-label/placeholder), and **union** their class tokens into one row. A label genuinely rendered in two different places by two different components is not ambiguous; it is one drawn control whose token set is the union of every element that truly renders it.

This wave ports that join onto the phone file:

- `ownTextEquals(label, blob, idx)` -- the enclosing tag's OWN text node (nearest preceding `>` to next `<`, whitespace-collapsed) must equal the label exactly.
- `allBoundaryMatches(label, blob)` -- every boundary-anchored occurrence of a label in a blob, not just the first.
- `classTokensNear(blob, idx)` -- the `chq-` tokens of the tag enclosing a surviving position, rejecting a position that lands inside an as-yet-unclosed tag's own attribute value.
- The union grade: tokens are collected across every own-text-equal position in every corpus blob, deduplicated, then resolved together. A row grades `no-label-match` (no own-text-equal position anywhere), `no-token` (a position exists but no `chq-` class), `no-rule` (every token has no CSS rule at all, top-level or `@media(max-width)`), `no-control-shape` (a rule exists but no resolved token is itself CONTROL-SHAPED -- declares its own `border:`/`background:`/`padding-inline:`/`min-height:`, excluding a bare `none`/`transparent`/`0`/`0px` reset), or `resolved` (graded OFFENDER iff the maximum declared min-height across every qualifying rule and token is strictly below the control's own drawn floor).

Because the source corpus needed to switch from the wave-22 join's whitespace-preserving flat-tag-pair walk to `ownTextEquals`'s whitespace-collapsed boundary search, the file now shares `normalizeSource` (comment-stripped, entity-decoded, whitespace-collapsed) with the desktop half and every other frame-source-corpus consumer, rather than its own `decodeEntitiesKeepingStructure` copy. The wave-22 `LABEL_SITES`/`AMBIGUOUS_LABELS`/`ambiguous-source-match`/`AMBIGUOUS_COUNT_TRIPWIRE` machinery is retired entirely -- there is no "sites disagree" state left to gate on. The CSS-rule corpus (`ALL_CSS_RULES`, admitting both top-level and `@media(max-width)` rules per DEC-385/DEC-393 wave-94) is unchanged; only the join upstream of it and a new control-shape corroboration downstream of it are new.

**MEASURED (this branch, ceilings forced to -1, printed lists read back):**

- **0 offenders** (unchanged from every prior wave -- 235 drawn controls, none whose resolved token declares below its own frame's drawn floor).
- **109 unresolved** (down from 202 pre-wave-25, a **90-row net gain** in the graded population: 33 → 123 resolved-and-conforming, all OK): **97 `no-label-match`**, **4 `no-token`**, **11 `no-control-shape`**. `no-rule` measured 0. (Corrected wave-26: this section previously said "112 unresolved" / `UNRESOLVED_COUNT_TRIPWIRE = 112` -- internally stale against the tree and against this same document's own later WAVE 23 section, both of which already said 109; this was the wave-25 union join's OWN measured count, unrelated to wave-23's later composed-tier repair.)
- `UNRESOLVED_COUNT_TRIPWIRE = 109` as measured this wave; `FRAME_FLOOR_DIVERGENCE_CEILING = 0` (unchanged). (Lowered again to 106 by wave-26's attribute tier, see below.)

The two previously-"Proven" rows (see below) both now resolve honestly through the union join without any special-casing.

### `no-control-shape` (11 rows): a resolved token whose own rule paints no control face

These 11 rows have a real, unambiguous own-text-equal match and a real `chq-` class token, but every rule mentioning that token declares typography (font-size/letter-spacing/color/etc.) only -- no border, background, padding-inline, or min-height of its own. Grading these OFFENDER at a declared height of 0 would assert a control-floor gap on a heading or field-name eyebrow that is not actually a tap target:

- **"See the recipients"** -- Chautauqua Comms.dc.html:350, token `chq-comms-batch-toggle-label-phone`.
- **"Merge them"** -- Chautauqua Contacts.dc.html:537, token `chq-contacts-merge-primary-phone-label`.
- **"Upload a file for the speaker"** -- Chautauqua Content.dc.html:417, token `chq-content-upload-prompt-phone`.
- **"First name"** -- Chautauqua Public and Portal.dc.html:645, token `chq-portal-field-label`.
- **"Last name"** -- Chautauqua Public and Portal.dc.html:649, same token.
- **"Bio"** -- Chautauqua Settings.dc.html:523, same token.
- **"Links"** -- Chautauqua Settings.dc.html:525, token `chq-contacts-record-label`.
- **"Title"** -- Chautauqua Settings.dc.html:526, tokens `chq-submissions-col-title`, `chq-portal-field-label`.
- **"Abstract"** -- Chautauqua Settings.dc.html:527, tokens `chq-section-label`, `chq-detail-section-title`, `chq-detail-section-title-frameless`.
- **"Needs triage"** -- Chautauqua Submissions.dc.html:149, token `chq-submissions-status-pending-phone`.
- **"Wait"** -- Chautauqua Submissions.dc.html:391, token `chq-detail-back-short`.

### `no-token` (4 rows): an own-text-equal match with no `chq-` class

- **"Browse the sessions ›"** -- Chautauqua Account.dc.html:141 and Chautauqua Public and Portal.dc.html:1092 (both instances of the same label).
- **"+ Rule"** -- Chautauqua Contacts.dc.html:192.
- **"Log in ›"** -- Chautauqua Public and Portal.dc.html:1135.

### `no-label-match` (97 rows)

The largest bucket, unchanged in kind from every prior wave: a label composed at render (a shared helper, a live count, a template literal such as the admin tabbar's `{{ t.label }}` row, already excluded upstream), or one this scan's exact own-text-equality standard cannot resolve to a single source element. Not itemised here (97 rows); available by re-running the file with `FRAME_FLOOR_DIVERGENCE_CEILING`/`UNRESOLVED_COUNT_TRIPWIRE` forced to `-1` and reading the printed reason breakdown, exactly as this wave measured it.

## Proven (unambiguous, resolved by the union join)

1. **"‹ Previous"** -- docs/design/Chautauqua Docs.dc.html:201 draws `min-height:46px`. Resolves to token `chq-detail-position-prev`, declared `min-height:46px` (a `@media(max-width:700px)` rule scoped inside `.chq-detail-layout`, `app/src/pages/submissions/detail.css`). Conforming.
2. **"Next ›"** -- docs/design/Chautauqua Docs.dc.html:202 draws `min-height:46px`. Resolves to tokens `chq-btn`, `chq-btn-tertiary`, `chq-detail-position-next`; the union's maximum declared height is 50px (`chq-btn`/`chq-btn-tertiary`'s own rule). Conforming.

## Retired: wave-22's ambiguity gate

Wave 22 (DEC-995) introduced `LABEL_SITES`/`AMBIGUOUS_LABELS`/the `ambiguous-source-match` reason/`AMBIGUOUS_COUNT_TRIPWIRE` to stop a first-occurrence-wins join from silently crediting the wrong site's tokens to a label rendered in more than one place. That fix was honest but not a measurement: it moved 60 of 235 drawn controls (26%) into a bucket with no ceiling and no path back to resolution. This wave's union join (ported from the desktop half, which had already solved the identical problem the same way) supersedes it: every genuinely own-text-equal site legitimately renders the label, so there is no "disagreement" left to gate on, only a token set to union. All four wave-22 constructs are removed from `test/frame-control-floor.scan.test.ts`; this document's prior "## Wave-22 correction" and "## Now AMBIGUOUS" sections (5 rows previously described as ambiguous: "Sign in", two "Edit" rows, two "Download .ics" rows) are superseded by the measurement above -- none of those five specific rows land in `no-control-shape`/`no-token` this wave, meaning the union join now resolves each of them to a real, control-shaped, conforming token (folded into the 123 resolved-and-conforming rows counted above) rather than leaving them unresolved.

## Wave 23 (DEC-393 amendment, task w23-g): the composed-label tier

Both this file and the desktop sibling named the same dominant unresolved bucket in their own prose: a label composed at render (a shared copy helper, a live count, a template literal) can never satisfy an own-text-EXACT join, because the rendered text is never byte-identical to the frame's drawn label -- only PART of it is fixed, the rest is filled by live data. This wave adds exactly ONE new resolution tier, implemented once in `test/helpers/composed-label-resolve.ts` and shared byte-for-byte with `test/desktop-control-floor.scan.test.ts` (DEC-613: never two copies of one join), consulted ONLY when the own-text tier above finds no match at all.

The tier: every exported string-returning helper directly under `src/domain` (files matching `*-copy.ts`) and `app/src/lib` (files matching `*-vocabulary.ts`) is discovered via `readdirSync` (never a hand-listed helper name, per DEC-180/808 -- "a hand-listed population is not a population"). Each helper's body is scanned for a bare `return \`...\`;` statement whose template literal carries at least one `${...}` hole; that template is decomposed into its FIXED text segments (the literal text around each hole). A drawn label MATCHES a template when its fixed segments occur in the label in order, with the template's own opening/closing literal text (when present) anchored to the label's start/end respectively -- e.g. `conflictMoveLabel`'s `` `Move ${ref} to ${clockHMM(startMin)}` `` matches "Move DFC-047 to 11:30" because "Move " opens the label and " to " follows it, with no closing anchor required (the template itself ends on a hole). Templates whose only non-empty segment is shorter than 3 characters are excluded as too weak to disambiguate (e.g. `countOf`'s lone `" "` joiner would otherwise "match" almost any two-word label).

**Honesty clauses (non-negotiable):** a row resolves through this tier only when its label matches EXACTLY ONE helper (two helpers matching the same label leaves the row `no-label-match`, unresolved) AND that one helper has EXACTLY ONE call site anywhere in the corpus whose enclosing tag's own text is nothing but that call expression (`{helperName(...)}`, no concatenation, no sibling text) -- two call sites is ALSO left unresolved, deliberately NOT unioned the way the own-text tier unions multiple genuine render sites of a literal label (a composed call's ARGUMENTS differ per call site, so two call sites only prove the same helper is invoked twice, never that the same control renders it). A resolved token set is still run through this file's existing control-shape corroboration before it can grade OFFENDER -- this tier only ever resolves a token set or returns nothing; it never grades a row itself.

**MEASURED (this branch, forcing `UNRESOLVED_COUNT_TRIPWIRE` to -1 before and after adding the tier):**

- PRE-WIDENING (own-text tier alone, matching the current tree's own state): 111 unresolved.
- POST-WIDENING (own-text + composed tiers): **109 unresolved** -- 2 rows newly resolved, both **OK, zero new offenders**:
  - **"Move DFC-047 to 11:30"** -- docs/design/Chautauqua Agenda.dc.html:171 (frame "Auto-schedule", drawn `min-height:44px`). Matches `src/domain/schedule-copy.ts`'s `conflictMoveLabel` (`` `Move ${ref} to ${clockHMM(startMin)}` ``); its ONE own-text call site is `app/src/pages/agenda/PhoneAgenda.tsx`'s clash-card resolution button, `` `<button className="chq-phone-slot-clash-move" ...>{conflictMoveLabel(move.ref, move.startMin)}</button>` ``. Resolves to token `chq-phone-slot-clash-move`, declared `min-height:44px`, exactly meeting the drawn 44px floor.
  - **"Move DFC-047 to 11:30"** (again) -- docs/design/Chautauqua Overview.dc.html:276 (frame "Overview", drawn `min-height:44px`). Same helper, same single call site (Overview's own worklist renders `conflict.resolution.label`, a server-computed string, never a direct `conflictMoveLabel(...)` call, so PhoneAgenda's button remains the corpus's ONE own-text call site) -- resolves to the same token, same 44px, exactly meeting this frame's own 44px floor too.
- `FRAME_FLOOR_DIVERGENCE_CEILING` stays **0** -- unchanged.
- `UNRESOLVED_COUNT_TRIPWIRE` lowered **111 -> 109** in the same commit.

No product CSS byte changed this wave: both newly-resolved rows already conform.

## Not offenders (UNRESOLVED, 109 of 235, pre-wave-26)

The UNRESOLVED population is now split into three dispositions instead of the prior wave's four: `no-label-match` (97), `no-token` (4), `no-control-shape` (11) -- itemised above -- plus `no-rule` (0, measured). None of these 109 rows is a claim this document makes: `frame-control-label.scan.test.ts` already grades whether the app renders the WORDS; this ledger only grades the HEIGHT of a control this scan could positively resolve to a real, control-shaped source token.

## Wave 26 (DEC-995 amendment, task w26-b): the attribute/prop label tier, ported from desktop

`test/desktop-control-floor.scan.test.ts` had already solved a second class of label-resolution miss for the desktop half (its own WAVE 28, DEC-393 + DEC-808 amendment): a control whose visible label is carried by an `aria-label`/`placeholder`/`title`/`label` attribute rather than by its own text node (a search input, an icon-only field) can never satisfy the own-text tier's "enclosing tag's text node IS the label" test, because that control has no text node at all. This wave ports that same tier onto the phone file, unchanged in grammar and code (`SOURCE_OPEN_TAG_RE`, `ATTR_LABEL_VALUE_RE`, `classTokensInOpenTag`, `attributeLabelTokensInBlob`): an opening tag whose `label`/`aria-label`/`placeholder`/`title` attribute value equals the drawn label exactly, AND which also carries `chq-` tokens in its own `class=`/`className=` attribute ON THE SAME OPENING TAG, contributes those tokens to the row. Consulted ONLY when the own-text tier above finds no match at all, and placed BEFORE the composed tier so this file's tier order (own-text → attribute → composed) now matches the desktop file's exactly.

**MEASURED (this branch, forcing `UNRESOLVED_COUNT_TRIPWIRE` to -1 before and after adding the tier):**

- PRE-WIDENING (own-text + composed tiers, matching the current tree's own state): 109 unresolved.
- POST-WIDENING (own-text + attribute + composed tiers): **106 unresolved** -- 4 rows newly matched by the attribute tier, 3 of them newly `resolved`:
  - **"you@example.com"** -- docs/design/Chautauqua Account.dc.html:130 (frame "Sign in", drawn `min-height:50px`). Matches `src/routes/auth-views.tsx`'s email `<input placeholder="you@example.com" className={... ? "chq-input chq-field-invalid" : "chq-input"} .../>`. Tokens `chq-input`, `chq-field-invalid`; PRE-FIX resolved height 48px (the union join's max declared min-height across every corpus rule mentioning either token was an unrelated 48px `.chq-input` rule in `app/src/pages/comms/templates.css`/`app/src/pages/review/review.css`, not the page's own rule) -- an OFFENDER (48px < 50px drawn). **FIXED**: `src/routes/auth.css.ts`'s existing phone-only (`@media (max-width:700px)`) 50px rule for `.chq-auth-card input[type=email], input[type=password]` gained a third selector, `.chq-auth-card .chq-input`, at the same 50px (desktop untouched, DEC-385) -- POST-FIX resolved height 50px, exactly meeting the drawn floor. Conforming.
  - **"Search name, email or company…"** -- docs/design/Chautauqua Contacts.dc.html:186 (drawn `min-height:44px`). Matches an `<input placeholder="Search name, email or company…" className="chq-input chq-contacts-search" .../>`. Resolves to a maximum declared height of 50px (via the same union-of-all-`chq-input`-rules mechanism, now including auth.css.ts's widened rule). Conforming, no fix needed (44px drawn floor already met before this wave's fix).
  - **"Search title or speaker…"** -- docs/design/Chautauqua Submissions.dc.html:147 (drawn `min-height:44px`). Same shape, tokens `chq-input`, `chq-submissions-filterbar-search`. Resolves to 50px. Conforming, no fix needed.
  - **"Headshot"** -- docs/design/Chautauqua Settings.dc.html:524 (drawn `min-height:44px`). Matches a `<div title="Headshot" className="chq-section chq-portal-profile-head">` (or similar) wrapper. Tokens `chq-section`, `chq-portal-profile-head`; neither token's own rule declares a border/background/padding-inline/min-height of its own -- stays **UNRESOLVED** under `no-control-shape` (a section wrapper carrying a `title` attribute for accessibility, not a control face). Net effect on the UNRESOLVED bucket: this row's `reason` moves from `no-label-match` to `no-control-shape`, still counted as unresolved.
- `FRAME_FLOOR_DIVERGENCE_CEILING` stays **0** -- the one newly-discovered offender was fixed in the same commit, not carried forward.
- `UNRESOLVED_COUNT_TRIPWIRE` lowered **109 -> 106** in the same commit.

One product CSS byte changed this wave (the added `.chq-auth-card .chq-input` selector in `src/routes/auth.css.ts`'s existing terminal `@media (max-width:700px)` block) -- a single additional selector on an already-50px phone-only rule, desktop byte-identical per DEC-385.

## WAVE 31 (DEC-808 wave-31 amendment, task w31-b): digit-collapsed skeleton join, ported and shared; composed-vs-not-drawn split for the `no-label-match` residue

Measured on branch `v12m-w31-b`, main at `1958e491c`, by `test/frame-control-floor.scan.test.ts`, forcing both `FRAME_FLOOR_DIVERGENCE_CEILING` and `UNRESOLVED_COUNT_TRIPWIRE` to `-1` and reading the printed offender list / reason breakdown back. Commands run: `npx vitest run frame-control-floor desktop-control-floor campaign-ratchet` (46 tests, 0 red) and `npx vitest run campaign-ratchet-two-sided campaign-ratchet-registration` (14 tests, 0 red -- both ceilings were already registered in `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE`, unchanged this wave).

**Starting population (pre-wave, wave-26 state): 106 UNRESOLVED (97 `no-label-match`, 4 `no-token`, 11 `no-control-shape`, later re-measured at 12 -- see below), 0 offenders.**

### 1. The join's ONE shared home

`test/skeleton-join.ts` (new) is the ONE home for the digit-collapsed skeleton join technique (DEC-613; DEC-808's wave-29 amendment ruled the technique, built for the desktop half only on the unlanded branch `v12m-w29-e`). At this wave's start, `v12m-w29-e` had **not** landed on main (`git rev-list --count HEAD..v12m-w29-e` = 1, `git merge-base --is-ancestor v12m-w29-e HEAD` false) -- confirmed by running `git log --oneline -25` and checking `git show-ref` before writing anything. Per the task's own instruction, the module was written fresh with a header comment naming `test/desktop-control-floor.scan.test.ts` as the file that must delete its own private copy and import from this module when `v12m-w29-e` lands. `test/skeleton-join.ts` exports `collapseDigitsToSkeleton`, `buildSkeletonBlobs`, `skeletonOwnTextTokens` (the join itself, taking the caller's own `allBoundaryMatches`/`ownTextEquals`/`classTokensNear` as parameters -- ported, never imported, per every ledger file's own "PORTING NOTE" precedent, since importing a sibling `*.test.ts` would double-register its `describe`/`it` calls), plus two composed-vs-data classifiers (`labelIsComposedLiteral`, `looksLikeDataValue`, both ported from the same unlanded branch) and one NEW wave-31 helper, `labelIsComposedWithKnownAffix` (strips a trailing live-count-badge suffix, `· N`, or a leading chevron-breadcrumb prefix, `‹ `, and re-tests the residual as a composed literal -- two shapes that recur across this pack and that neither of the ported classifiers alone can see, since the drawn label is never a byte-identical single string in source).

`test/frame-control-floor.scan.test.ts` imports all five from `test/skeleton-join.ts` and adds a skeleton tier to `gradeControl`, consulted only when own-text, attribute, and composed all fail -- **MEASURED: the skeleton tier resolves 0 of the 106 rows.** Every digit-bearing label in this population (e.g. "16 Aug 2026, 23:59", "Unscheduled 6", "All 47") is composed from a runtime value with **no digit literal anywhere in source** (a count variable, a `Date.now()`-derived string, a live roster size) -- there is no static digit in the template for the skeleton to collapse against, unlike DEC-808's own motivating example ("24 months" from a literal `${months} months` template where SOME call site names a literal 24). This is a real, negative, machine-measured finding, not an omission: the technique is correctly wired and correctly finds nothing to resolve in this half of the pack.

### 2. Composed-unseen vs not-drawn: the new disposition

Every row that still carries no match after own-text + attribute + composed + skeleton is graded through two automatic classifiers plus two small hand-verified tables (all new this wave, in `test/frame-control-floor.scan.test.ts`):

- `labelIsComposedLiteral` / `looksLikeDataValue` / `labelIsComposedWithKnownAffix` (from `test/skeleton-join.ts`) -- pattern-based, no per-row judgment.
- `HAND_VERIFIED_COMPOSED` (new local table, 15 entries) -- rows the automatic passes cannot classify on pattern alone, each backed by a real citation to the rendering source (mirrors the unlanded desktop branch's own `HAND_VERIFIED_COMPOSED` idiom; kept as a **separate** table per DEC-613's own scoping -- "one join, not two tables").
- `NOT_ACTUALLY_COMPOSED` (new local denylist, 1 entry) -- the inverse mistake: `labelIsComposedLiteral` fires on a developer's own CSS-in-JS documentation comment that happens to quote the frame's word in matching quote characters (`src/routes/public/cfp.css.ts`'s `/* ... "Draft" ... */` block -- a `.css.ts` file's block comment is STRING CONTENT of the tagged template, not JS syntax, so `frame-source-corpus.ts`'s `stripComments` correctly leaves it standing; this is the field guide's own named trap, "a comment quoting a frame literal", one register further down than the campaign has seen it before). Checked FIRST, before the composed classifiers run, so it always wins.

A row still unclassified after all of the above grades `not-drawn` and is an OFFENDER (effective declared height 0) -- phone is not frozen, so a label with **zero** trace anywhere in the corpus is a real, repairable divergence, not a measurement gap.

**MEASURED (this branch, both ceilings forced to -1, printed lists/breakdown read back): 1 offender, 105 unresolved (89 `composed-unseen`, 4 `no-token`, 12 `no-control-shape`).**

### 3. The one offender: `FRAME_FLOOR_DIVERGENCE_CEILING` raised 0 -> 1 (heading names this instrument's own ratchet-constant, DEC-099 wave-34 clause (b) population artifact, adjudicated in place)

- **"Draft"** -- `Chautauqua Public and Portal.dc.html`:1063 (drawn `min-height:48px`), frame "Submit a talk" step-1 dock secondary. The real control (`src/routes/public/submit-views.tsx`:746, class `chq-cfp-save-draft`) renders the literal text **"Save draft"**, never bare "Draft" -- confirmed by direct source read, not by the join (the join cannot resolve this row to any token because no element's own text is ever the bare string "Draft"). A genuine, previously-invisible label divergence. Not fixed this wave (test/audit-only scope, zero product bytes moved) -- left for a future wave's repair lane.

### 4. Composed-unseen rows resolved this wave (selected; full list is every `composed-unseen`-reason row printed by forcing `UNRESOLVED_COUNT_TRIPWIRE` to `-1`)

Machine-derivable reason vocabulary used below: **COMPOSED-from-data** (a live record field, e.g. a room name, a plan name, a saved-segment name, a count), **COMPOSED-from-a-constant** (a named constant/template literal with an interpolation hole and no literal digit), **BLESSED SUBSTITUTION / BLESSED OMISSION** (a binding DEC ruling already adjudicates the exact divergence as not-a-defect), **NEAR-MISS, SETTLED** (the app's text differs from the frame's by one already-adjudicated glyph), **COMPOSED via the landed two-node idiom** (a CSS-reveal-one-of-two-sibling-spans construction).

- **"Room 2A CLASH"** / **"Room 2B"** -- Chautauqua Agenda.dc.html:140/142. `app/src/pages/agenda/PhoneAgenda.tsx` renders `{room.name}` (live) plus a separate sibling `<span className="chq-flag">CLASH</span>` when `roomHasConflict(...)` -- own-text extraction concatenates both elements' text, but no single element's own text is ever the joined string.
- **"Slides · 3 versions"** / **"Recording · 1 version"** -- Chautauqua Content.dc.html:386/387. `app/src/pages/content/DeliverableDetail.tsx` renders `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}` (that file's own comment names the shape: "the plain '<kind> · N versions' label").
- **"Remind all three"** -- Chautauqua Overview.dc.html:215. `app/src/pages/Overview.tsx` composes `Remind all {spellCount(...)}` via `src/domain/count-copy.ts` (DEC-919 wave-128 amendment's own prose names this exact row).
- **"Place the other six ›"** -- Chautauqua Overview.dc.html:277. `app/src/pages/overview/AgendaWorkSection.tsx` renders `{agendaOverflowLine(payload)}` (DEC-919 wave-128 amendment).
- **"Mark the release signed"** / **"Upload slides"** -- Chautauqua Public and Portal.dc.html:493/588. `src/routes/portal/tasks/views.tsx`'s `tasksPageDockPrimary`, per its own header comment (DEC-967 wave-106 amendment): the dock primary resolves to "the first NOT-complete assignment's own existing control ... reused rather than duplicated", never literally either frame string, and renders `null` entirely for a `file_request`-kind task -- both a RULED, deliberate divergence.
- **"Talk, 30 min · set by the organisers"** -- Chautauqua Public and Portal.dc.html:620. `src/routes/portal/edit.tsx`:293 renders `{sessionFormatLabel(data.formatLabel)} · set by the organisers` (DEC-777/DEC-041) -- live format vocabulary plus a literal rider, never one string.
- **"Submit another talk"** -- Chautauqua Public and Portal.dc.html:1091. `src/routes/public/submit-views.tsx`:967 renders the same text plus a trailing `&rsaquo;` the frame's own drawn label omits; DEC-908's own prose already adjudicates this exact row's styling as settled.
- **"‹ Triage"** -- Chautauqua Submissions.dc.html:358. `app/src/pages/submissions/SubmissionDetailPage.tsx`'s landed two-node idiom (DEC-919 wave-98 amendment, cited verbatim in that file's own comment): one anchor, two sibling spans (`chq-detail-back-full` / `chq-detail-back-short`), CSS reveals one per width.
- **"‹ Wave 2 queue"** (×2) -- Chautauqua Review.dc.html:283/936. `app/src/pages/review/Scorecard.tsx` renders `&lsaquo; {plan.name} queue` -- live plan name between two literal fragments, a shape the affix-stripping check cannot bridge (a fixed suffix follows the variable, not just a fixed prefix).
- **"Save the plan"** -- Chautauqua Review.dc.html:666. **BLESSED, RULED NOT A DEFECT**: DEC-745 wave-98 amendment §4 rules verbatim that this pair "captions the NEW-plan state ... the geometry-only dock stands and the copy delta is recorded as a frame interpretation, not a defect"; `app/src/pages/review/PlanEditor.tsx`:1497-1499 confirms the existing-plan dock renders `{saving ? 'Saving…' : 'Save'}`.
- **"Swap"** -- Chautauqua Review.dc.html:652 (this row's `looksLikeDataValue` match is a coincidental bare-short-word pattern hit, not the real reason -- recorded honestly here rather than left uncited): DEC-745 wave-98 amendment §2 rules verbatim "The copy stays `Remove`" -- fabricating a "Swap" label over a Remove-only action would misdescribe the control.
- Masked passwords (`••••••••••`), dates (`Tue 12`/`Wed 13`/`Thu 14`, `16 Aug 2026, 23:59`), emails (`their@email.com`, `sbek-speaker@example.com`), bare names/fixture identities (`Priya`, `Raman`), long free-run copy (talk abstracts, review comments, task descriptions), and merge-field placeholders (`Comms.dc.html`:315-316) all resolve via `looksLikeDataValue`/`labelIsComposedLiteral` on their generic shape, consistent with the desktop half's own precedent for the same shapes.

### 5. Net effect

- `FRAME_FLOOR_DIVERGENCE_CEILING`: **0 -> 1** (one genuine, newly-surfaced offender; not fixed this wave, test/audit-only scope).
- `UNRESOLVED_COUNT_TRIPWIRE`: **106 -> 105** (106 old `no-label-match`/`no-control-shape` rows re-graded as 105 `composed-unseen`+`no-token`+`no-control-shape` plus 1 moved to OFFENDERS).
- Zero product CSS/TS bytes changed this wave (test + audit doc only, per the task's own scope).
- Every offender and every `composed-unseen` row is now individually named above by frame line + selector/citation, so a future wave can drain (fix "Draft", or re-litigate any BLESSED row) rather than re-derive the population from scratch.

## Wave 33 (task w33-a, DEC-393): the width axis of the 44px floor -- two live roster rows closed

`docs/design/audit/public-390-interactive-offenders-v12.md` names two live CANDIDATE rows that already carried `min-height:44px` plus centred flex but failed the ruling's width half -- no horizontal padding, so the hit box was only as wide as the text label:

- `## /docs/start-here`: `a.chq-docs-phone-back w=38px h=44px` -- **CANDIDATE**
- `## /embed/e/seed_embed_0001`: `a.chq-pub-activefilters-clear w=40px h=44px` -- **CANDIDATE**

### Fix

- `src/routes/docs-site.css.ts`, terminal phone `@media` block, `.chq-docs-phone-back`: added `padding: 0 6px` (label measures 38px; 38 + 12 = 50px, comfortably clear of the 44px width floor) and an equal `margin: 0 -6px` to absorb the padding so the `‹ Docs` label stays visually flush with the toolbar's 16px inset -- the wave-7 amendment's own sanctioned idiom for this exact tension. The base-scope rule at :103 (`display: none`) and the sibling `.chq-docs-contents-toggle` (already floored) were left untouched, per task scope.
- `src/routes/public/css/chrome.css.ts`, terminal phone `@media` block, `.chq-pub-activefilters-clear`: widened `padding: 0 4px` to `padding: 0 6px` (label measures 32px; 32 + 12 = 44px, exactly clears the floor). Checked the two named siblings' arithmetic per the task's instruction: `.chq-pub-activefilters-chip` already carries `padding: 6px 13px` (well clear) and `.chq-pub-select-clear` still carries its original `padding: 0 4px` -- neither is named as a roster offender and neither measures short by the same arithmetic (their labels are longer/differently composed), so both were left alone.

**Measured (arithmetic, not a live render sweep -- the task forbids running the render sweep or any live gate):**

| selector | before (w x h) | after width | ruling |
| --- | --- | --- | --- |
| `.chq-docs-phone-back` | 38px x 44px | 50px (38 + 2x6 padding) | DEC-393 (44px floor, both axes) |
| `.chq-pub-activefilters-clear` | 40px x 44px | 44px (32 + 2x6 padding) | DEC-393 (44px floor, both axes) |

### Receipt

`test/public-390-width-floor.test.ts` reads both CSS modules as source (`DOCS_SITE_CSS`, and `CHROME_CSS` composed with its sibling `CHROME_PHONE_CSS` -- imported constants, not globbed files; `chrome.css.ts`'s DEC-385 wave-143 split moved its terminal phone `@media` block into a separate export so every composing sheet can concatenate it as its own trailing phone region, so `.chq-pub-activefilters-clear`'s real rule is graded from the concatenation, exactly as every host composes them), strips comments before matching so a comment quoting a frame/roster literal can never masquerade as a real declaration, and grades each selector's terminal (last-occurring, i.e. phone-block) rule for `min-height:44px` + centred flex + non-zero horizontal padding. A synthetic `min-height:44px; padding:0` rule is asserted as a failing case (negative control), so the scan cannot pass vacuously. A third test pins that `.chq-pub-select-clear` was left at its original `padding: 0 4px`, matching the task's "leave the sibling rules alone unless they measure short" scope.

This wave does not touch `docs/design/audit/public-390-interactive-offenders-v12.md` -- it is machine-written and overwritten unconditionally by the gate; a future render-sweep wave is expected to re-grade both rows off CANDIDATE once it runs.
## WAVE 34 (DEC-613 wave-34 amendment, task w34-g): the wave-31 "Draft" offender was a false positive, not a genuine divergence

Measured on branch `v12m-w34-g`, main at `da6cbbf51`, by `test/frame-control-floor.scan.test.ts`, forcing `FRAME_FLOOR_DIVERGENCE_CEILING` and `UNRESOLVED_COUNT_TRIPWIRE` to `-1` and reading the printed offender list / reason breakdown back. Command run: `npx vitest run test/frame-control-floor.scan.test.ts test/exemption-reason-is-a-principle.scan.test.ts test/decision-doc-citation.scan.test.ts test/open-divergence-ledger.scan.test.ts` (targeted per this task's own instruction, never the full suite).

**Finding: the wave-31 "Draft" offender (§3 above) is not open product debt.** DEC-613's own wave-96 amendment already ruled this exact row before wave 31 ever measured it: `src/routes/public/cfp.css.ts`'s comment above `.chq-cfp-save-draft` states "the accessible name stays \"Save draft\" per DEC-613 wave-96 amendment (one control, one name at every width -- the frame's \"Draft\" is a drawing abbreviation, not a label to ship)". The same disposition is recorded in `docs/design/DEVIATIONS.md` and in `docs/design/audit/public-390-request-verdicts-v12.md`'s "Submit a talk (:1014-1070)" row. Wave 31's `NOT_ACTUALLY_COMPOSED` table correctly identified that the only quoted "Draft" in the corpus is documentation prose, not rendered text -- but that classification alone still routed the row to `not-drawn`/OFFENDER, because nothing told the grader the REAL control itself was already adjudicated as correct-as-shipped.

**Repair: a new `BLESSED_ABBREVIATION` table in `test/frame-control-floor.scan.test.ts`**, keyed `{fileName, line, reason}` exactly like `HAND_VERIFIED_COMPOSED`/`NOT_ACTUALLY_COMPOSED`, checked in `gradeControl` BEFORE `notActuallyComposedReason` so a hit short-circuits straight to `composed-unseen` (UNRESOLVED, never OFFENDER). Its one entry (`Chautauqua Public and Portal.dc.html`:1063) quotes DEC-613 wave-96's own ruling sentence verbatim, principle-only (no lane token, no schedule language -- graded by `test/exemption-reason-is-a-principle.scan.test.ts`, which passed). A resolution guard (`"Draft" abbreviation exemption` describe block) reads `src/routes/public/cfp.css.ts` and throws if the cited receipt text stops resolving verbatim, so the exemption's premise cannot rot silently. Non-vacuity is proved two ways: a synthetic fixture (`fileName: 'Zzy Fixture.dc.html'`, never a live product citation) with no `BLESSED_ABBREVIATION` entry still grades `not-drawn`/OFFENDER through the full `gradeControl` pipeline, and the real row is confirmed excluded from `OFFENDERS` and graded `composed-unseen`.

**MEASURED (this branch, both ceilings forced to `-1`, printed lists/breakdown read back): 0 offenders, 106 unresolved (90 `composed-unseen`, 4 `no-token`, 12 `no-control-shape`).**

### Net effect

- `FRAME_FLOOR_DIVERGENCE_CEILING`: **1 -> 0** (the sole wave-31 offender reclassified as a blessed, already-ruled abbreviation; zero real offenders remain).
- `UNRESOLVED_COUNT_TRIPWIRE`: **105 -> 106** (the "Draft" row moves from OFFENDERS into the `composed-unseen` bucket: 89 -> 90 `composed-unseen`, `no-token` and `no-control-shape` unchanged at 4/12).
- Zero product CSS/TS bytes changed this wave (test + audit doc only).
- The `### 3. The one offender: ...` heading AND its body (lines 127-129 above) are left byte-for-byte untouched per this task's own scope boundary -- a separate, concurrent open-divergence-ledger adjudication owns that section; this wave's finding and repair are recorded ONLY in this new section so the two edits do not collide.

## Wave 37 amendment (DEC-903): the WAVE 31 `### 3.`/`### 5.` paragraphs above are SUPERSEDED-IN-PLACE

`test/audit-ratchet-statement-drift.scan.test.ts` (new, DEC-903 wave-37)
caught that this document's WAVE 31 section still reads, unqualified,
"`FRAME_FLOOR_DIVERGENCE_CEILING`: **0 -> 1**" (its own `### 5. Net effect`
heading) with "Not fixed this wave ... left for a future wave's repair
lane" (its own `### 3. The one offender` body) -- both stale narrative
claims once read on their own, out of document order. Read together with
the WAVE 34 section immediately above this one, the doc's NEWEST statement
about this constant is already correct: `FRAME_FLOOR_DIVERGENCE_CEILING`:
**1 -> 0**, live value 0. The evidence the "Draft" offender was resolved by
adjudication, not left open: `docs/design/DEVIATIONS.md`'s own row states
"CFP wizard dock's `Save draft` vs the frame's `Draft` — ALREADY RULED,
one control with one name at every width, and the frame's `Draft` is a
drawing abbreviation" (DEC-613 wave-96 amendment), and
`test/frame-control-floor.scan.test.ts` reads
`export const FRAME_FLOOR_DIVERGENCE_CEILING = 0;` today. The WAVE 31
`### 3.`/`### 5.` paragraphs are marked SUPERSEDED-IN-PLACE by this
amendment (DEC-069: appended, never deleted) -- a reader landing on either
paragraph alone should follow the doc forward to the WAVE 34 and WAVE 37
sections rather than treat "left for a future wave's repair lane" as
still-open work.

## WAVE 53 (task w53-b, DEC-995's wave-53 amendment): the sixteen non-composed unresolved rows, adjudicated individually

Per the task's own instruction, the sixteen NON-COMPOSED unresolved rows
named at :28-49/:97 above (the eleven `no-control-shape` rows, plus
"Headshot" moved into that bucket by the wave-26 attribute tier, plus the
four `no-token` rows) are each given exactly one disposition below, with a
receipt: **RESOLVED** (the row IS a control; its floor lives on an
ancestor or sibling token the union join never consults -- the join is
widened, hand-verified, and the row rejoins the graded population),
**POPULATION-EXCLUDED** (not a control at all -- excluded at the
population step with a named predicate and a ruling id, following
`test/desktop-control-floor.scan.test.ts`'s `isStatesSwatchFrameTitle`/
`RULING_SETTLED_EXCLUSIONS` precedent exactly), or **OFFENDER** (a genuine
floor gap -- the divergence ceiling rises honestly). No row remains merely
bucketed. Implemented in `test/frame-control-floor.scan.test.ts` as
`WIDENED_JOIN_RESOLUTIONS` (RESOLVED/OFFENDER, checked first in
`gradeControl`, before every other tier) and
`POPULATION_EXCLUDED_FIELD_LABELS` (applied to `ALL_CONTROLS` before
grading begins).

### The sixteen rows

| # | Label | Citation | Disposition | Receipt |
| - | - | - | - | - |
| 1 | "See the recipients" | Comms:350, `chq-comms-batch-toggle-label-phone` | RESOLVED, OK | Ancestor `<button className="chq-btn chq-btn-secondary chq-comms-batch-toggle">` (`app/src/pages/comms/RecentSends.tsx`) wraps the resolved span; `app/src/styles.css`'s phone block gives `.chq-btn` `min-height:44px` -- exactly meets the drawn 44px floor. |
| 2 | "Merge them" | Contacts:537, `chq-contacts-merge-primary-phone-label` | RESOLVED, OK | Ancestor `<button className="chq-btn chq-btn-primary">` (`app/src/pages/contacts/MergePage.tsx`) sits inside `.chq-contacts-merge-footer`; `app/src/pages/contacts/contacts-panels.css`'s phone block gives `.chq-contacts-merge-footer .chq-btn` `min-height:48px` -- exactly meets the drawn 48px floor. |
| 3 | "Upload a file for the speaker" | Content:417, `chq-content-upload-prompt-phone` | RESOLVED, OK | Ancestor `<div className="chq-upload-zone chq-content-upload-zone">` (`app/src/pages/content/UploadZone.tsx`), two levels up; `content.css` declares `min-height:50px` (narrowed to 46px in `upload-zone.css`'s own phone block) -- union max 50px clears the drawn 46px floor. |
| 4 | "First name" | Public and Portal:645, `chq-portal-field-label` | POPULATION-EXCLUDED | `src/routes/portal/profile.tsx`'s `<label for="firstName">First name</label>` -- a form-field NAME, not a tap target (`src/decisions-data/DEC-393.md`'s wave-31 amendment: a typography/column-register token set grades UNRESOLVED, never a silent exemption -- here made an explicit, receipted population exclusion instead, per the task's own instruction). |
| 5 | "Last name" | Public and Portal:649, `chq-portal-field-label` | POPULATION-EXCLUDED | Same shape as "First name" -- `src/routes/portal/profile.tsx`'s `<label for="lastName">Last name</label>`. |
| 6 | "Bio" | Settings:523, `chq-portal-field-label` | RESOLVED, OK | Mis-attributed by the own-text tier to an unrelated portal-profile field label sharing the word "Bio". The real control is `app/src/pages/settings/PortalSettingsPanel.tsx`'s `SpeakerEditPills` -- a `<span className="chq-pill chq-pill-static[ is-active]">{field.label}</span>` the own-text tier cannot see (the text is a JSX expression, never a literal). `settings.css`'s phone block gives `.chq-settings-portal-pills .chq-pill` `min-height:44px` -- exactly meets the drawn 44px floor. |
| 7 | "Links" | Settings:525, `chq-contacts-record-label` | RESOLVED, OK | Same `SpeakerEditPills` strip as "Bio" (mis-attributed to an unrelated `ContactDrawer.tsx` heading). Same `.chq-pill` 44px floor. |
| 8 | "Title" | Settings:526, `chq-submissions-col-title`/`chq-portal-field-label` | RESOLVED, OK | Same `SpeakerEditPills` strip, fourth pill -- `SPEAKER_EDIT_FIELDS[3].label` is `"Session title"`, which the frame draws abbreviated to `"Title"` (the same width-conditioned-copy shape this ledger already accepts for "Wait"/Waitlist); flagged as a content note, not a geometry gap. Same `.chq-pill` 44px floor. |
| 9 | "Abstract" | Settings:527, `chq-section-label`/`chq-detail-section-title`/`chq-detail-section-title-frameless` | RESOLVED, OK | Same `SpeakerEditPills` strip, fifth pill -- exact word match, mis-attributed to unrelated section-title headings. Same `.chq-pill` 44px floor. |
| 10 | "Needs triage" | Submissions:149, `chq-submissions-status-pending-phone` | RESOLVED, OK | Ancestor `<button className="chq-pill[ is-active]" data-status="pending">` (`app/src/pages/submissions/FilterBar.tsx`) wraps the resolved span; `.chq-pill`'s house 44px phone floor applies -- exactly meets the drawn 44px floor. |
| 11 | "Wait" | Submissions:391, `chq-detail-back-short` | CLOSED, repaired | Ancestor `<button className="chq-btn chq-btn-secondary">` (`app/src/pages/submissions/SubmissionDetailPage.tsx`'s `decisionActionLabel`, DEC-878 wave-129 amendment), inside `.chq-detail-decision-secondary-pair`, inside the phone `.chq-phone-dock` scaffold. `detail.css`'s terminal `@media (max-width: 700px)` block adds `.chq-phone-dock .chq-detail-decision-primary ~ .chq-detail-decision-secondary-pair .chq-btn { min-height: 46px; }` (w56-c) -- dock-scoped and primary-sibling-scoped, so the in-aside pair and the decided-state pair keep their prior 44px and the desktop aside stays byte-identical. `FRAME_FLOOR_DIVERGENCE_CEILING` returns 0. |
| 12 | "Headshot" | Settings:524 (moved from `no-label-match` by wave-26's attribute tier) | RESOLVED, OK | Same `SpeakerEditPills` strip, second pill -- `SPEAKER_EDIT_FIELDS[1].label` is `"Headshot"`, exact match. The wave-26 attribute tier instead mis-resolved this row to an unrelated wrapper `<div title="Headshot">` (the profile-picture uploader section). Same `.chq-pill` 44px floor. |
| 13 | "Browse the sessions ›" | Account:141, no-token | RESOLVED, OK | `src/routes/auth-views.tsx` renders a bare, classless `<a>` inside `<div className="chq-auth-footer-links">`. `auth.css.ts`'s terminal phone block declares `.chq-auth-footer-links a` `min-height:44px` (DEC-367 wave-57 amendment) -- exactly meets the drawn 44px floor. The class exists on the ANCESTOR div, not the anchor itself, so `classTokensNear`'s nearest-enclosing-tag walk finds nothing. |
| 14 | "Browse the sessions ›" | Public and Portal:1092, no-token | RESOLVED, OK | Same classless-anchor shape, `src/routes/public/submit-views.tsx` inside `<div class="chq-cfp-links">`. `cfp.css.ts` declares `.chq-cfp-links a, .chq-cfp-confirm-actions a:not(.chq-btn)` `min-height:44px` (its own header comment names both :1092 and :1135 as the two rows this rule was written for) -- exactly meets the drawn 44px floor. |
| 15 | "+ Rule" | Contacts:192, no-token | RESOLVED, OK | `app/src/pages/contacts/FilterRulesPanel.tsx` renders `<button className="chq-contacts-filter-add-chip">+ Rule</button>` -- a REAL `chq-` class the join misses mechanically: the button's `onClick` handler body contains a bare `<` comparison (`rules.length < MAX_SEGMENT_RULES`), and `classTokensNear`'s `lastIndexOf('<', prevGt)` walk finds that operator's `<` instead of the real `<button` tag opener, reading `className` from a garbage tag chunk. `contacts.css`'s phone block declares `.chq-contacts-filter-add-chip` `min-height:44px` -- exactly meets the drawn 44px floor. |
| 16 | "Log in ›" | Public and Portal:1135, no-token | RESOLVED, OK | `src/routes/public/submit-views.tsx` renders a bare, classless `<a href="/login">` inside `<div class="chq-cfp-confirm-actions">`. The same `cfp.css.ts` rule cited for row 14 reaches this anchor too (it carries no `.chq-btn` class) -- exactly meets the drawn 44px floor. A nearby "tap-floor-exempt: inline-in-prose" receipt covers a DIFFERENT check (the flex-centred lens), not this min-height. |

### Before/after breakdown

**MEASURED (this branch, both ceilings forced to `-1`, printed lists/breakdown read back):**

- **BEFORE**: 106 unresolved (90 `composed-unseen`, 4 `no-token`, 12
  `no-control-shape`), 0 offenders, 235 drawn controls in the population.
- **AFTER**: 90 unresolved (90 `composed-unseen`, 0 `no-token`, 0
  `no-control-shape`), **1 offender** ("Wait"), **233** drawn controls in
  the population (2 removed by `POPULATION_EXCLUDED_FIELD_LABELS`) -- 13
  of the sixteen rows resolved OK, 2 population-excluded, 1 offender.

### Net effect

- `FRAME_FLOOR_DIVERGENCE_CEILING`: **0 -> 1** (one genuine offender,
  "Wait" -- see row 11 above). Not fixed this wave (instrument-only scope,
  zero product CSS/TS bytes touched).
- `UNRESOLVED_COUNT_TRIPWIRE`: **106 -> 90** (sixteen rows drained: 13
  RESOLVED-OK + 1 RESOLVED-OFFENDER out of UNRESOLVED into the graded
  population, 2 POPULATION-EXCLUDED out of the population entirely).
- `ALL_CONTROLS.length`: **235 -> 233** (the two POPULATION-EXCLUDED
  field-name-eyebrow rows). The "Chautauqua Public and Portal.dc.html"
  per-file tripwire in the non-vacuity test moves **55 -> 53** to match.
- Zero product CSS/TS bytes changed this wave (test + audit doc only, per
  the task's own scope).
- The 90 `composed-unseen` rows are untouched -- they need a new join
  tier (a later lane's work), not adjudication, exactly as the task
  scoped it.

Commands run: `npx vitest run test/frame-control-floor.scan.test.ts
test/campaign-ratchet-two-sided.scan.test.ts
test/audit-ratchet-statement-drift.scan.test.ts
test/citation-form-drift.scan.test.ts
test/open-divergence-ledger.scan.test.ts` (targeted per this task's own
instruction, never the full suite).
