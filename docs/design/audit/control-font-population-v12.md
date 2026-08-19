# control-font population audit (DEC-808 wave-99 amendment, task v12m-w2-d)

`app/src/control-font.scan.test.ts` used to read exactly ONE CSS input,
`app/src/styles.css`. Every cluster sheet under `app/src` and every
server-rendered sheet under `src/` (a `*_CSS` template-literal export) was
invisible to it — precisely the sheets the 44px-floor waves have been
adding `font-size`/`font-weight` to.

## Derived population

- Every `*.css` file under `app/src` (recursive), found by extension glob.
- Every module under `src/` (`.ts`/`.tsx`, excluding `*.test.*`) whose
  source matches `export const [A-Za-z0-9_]*_CSS\s*=\s*\`` — i.e. it
  exports a `*_CSS` template-literal string constant. Derived by reading
  exports, **not** a `src/**/*.css.ts` filename glob: `src/views/theme.ts`
  exports `THEME_CSS` and is plain `.ts`, so a `.css.ts` glob silently
  drops it.

Vacuous-population tripwire in the test: asserts the population is
non-empty and that `app/src/styles.css` and `src/views/theme.ts` are both
named members.

### Population as measured this wave (41 CSS sources)

**`app/src/*.css` (25 files)** — every file under `find app/src -name
'*.css'`, including `app/src/styles.css` itself.

**`src/**/*_CSS` export modules (16 files):**

- `src/routes/auth.css.ts` → `AUTH_CSS`
- `src/routes/docs-site.css.ts` → `DOCS_SITE_CSS`
- `src/routes/portal/portal.css.ts` → `PORTAL_CSS`
- `src/routes/public/cfp.css.ts` → `CFP_CSS`
- `src/routes/public/css/agenda.css.ts` → `AGENDA_CSS`
- `src/routes/public/css/cards.css.ts` → `CARDS_CSS`
- `src/routes/public/css/chrome.css.ts` → `CHROME_CSS`
- `src/routes/public/css/empty.css.ts` → `EMPTY_CSS`
- `src/routes/public/css/rail.css.ts` → `RAIL_CSS`
- `src/routes/public/home.css.ts` → `HOME_CSS`
- `src/routes/public/programme.css.ts` → `PROGRAMME_CSS`
- `src/routes/public/public.css.ts` → `PUBLIC_CSS`
- `src/routes/tools.css.ts` → `TOOLS_CSS`
- `src/views/bare-page.css.ts` → `BARE_PAGE_CSS`
- `src/views/error-states.css.ts` → `ERROR_STATES_CSS`
- `src/views/theme.ts` → `THEME_CSS` (the file the old filename-glob shape
  would have dropped)

