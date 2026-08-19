# Account + Docs v12 phone conformance — audit findings

Findings surfaced while implementing w1-h (TIER 1: Account cluster's two
phone frames + the Docs article phone frame, SSR).

## Sign in · 390 omits "Forgot your password?" from the phone submit row

**Frame**: docs/design/Chautauqua Account.dc.html:121-141 ("Sign in · 390").
The desktop twin (top of the same file, "Sign in · a card, not a stretched
phone") draws `Forgot your password?` inline with the Sign in button
(`justify-content:space-between`). The 390 mockup's submit row (:127-136)
draws only the full-width Sign in action — no tertiary link at all, at any
position.

**Why not a straight cut**: DESIGN-RULINGS's corollary ("a centred card is
not a desktop design just because it is centred... full-column buttons ...
are phone anatomy") licenses the full-width button; nothing in it, or in
DEVIATIONS.md, licenses dropping live navigation. A geometry frame is not by
itself grounds to delete a working link — the omission reads as the
mockup's own scenario simplification (an entry point that just needs "Sign
in" drawn large), not a deliberate "no reset path on phone" ruling.

**What this task did**: kept `Forgot your password?` (`.chq-auth-tertiary`),
restacked `.chq-auth-submitrow` to `flex-direction: column-reverse` at
<=700px so the full-width primary action sits first and the tertiary link
sits centred beneath it at the 44px floor — narrowest reading that satisfies
both the frame's full-width-button geometry and DESIGN-RULINGS' phone-vs-
desktop-anatomy split without removing functionality. Flagged here per this
task's design-gap instruction rather than escalated, since the narrow
interpretation is defensible and low-risk to revise later.

## The auth input fill (#FFFFFF) — DEVIATIONS §5, untouched

Frame lines 130/134/161/165/169 (docs/design/Chautauqua Account.dc.html)
sample the phone card's email/password inputs at `background:#FAF8F2`
(`--chq-surface`), which already matches `.chq-auth-card input[...]`'s
existing fill — no `#FFFFFF` literal appears on either 390 frame this task
touched, so DEVIATIONS §5's open adjudication (desktop's own input fill vs
the palette-closure ban) is out of scope here and was left exactly as-is,
per the task's explicit instruction not to touch it.

## Docs · an article · 390 — header stays the desktop brandrow, no "Contents" affordance

**Frame**: docs/design/Chautauqua Docs.dc.html:166-204 ("Docs · an article ·
390"). The mockup draws a dedicated phone header band: `‹ Docs` back link on
the left, a `Contents` trigger on the right (:167-169) — implying a mobile
table-of-contents drawer/sheet, replacing the desktop brandrow+search+
leaving-link header entirely at phone widths.

**Current implementation (unchanged by this task)**: `DocsArticlePage`
(src/routes/docs-site.tsx) renders the SAME `.chq-docs-header` (brandrow +
compact search + leaving link) at every width, and separately renders a
`.chq-docs-phone-back` (`‹ Docs`) link inline in the article body, above the
H1 — already phone-only via `display:none` → `display:flex` in the existing
700px block. There is no `Contents` trigger and no drawer/sheet anywhere in
the codebase.

**Why not fixed here**: building a functioning contents drawer is a new
interactive feature (state, a trigger, a sheet/overlay, its own a11y), not a
geometry fix — outside a CSS/markup-geometry task's scope and file list
(no client-side JS module is among the six files this task owns). The
existing `.chq-docs-phone-back` link already gives phone readers a way back
to the index, so nothing is broken, only incomplete against the frame's
fuller phone chrome.

**Suggested fix (future task)**: a phone-only header variant for
`DocsArticlePage` — swap the shared `.chq-docs-header` for a two-item bar
(`‹ Docs` / `Contents`) at <=700px, with `Contents` opening the existing
`.chq-docs-nav` group list (already rendered, currently `display:none` on
phone) in a bottom sheet or full-screen overlay.

## What this task did fix (docs-site.css.ts)

- `.chq-docs-figure`/`.chq-docs-figure-frame` edge-to-edge treatment
  (already landed pre-task) now carries an explicit `docs/design/Chautauqua
  Docs.dc.html:183/184` citation per DEC-976, confirmed against the frame's
  no-side-margin figure and top/bottom-only hairline frame.
- `.chq-docs-article-head h1`'s existing 28px already matched the frame
  (:175) — pinned in test/account-docs-phone-frames.test.ts rather than
  restated.
- `.chq-docs-pager`/`.chq-docs-pager-prev`/`.chq-docs-pager-next` gained a
  phone-only override: the frame's filled, edge-to-edge Previous/Next
  button bar (:200-202) replaces the desktop's bare `--chq-rule` divider +
  plain links, which previously had no phone treatment at all.
