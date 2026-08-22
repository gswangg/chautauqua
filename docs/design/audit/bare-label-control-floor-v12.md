# Bare-label control floor — a scan's own vacuity, and its fix (v12m-w28-f, DEC-999 wave-28 amendment)

## The finding

Two facts, both verified by hand at main `1482754fd` before any code changed:

**(a) A live 18x18 tap target at 390.** `app/src/pages/contacts/ImportWizard.tsx`
(~`:1355`) renders:

```
<label className="chq-contacts-import-review-skip">
  <input
    className="chq-check"
    type="checkbox"
    checked={skipLines.has(row.line)}
    onChange={() => toggleSkipLine(row.line)}
    aria-label={`Skip line ${row.line}`}
  />
</label>
```

inside the import-review table's skip column — no text sibling, no other
element child. `app/src/pages/contacts/contacts-panels.css:1128` declared
that class with `display:flex; align-items:center; gap:6px; font-size:12px;
color:var(--chq-muted)` and no `min-height`/padding anywhere, so the painted
hit box was the 18px checkbox itself at 390. That violates the Tier-2 44px
floor (`docs/mobile-campaign.md`) and DESIGN-RULINGS.md B8, "The 44px floor,
and how it gets evaded."

**(b) The scan built to catch exactly this shape could not see it.**
`app/src/check-hit-receipt.scan.test.ts`'s wave-26 `labelIsBare` disposition
(DEC-393 wave-26 amendment) exists precisely to widen the population to
empty, unfloored `<label>` wraps. Its `labelHasRealContent(inner)` stripped
`.chq-check` sites of their own `<input .../>` tag using
`inner.replace(/<input\b[^>]*\/>/g, '')` before checking whether anything
non-whitespace remained. `[^>]*` matches across newlines (a JSX `<input>`
attribute list commonly spans several lines) but it is not brace-depth
aware: the moment it meets a `>` character anywhere in the tag — including
the arrow of an inline handler like `onChange={() => toggleSkipLine(row.line)}`
— the match ends there, well short of the tag's real `/>` close. Everything
after that point (the rest of the real, empty input tag, e.g.
`aria-label={...} />`) was left behind as "content," so the label was scored
as non-bare.

## Reproduction (before any fix)

Extracted the landed function into a scratch script and ran it against both
real sites named above, looked up by their label's own `className`
(`.chq-visible-toggle` in `SubmissionDetailPage.tsx`, `.chq-contacts-import-
review-skip` in `ImportWizard.tsx`) — both real, both multi-line, both
carrying an `onChange={() => ...}` handler:

```
SubmissionDetailPage.tsx  className=chq-visible-toggle              OLD hasRealContent=true
ImportWizard.tsx          className=chq-contacts-import-review-skip OLD hasRealContent=true
```

Both return `true` ("has real content"), which means `labelIsBare` is
`false` for both, which means neither can ever enter `inCellPopulation` via
the bare-label path — the widened population the wave-26 amendment claims to
grade was vacuous over the real corpus even though its synthetic fixture
controls (single-line `<input .../>`, no `=>`) passed. A fixture proves the
algorithm; only the corpus proves the gate (DEC-808).

## The fix

1. **`app/src/check-hit-receipt.scan.test.ts`** — replaced the regex-only
   input-tag stripper with `stripInputTags`, a brace-depth-aware walker:
   from each `<input` it tracks `{`/`}` depth and only accepts a `/` `>` pair
   as the tag's close when depth is `0`, so a `>` inside an attribute
   expression (the arrow of `onChange={() => ...}`, or any other `{...}`
   containing `>`) no longer terminates the match early. `labelHasRealContent`
   now calls `stripInputTags` instead of the bare regex; behaviour for every
   existing synthetic control (single-line self-closing inputs, no braces)
   is unchanged.

   Added a corpus-keyed anti-vacuity assertion (`'anti-vacuity (DEC-999
   wave-28 amendment): ...'`) that looks up both real sites by file path and
   asserts their classification directly against the live tree — not a
   fixture — so a future regression that silently re-narrows the stripper
   (and re-empties the population) fails loudly here instead of just going
   quiet:
   - `.chq-contacts-import-review-skip` (`ImportWizard.tsx`) — this task's
     own CSS change (below) floors it, so at HEAD it is correctly OUT of
     `inCellPopulation` via the floor path (`labelIsBare === false`). The
     anti-vacuity claim is instead proved directly against the stripper:
     `labelHasRealContent` must return `false` for this site's own
     multi-line `onChange={() => ...}` input, independent of the floor.
   - `.chq-visible-toggle` (`SubmissionDetailPage.tsx`) — already floored on
     main by a landed wave-26 lane, so it is likewise OUT via the floor
     path — must equally have `labelHasRealContent` return `false` for its
     own multi-line `onChange={() => ...}` input, proving the stripper
     itself is fixed independent of either site's floor.

2. **`app/src/pages/contacts/contacts-panels.css`** — floored
   `.chq-contacts-import-review-skip` inside the file's ONE terminal
   `@media (max-width: 700px)` block (starts `:1303`, verified terminal —
   runs to EOF), using the `.chq-check-hit` idiom already established in
   `app/src/styles.css` (`min-height:44px; min-width:44px; padding:13px;
   margin:-13px;`): the padding/negative-margin pair grows the hit box to
   44x44 without shifting the painted 18px checkbox. Desktop (base scope) is
   untouched — the rule lives only inside the terminal narrow block
   (DEC-385).

3. **`.chq-visible-toggle`** — already floored on main by a landed wave-26
   lane. No second rule added for it; this task only proves the scan can
   now see it correctly (finding above).

## Corpus measurement after the fix

Re-ran `findCheckSites`/`inCellPopulation` over the full tree (`npx vitest
run app/src/check-hit-receipt.scan.test.ts`): the widened `labelIsBare`
population is non-empty and every site in it — `.chq-contacts-import-review-
skip` and `.chq-visible-toggle` — resolves to a floored class after this
task's CSS change (the former via the new phone rule added here, the latter
via the pre-existing wave-26 rule), so `every in-cell .chq-check site is
wrapped in .chq-check-hit`-equivalent coverage (the bare-label branch is
graded by `classResolvesToPhoneFloor`, not the check-hit-label wrap) holds.
No further bare-box label was found by the widened, now-correctly-firing
classifier over the current tree; none is recorded here as an open row
because none exists at this measurement.

## Why this was invisible before wave-28

The wave-26 amendment's own synthetic controls (`findCheckSites: labelIsBare
is TRUE for an empty, unfloored label`, etc.) used single-line, brace-free
`<input type="checkbox" className="chq-check" />` fixtures — exactly the
shape the naive regex handles correctly. Every real site in the tree,
however, is written with the input's attributes spread across several lines
and an inline arrow handler, the ordinary JSX house style throughout this
codebase. The gap between "passes its own fixtures" and "fires on the real
corpus" is precisely DEC-808's lesson: a scan's positive control must be
anchored on content from the real tree, not only synthetic strings that
happen to avoid the shape the scan is blind to.
