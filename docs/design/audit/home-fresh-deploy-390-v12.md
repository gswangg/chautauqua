# Home · "Fresh deploy · phone" — first markup-level verdict (w30-i)

**Frame**: docs/design/Chautauqua Home.dc.html:302-321 ("Fresh deploy ·
phone", label at :299) — GET `/` on an org with zero listable events
(`src/lib/home-hub.ts`'s `hubState()` returns `"fresh"` whenever
`openCfp`/`published`/`past` are all empty, which covers both a seeded org
with no events and no org row at all).

**Why this task exists**: before it, the frame's only citer anywhere in the
tree was `test/home-phone-frames.test.ts`, a pure CSS-TEXT scan of
`HOME_CSS` — jsdom applies no stylesheet and dispatches no request, so
nothing in the tree had ever asserted that the root page's empty state
actually renders at 390 via a real `app.request('/')`. DEC-976's wave-28
amendment requires the SSR request as the primary verdict and names the
CSS-text scan its companion, never its substitute.

## Verdict: MATCHES — no code changes required

Every element the frame draws at :302-321 was already fully implemented,
across both `src/routes/root.tsx`'s markup and `src/routes/public/
home.css.ts`'s phone (`@media (max-width: 700px)`) block, by prior waves
(the wave-16 DEC-383 amendment and the w14-ee/wave-155 DEC-393 sweeps). This
task's `test/home-fresh-deploy-390-frame-verdicts.test.ts` supplies the
missing REQUEST-half receipt (a real `app.request('/')` graded against a
fake db that resolves an org row with zero events) alongside a small,
targeted SOURCE-TEXT companion for the phone-only rules this frame's tail
controls specifically need (the header Sign in link's 44px floor, the
tertiary "API docs ›" anchor's 44px floor — turning root.tsx:271-277's
already-quoted DEC-383 claim into a real assertion instead of a comment —
the primary Sign in chip's full-width stack, the footer credit link's 44px
floor, and the shell's sticky-footer flex contract). It does not duplicate
`test/home-phone-frames.test.ts`'s existing rule-by-rule CSS coverage of
this same frame.

Anatomy checked, frame line → product:

| Frame element | Frame line | Product |
|---|---|---|
| Org name | :304 (seeded data, graded by shape) | `.chq-home-org` span, `root.tsx:332` |
| Header "Sign in" | :305 | `.chq-home-signin` anchor → `/login`, `root.tsx:333-335` |
| "Nothing here yet" | :310 | `<h1>` literal, `root.tsx:351` |
| Empty-state body copy | :311 | `<p>` literal, `root.tsx:352` |
| Tail "Sign in" | :313 | `.chq-home-action-primary` anchor → `/login`, `root.tsx:379-381` |
| "API docs ›" | :314 | `.chq-home-action-tertiary` anchor → `/docs/api`, `root.tsx:382-384` |
| "Running on … Chautauqua" | :317 | `.chq-home-footer-text`/`.chq-home-footer-link`, `root.tsx:287-303` |

## Grade-by-shape note (not a divergence): the tail "Sign in" is a `<span>` in the frame, an `<a>` in the product

The frame draws its tail "Sign in" action (:313) as a bare `<span>`, matching
this design pack's general convention of drawing primary-action chips as
non-interactive spans in the static mockup — the SAME frame's own header
"Sign in" (:305) is drawn as a real `<a href="#">`, and
`test/home-account-docs-390-frame-verdicts.test.ts` already grades the
identical span-vs-anchor gap on the Event hub frame's "Submit a talk"/
"Browse sessions" chips as a non-divergence for the same reason. The real
route renders a functioning `.chq-home-action-primary` anchor to `/login`
there, which is required for the control to do anything at all — dropping
to a non-navigable span to chase byte-parity with the mockup chip would be
a regression, not a fix. Not filed as a DIVERGES row -- per DEC-099
wave-14m clause 1, this sentence records the ABSENCE of a divergence (a
pack-drawing convention, not a control gap), not an open finding.

## No DIVERGES rows filed

Every element this frame draws, and every phone-width rule its geometry
needs, was already present and correctly scoped inside `home.css.ts`'s one
terminal `@media (max-width: 700px)` block before this task started. This
task's `FILES YOU OWN` scope (`root.tsx`, `home.css.ts`'s terminal phone
block) therefore lands with zero production-code bytes changed — only the
new test file and this audit doc. Per DEC-099 wave-14m clause 1, this
heading and paragraph record a negative result (no divergence found), not
an open finding.
