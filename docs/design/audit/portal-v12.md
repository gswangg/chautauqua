# Portal v12 phone fidelity — findings (w3-b)

Shell-level findings the task window could not resolve inside the scoped
files (`src/routes/portal/edit.tsx`, `src/routes/portal/tasks.tsx` +
`tasks/**`, `src/routes/portal/shared.tsx`, `src/routes/portal/portal.css.ts`).
Frame citations are verbatim literals from `docs/design/Chautauqua Public
and Portal.dc.html`.

## 1. "Portal · Hotel stay form" (:518-521) draws a two-button footer dock that has no product behind it

`<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">` /
`<span style="flex:1; ...">Send this in</span>` /
`<span style="border:1px solid #BAB6A6; ...">Save draft</span>`

`docs/design/DEVIATIONS.md:163` already rules "Hotel-form save-draft" as an
unbuilt feature (no data model or endpoint behind the drawing) — this is not
a new finding, just a pointer for whoever eventually builds it: when it
lands, `TaskFormPage` (`src/routes/portal/tasks/views.tsx`) will need a real
`.chq-portal-actions-footer`-shaped dock (the class already exists, built
for `EditPage`'s footer this same task) rather than its current bare inline
`Submit` button. Until then the bare button already clears the 44px floor
via `THEME_CSS`'s unconditional phone rule (`src/views/theme.ts:625`), so
there is no phone-conformance regression today — only a missing feature,
already tracked elsewhere.

## 2. "Portal · Your session" (:563-596) markup is owned by `src/routes/portal/index.tsx`, outside this task's file grant

The frame's read-only session detail (status eyebrow, title, meta,
placement line, Abstract, Slides row with a Replace/upload control) renders
from `SubmissionDetailPage` in `src/routes/portal/index.tsx:420-520`, not
from any file this task owns. Everything that page consumes from the shared
sheet this task DID touch — `.chq-portal-actions .chq-btn`'s 44px floor,
`.chq-portal-status-badge`'s unmediated block-level register, the phone
shell's `.chq-portal-shell > .chq-measure` scroll region — is already
conformant (pinned by `test/portal-session-phone-frames.test.ts`'s second
describe block). `index.tsx` itself was cited in this task's authority list
for that reason only; a future task that owns that file should confirm its
own H1 (`docs/design/...:471`, `<h1 class="chq-portal-hero">Your session</h1>`)
gets the same 25px back-linked drill-in register (`--chq-type-page-title-
phone-drill`, DEC-643 amendment) this task wired up for
`TaskFormPage`/`EditPage` — `.chq-portal-hero-drill` is a modifier class,
not a rewrite of the shared `.chq-portal-hero` rule, specifically so a
sibling task can adopt it on that page's H1 without any coordination.

## 3. `--chq-type-page-title-phone-drill` had zero readers before this task

`src/views/theme.ts:76` declares the 25px drill register (DEC-643) but no
selector in the tree consumed it — every `.chq-portal-hero` instance,
back-linked or not, fell back to the 27px cluster-landing size
(`.chq-portal-hero { font-size: var(--chq-type-page-title-phone-size) }`,
unconditional in the phone block). This task wires it up for the two H1s it
owns (`TaskFormPage`, `EditPage`, both back-linked drill-ins per :508/:603)
via a new `.chq-portal-hero-drill` modifier class, added to those two
`<h1>` elements only. Three other `.chq-portal-hero` pages still carry the
same latent mismatch and are out of this task's file grant:
`src/routes/portal/index.tsx:471` ("Your session", back-linked — see
finding 2), `src/routes/portal/index.tsx:537` ("Your submissions",
back-linked), and `src/routes/portal/tasks/views.tsx:421`/`:492` ("Your
tasks" / "Resources", both back-linked but neither is one of this task's
three named frames). `src/routes/portal/index.tsx:326` (the portal
dashboard's own "N things to do" H1) is the one genuine cluster-landing
page and correctly keeps the 27px base rule untouched.
