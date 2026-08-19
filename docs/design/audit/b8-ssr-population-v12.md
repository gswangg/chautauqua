# B8 SSR population widening (DEC-808 wave-99 amendment)

Task v12m-w2-c. DESIGN-RULINGS B8 ("interaction-states standard") governs
the whole product, but two of its enforcement scans only ever walked the
SPA (`app/src`):

- `app/src/interaction-states.scan.test.ts` enumerated `app/src/**/*.css`
  only.
- `app/src/select-caret.scan.test.ts` walked `app/src/**/*.tsx` only.

Both scans are now widened to cover the SSR half of the tree (`src/`).
This document names every offender the widened populations surface and an
owner for each, so the audit can shrink instead of sitting as an
unactioned ledger (field-guide doctrine: "an audit naming no owner never
shrinks").

## Population derivation

- **interaction-states**: SSR population = every `.ts`/`.tsx` module under
  `src/` whose text matches `export const [A-Z_]+_CSS\s*=` (read by
  export, not by a `*.css.ts` filename glob — that glob is exactly what
  drops `src/views/theme.ts`, whose extension is plain `.ts`). 16 modules
  found:
  `src/routes/auth.css.ts`, `src/routes/docs-site.css.ts`,
  `src/routes/portal/portal.css.ts`, `src/routes/public/cfp.css.ts`,
  `src/routes/public/css/agenda.css.ts`,
  `src/routes/public/css/cards.css.ts`,
  `src/routes/public/css/chrome.css.ts`,
  `src/routes/public/css/empty.css.ts`,
  `src/routes/public/css/rail.css.ts`, `src/routes/public/home.css.ts`,
  `src/routes/public/programme.css.ts`, `src/routes/public/public.css.ts`,
  `src/routes/tools.css.ts`, `src/views/bare-page.css.ts`,
  `src/views/error-states.css.ts`, `src/views/theme.ts`.
- **select-caret**: population extended from `app/src/**/*.tsx` to also
  walk `src/**/*.tsx`. The caret-element matcher now accepts both
  `className="...-caret"` (React/SPA) and `class="...-caret"` (Hono
  SSR JSX) spellings.

## Offenders found

### 1. `src/routes/public/css/chrome.css.ts` — missing reduced-motion re-bind

**Finding:** `button.chq-pub-search-submit[type=submit]` declares
`transition: background-color var(--chq-motion-color);` (the transitioned
property is on the allowed colour-only list — no property/`all`/easing
violation) but the module carried no `prefers-reduced-motion: reduce`
block of its own, unlike its SPA-side sibling shape
(`app/src` sheets each satisfy this at their shared `styles.css` root;
`src/routes/public/home.css.ts` satisfies it locally per DEC-582's
pattern).

Note: `--chq-motion-color` is already re-bound to `0ms` globally by
`src/views/theme.ts:705-711` (`THEME_CSS` is inlined ahead of
`PUBLIC_CSS`/`CHROME_CSS` on every page per `shell.tsx`), so the token
itself was never literally unreduced in the shipped page. The widened
scan still requires each transitioning module to carry its own re-bind
(the rule applied per-module, matching the home.css.ts precedent) rather
than relying on load-order coupling to a different file.

**Owner:** fixed in this wave (v12m-w2-c). No unmerged `v12m-*` branch
touches `chrome.css.ts` (`git diff --name-only
$(git merge-base main <b>)..<b>` over all 58 `v12m-*` branches: zero
matches). Added a scoped
`@media (prefers-reduced-motion: reduce) { button.chq-pub-search-submit[type=submit] { transition-duration: 0ms; } }`
block, mirroring `home.css.ts:89-95`'s per-selector re-bind shape.

### 2. select-caret: no bare `▾` offenders found under `src/`

The three `.tsx` files under `src/` that contain the `▾` glyph
(`src/routes/public/agenda-controls.tsx`,
`src/routes/public/sessions.tsx`, `src/routes/public/speakers.tsx`) carry
it only inside `//` comments describing frame labels (e.g. `"All days
▾"`), which `stripComments` removes before the scan runs. No `<select>`
or select-adjacent SSR markup renders a bare `▾` glyph as JSX text — the
conformant SSR mechanism is `src/views/theme.ts`'s `select { appearance:
none; ...; background-image: ...; }` rule (~line 385), which paints its
own caret via a background-image data URI on the native `<select>`
element rather than emitting a `▾` glyph, and is correctly out of this
scan's scope (documented in the test file's header so a future wave does
not "fix" it into a false positive).

**Owner:** no fix needed — zero live violations in this population.

## Guard changes (files owned by this task)

- `app/src/interaction-states.scan.test.ts`: added the SSR population
  (export-based enumeration), a vacuous-population tripwire naming
  `src/views/theme.ts`, per-SSR-module transition/easing/all checks, and
  a per-transitioning-SSR-module `prefers-reduced-motion` requirement.
- `app/src/select-caret.scan.test.ts`: widened the `.tsx` walk to include
  `src/**`, accepted both `className=`/`class=` spellings, added a
  vacuous-population tripwire asserting the SSR half of the walk is
  non-empty, and documented the conformant SSR caret mechanism
  (`theme.ts`'s `appearance:none` + background-image) as out of scope.

## Verification

- `npx vitest run app/src/interaction-states.scan.test.ts` — 184 tests,
  all green (SPA population unchanged in count; SSR population added).
- `npx vitest run app/src/select-caret.scan.test.ts` — 321 tests, all
  green.
- `npx vitest run test/theme.test.ts test/public-css.test.ts` — 37 tests,
  all green (unaffected, run per task's targeted-test scope).
- `npm run build` — green.
