# Phone twin-visibility ledger — DEC-576 wave-39 amendment

Instrument: `app/src/phone-twin-visibility.scan.test.ts`. `app/src/phone-block-
visibility.test.ts`'s `MARKUP_PHONE_UNHIDDEN_CEILING` grades only class
selectors whose token literally *contains the substring `phone`*. That
population is blind by construction to the app's one deliberate second-
render idiom: a control rendered twice in the DOM — once in-flow, once
through `PortalLayout`'s `dock` prop (rendered inside `.chq-portal-dock` in
the page footer) — where CSS alone is supposed to decide which copy is on
screen, and neither the dock class family (`.chq-portal-edit-dock`,
`.chq-portal-taskform-dock`) nor the inline-twin class family
(`.chq-portal-actions-footer`, `.chq-portal-taskform-submit`) carries a
`phone` segment anywhere in its name. `.chq-portal-actions-footer`'s own
green MARKUP_PHONE_UNHIDDEN row said nothing about whether its dock
counterpart existed, was reachable, or was CSS-exclusive with it — which is
exactly why the `/portal/profile` desktop double-Save (two live `Save
profile` buttons at ≥701px, both submitting `#chq-portal-profile-form`) sat
under a green ceiling. This file MEASURES AND RATCHETS ONLY — it moves no
product byte and no CSS (v12m-w38-f owns the profile fix; v12m-w38-a owns
`.chq-portal-file-link` in the same sheet).

## The correct idiom, stated twice in the app's own comments

`src/routes/portal/portal.css.ts`:

```
.chq-portal-edit-dock { display: none; }        /* top-level, ahead of the terminal media block */
...
@media (max-width: 700px) {
  .chq-portal-actions-footer { display: none; } /* the inline twin, stood down at phone */
  ...
  .chq-portal-edit-dock { display: flex; ...; }  /* the dock copy, revived at phone */
}
```

and the same shape again for `.chq-portal-taskform-dock` /
`.chq-portal-taskform-submit`. Both comments state the contract verbatim:
"exactly one copy draws at any width."

## Population (derived, never hand-listed)

1. Every `dock={IDENT}` call site under `src/routes/portal/**/*.tsx`
   (`readdirSync` walk of non-test `.tsx` files, regex over `dock=\{(\w+)\}`)
   — **five** today, matching the task brief exactly:
   `index.tsx`, `profile.tsx`, `edit.tsx`, `tasks/views.tsx` ×2.