None of these 15 SSR `*_CSS` exports other than `THEME_CSS` carried an
offender this wave (their `chq-` control classes either declare
`font-family` already, or none of the `chq-` tokens they style are ones
`app/src/**/*.tsx` ever applies to a `<button>/<input>/<select>/<textarea>`
tag — the test's control-class enumeration is unchanged from before this
task, scoped to `app/src/**/*.tsx`, per the task's stated file ownership).

## Measured truth (house technique: `tsx` on a scratch copy, before touching the test)

Offender count under the full 41-file population, before any fix: **40**.
After fixing the 6 offenders in unowned sheets (below): **34**. The test's
ceiling is seeded at 34 (`toBeLessThanOrEqual`, so future waves can only
tighten it, never widen it silently).

## Ownership check

Ownership derived from `git diff --name-only $(git merge-base main
<branch>)..<branch>` over every `v12m-*` branch listed by `git branch
--list 'v12m-*'` in the target repo, run once against the 13 offending
files, at task run time (branches merge and worktrees advance between
waves — this is not a durable snapshot).

## Offenders fixed this wave (unowned by any unmerged `v12m-*` branch)

All three fixed with `font-family: inherit;` added to the existing rule
body — the pattern already established at dozens of other control
selectors in both `app/src/styles.css` and `src/views/theme.ts`. No
selector was widened; no font-size/font-weight/color changed; desktop pins
unaffected.

| File | Selector | Fix |
| --- | --- | --- |
| `app/src/pages/comms/templates.css` | `.chq-comms-templates-breadcrumb` | `font-family: inherit;` added |
| `app/src/pages/comms/templates.css` | `.chq-btn-small` | `font-family: inherit;` added |
| `app/src/pages/speakers/task-view.css` | `.chq-taskview-clear` | `font-family: inherit;` added |
| `app/src/pages/speakers/task-view.css` | `.chq-taskview-open` | `font-family: inherit;` added |
| `src/views/theme.ts` (`THEME_CSS`) | `.chq-btn-secondary` | `font-family: inherit;` added |
| `src/views/theme.ts` (`THEME_CSS`) | `.chq-btn-tertiary` | `font-family: inherit;` added |

## Offenders left for their owning branch (34, seeded as the ceiling)

Each row's owner is the first `v12m-*` branch found (at task run time)
whose diff against `git merge-base main <branch>` touches that file. A
file can have multiple owners in-flight; only one is listed (the file is
in-scope for that branch either way — this task does not touch it, per
"fix offenders ONLY in sheets no unmerged branch owns").

| File | Selector | Owning branch (one of, at run time) |
| --- | --- | --- |
| `app/src/pages/comms/comms.css` | `.chq-comms-history-breadcrumb` | v12m-w11-i / v12m-w12-e |
| `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-pipeline-card-fit-edit` | v12m-w10-i |
| `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-merge-not-duplicate` | v12m-w10-i |
| `app/src/pages/content/content.css` | `.chq-content-version-delete` | v12m-w11-c / v12m-w11-i / v12m-w12-b / v12m-w12-e |
| `app/src/pages/content/content.css` | `.chq-content-detail-back` | v12m-w11-c / v12m-w11-i / v12m-w12-b / v12m-w12-e |
| `app/src/pages/content/content.css` | `.chq-content-files-breadcrumb` | v12m-w11-c / v12m-w11-i / v12m-w12-b / v12m-w12-e |
| `app/src/pages/forms/forms.css` | `.chq-forms-add-question` | v12m-w10-f / v12m-w11-c / v12m-w11-j / v12m-w12-b / v12m-w12-f |
| `app/src/pages/forms/forms.css` | `.chq-forms-field-drag` | v12m-w10-f / v12m-w11-c / v12m-w11-j / v12m-w12-b / v12m-w12-f |
| `app/src/pages/overview/overview.css` | `.chq-overview-section-action` | v12m-w11-j / v12m-w12-f |
| `app/src/pages/overview/overview.css` | `.chq-overview-btn-primary` | v12m-w11-j / v12m-w12-f |
| `app/src/pages/review/review.css` | `.chq-review-plan-row .chq-pill` | v12m-w10-g / v12m-w11-c / v12m-w11-h / v12m-w12-b / v12m-w12-d / v12m-w15-a |
| `app/src/pages/review/review.css` | `.chq-review-queue-footer-showall` | v12m-w10-g / v12m-w11-c / v12m-w11-h / v12m-w12-b / v12m-w12-d / v12m-w15-a |
| `app/src/pages/review/review.css` | `.chq-forms-field-drag` (also styled here) | v12m-w10-g / v12m-w11-c / v12m-w11-h / v12m-w12-b / v12m-w12-d / v12m-w15-a |
| `app/src/pages/review/review.css` | `.chq-review-queue-row-undo` | v12m-w10-g / v12m-w11-c / v12m-w11-h / v12m-w12-b / v12m-w12-d / v12m-w15-a |
| `app/src/pages/review/review.css` | `.chq-review-editor-footer-delete` | v12m-w10-g / v12m-w11-c / v12m-w11-h / v12m-w12-b / v12m-w12-d / v12m-w15-a |
| `app/src/pages/settings/settings.css` | `.chq-settings-section-action` | v12m-w10-e / v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/settings/settings.css` | `.chq-settings-inline-action` | v12m-w10-e / v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/settings/settings.css` | `.chq-settings-portal-add-resource` | v12m-w10-e / v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-toolbar .chq-input, .chq-speakers-toolbar .chq-select` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-task-edit` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-participation-menu-item` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-participation-menu-item.is-current` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-participation-menu-action` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-remind-one` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-invite-one` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/speakers/speakers.css` | `.chq-speaker-detail-task-remind` | v12m-w11-c / v12m-w12-b / v12m-w12-g |
| `app/src/pages/submissions/detail.css` | `.chq-detail-participant-row-actions .chq-link-button` | v12m-w1-h / v12m-w12-g |
| `app/src/pages/submissions/detail.css` | `.chq-review-criteria-toggle` | v12m-w1-h / v12m-w12-g |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-filterbar-search` | v12m-w10-f |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-filterbar-select` | v12m-w10-f |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-clone` | v12m-w10-f |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-viewtab` | v12m-w10-f |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-viewtabs-save` | v12m-w10-f |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-viewtabs-delete` | v12m-w10-f |

The fix for every row above is the same shape as the six already applied:
add `font-family: inherit;` (or the sheet's already-established
`--chq-font-*` token) to the existing rule body, never widen the selector.
A future wave should re-run the population scan (the test's own offender
list, with `console.log`) before spending a lane on this list — several of
the listed branches may have landed the fix as a side effect of their own
work by then, which would shrink the ceiling on its own.
