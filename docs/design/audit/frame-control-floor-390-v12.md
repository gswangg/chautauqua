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
- **112 unresolved** (down from 202 pre-wave-25, a **90-row net gain** in the graded population: 33 → 123 resolved-and-conforming, all OK): **97 `no-label-match`**, **4 `no-token`**, **11 `no-control-shape`**. `no-rule` measured 0.
- `UNRESOLVED_COUNT_TRIPWIRE = 112`; `FRAME_FLOOR_DIVERGENCE_CEILING = 0` (unchanged).

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

## Not offenders (UNRESOLVED, 112 of 235)

The UNRESOLVED population is now split into three dispositions instead of the prior wave's four: `no-label-match` (97), `no-token` (4), `no-control-shape` (11) -- itemised above -- plus `no-rule` (0, measured). None of these 112 rows is a claim this document makes: `frame-control-label.scan.test.ts` already grades whether the app renders the WORDS; this ledger only grades the HEIGHT of a control this scan could positively resolve to a real, control-shaped source token.