2. Each `IDENT`'s declaration markup — its own JSX, widened to the body of
   whatever function it resolves to when the declaration is a bare function
   call (`tasks/views.tsx`'s second `dock` is `tasksPageDockPrimary(...)`).
3. Every non-generic `chq-` class token in that markup (excluding
   `chq-btn`/`chq-btn-primary`/`chq-btn-secondary`/`chq-btn-tertiary` —
   reused on hundreds of unrelated elements across the whole app, so no
   selector built from one of them could ever reach only this dock copy).

CSS side, derived from `src/routes/portal/portal.css.ts`'s one terminal
`@media (max-width: 700px)` block: every bare (non-compound, one selector
per rule) class whose rule body is *exactly* `display: none;` — separately
for the top-level text (`DESKTOP_HIDDEN_CLASSES`) and the phone-media text
(`PHONE_HIDDEN_CLASSES`).

## Full roster (5 of 5)

| # | Page | `dock={…}` | Verdict | Detail |
|---|------|-----------|---------|--------|
| 1 | `src/routes/portal/index.tsx` | `dock` | **CLASSLESS-TWIN** | Markup is a bare `<>…<a class="chq-btn chq-btn-primary">…</a>…<a class="chq-btn chq-btn-secondary">Edit submission</a>…</>` fragment — no page-specific `chq-` token. No same-page inline duplicate exists either (the wave-110 amendment removed the old in-flow copy entirely; this dock is the page's *sole* render of these two controls) — a real but currently harmless instance of the same structural gap: if a twin were ever reintroduced, nothing could hide either copy selectively. |
| 2 | `src/routes/portal/profile.tsx` | `profileDock` | **CLASSLESS-TWIN** | Markup is a bare `<button type="submit" form="chq-portal-profile-form" class="chq-btn chq-btn-primary">Save profile</button>` — no page-specific token. **This is the live defect.** `profile.tsx:290` renders a *second*, CSS-correct copy of the same Save button wrapped in `.chq-portal-actions-footer` (visible desktop, `display:none` at phone — the correct inline half). But the dock copy has no selector to hide it at desktop, so both paint at ≥701px: two live `Save profile` buttons, both submitting `#chq-portal-profile-form`. Root cause of the wave-38-reported desktop double-Save. Fix owned by `v12m-w38-f`, not this ledger. |
| 3 | `src/routes/portal/edit.tsx` | `editDock` | **VERIFIED** | `.chq-portal-edit-dock` (top-level `display:none`, revived `display:flex` inside the terminal phone block) / `.chq-portal-actions-footer` (visible by default — real top-level flex-column rule — `display:none` inside the same phone block). Exactly one copy draws at any width. |
| 4 | `src/routes/portal/tasks/views.tsx` | `taskFormDock` | **VERIFIED** | `.chq-portal-taskform-dock` (top-level `display:none`, revived `display:flex` inside the terminal phone block) / `.chq-portal-taskform-submit` (no top-level rule at all — inherits its visible parent's state at desktop — `display:none` inside the same phone block). Exactly one copy draws at any width. |
| 5 | `src/routes/portal/tasks/views.tsx` | `dock` (= `tasksPageDockPrimary(...)`) | **CLASSLESS-TWIN** | Every branch of `tasksPageDockPrimary` returns a bare `<a class="chq-btn chq-btn-primary">`/`<form>…<button class="chq-btn chq-btn-primary">` with no page-specific token. No same-page inline duplicate of the *same* task's control exists at desktop today (the dock shows a shortcut to whichever task is "next"; the list below shows every task, including that same one, but as a genuinely separate row, not a CSS-gated twin of the dock's own markup) — same structural gap as #1: currently harmless, but unreachable by any hide-one-copy selector. |

## Counts

- `TWIN_VISIBILITY_OFFENDER_CEILING = 0` — every dock site whose class token
  *is* reachable (`editDock`, `taskFormDock`) has both CSS halves of the
  DEC-576 idiom present and correct. No offender today.
- `TWIN_VISIBILITY_CLASSLESS_CEILING = 3` — `index.tsx`'s `dock`,
  `profile.tsx`'s `profileDock`, `tasks/views.tsx`'s `dock`
  (`tasksPageDockPrimary`). One of the three (`profileDock`) is a live
  defect (the desktop double-Save); the other two currently have no inline
  twin to collide with, but remain structurally unreachable by any CSS
  selector should one ever be added.

Both ceilings were seeded by forcing each constant to `-1` and reading the
printed roster back (`npx vitest run app/src/phone-twin-visibility`), never
by arithmetic or a snapshot — see that test file's own `SEED` comment.

## Campaign scope

Both constants are registered in
`scripts/exit-predicate/campaign-scope.ts`'s `OUT_OF_CAMPAIGN_SCOPE`: a
newly-derived population must not move the campaign's goalposts
mid-convergence (DEC-069). `TWIN_VISIBILITY_OFFENDER_CEILING` promotes once
proven complete enough to gate on; `TWIN_VISIBILITY_CLASSLESS_CEILING`
promotes once its 3 rows are drained to dock-specific classes reachable by
CSS (the `profile.tsx` row is `v12m-w38-f`'s to close).

## Wave-44 update (thunderdome medic): the profile.tsx row closed

The row this ledger named as `v12m-w38-f`'s to close is closed. That lane
landed in this megabatch and gave `profile.tsx`'s `profileDock` a
dock-specific token of its own (`class="chq-portal-profile-dock chq-btn
chq-btn-primary"`), so it is reachable by CSS and is no longer a CLASSLESS
twin. Re-measured live off the roster, never arithmetic:
`TWIN_VISIBILITY_CLASSLESS_CEILING = 2`, LOWERED in the same commit as this
statement per the ledger's own two-sided "does not sit stale above the
measured count" companion. The remaining two rows are `index.tsx`'s
session-detail `dock` and `tasks/views.tsx`'s `tasksPageDockPrimary`.
`TWIN_VISIBILITY_OFFENDER_CEILING` is unchanged at 0.
