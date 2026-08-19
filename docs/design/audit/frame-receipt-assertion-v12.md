# A frame receipt must assert about the tree, not about the frame (v12m-w2-e)

DEC-967's wave-57 amendment gave the tree `tautological-assertion.scan.test.ts`,
which catches `expect(X).toBe(X)` with an identical literal on both sides and
says, in its own header, that there is exactly one such offender by design —
no allowlist. The wave-99 amendment names the shape that scan is blind to: an
`it()`/`test()` block that cites `docs/design/<file>.dc.html:<line>`, reads
that exact line back out of the design file, and then asserts a regex against
that **same design-file string**. Nothing in the assertion ever touches the
app. Such a test passes forever regardless of what actually renders — a
citation with a receipt stapled to itself, not to the tree.

A second derived `it()` block was added to `tautological-assertion.scan.test.ts`
(same file, per the task's file ownership) that measures this directly:

- **Population**: every `*.test.ts`/`*.test.tsx` under `app/src/` and `test/`
  (recursive `readdirSync`, DEC-808 — never a hand-listed manifest).
- **Subject**: every `it(...)`/`test(...)` block (found via balanced-brace
  scanning over a context-aware string/comment/regex mask, not a bare regex)
  whose own title, or any enclosing `describe(...)` title, carries a
  `docs/design/<Name>.dc.html:<digits>` citation. A citation appearing only
  inside a `//`/`/* */` comment does not count (comments are prose and may
  legitimately quote a frame without making a testable claim about it).
- **Rule**: at least one `expect(...)` in the block's own body text must take
  a subject that resolves — via textual `const IDENT = RHS` tracing, local
  scope first then true module-top-level scope — to a repo artefact: a
  `readFileSync`/import of a path outside `docs/design`, or a render/DOM
  query (`screen.`, `getBy`/`queryBy`/`findBy`, `within(`, `render(`). A
  block whose every `expect()` subject resolves only to a design-file read
  is an offender.
- **Shape**: a two-sided ceiling (`FRAME_RECEIPT_OFFENDER_CEILING`,
  `toBeLessThanOrEqual`, so it can only tighten), never an allowlist. A floor
  test asserts the citation-carrying population is non-empty (200+ blocks
  measured) so a citation regex that silently stops matching fails loudly
  instead of passing over an empty set.

This is a **house-technique heuristic scan**, not a real type-checker:
identifier resolution is textual and gives up after 6 hops. It can both
under- and over-count relative to true JS semantics; the ceiling is a
measured snapshot of this branch, not an aspiration.

## Closure (v12m-w3-m, wave 103)

The population reached **0** and stays there. By the time this task ran, the
two `settings-phone-390.frames.test.ts` offenders (#1/#2 below) had already
left the population — `v12m-w2-a` built their controls and `v12m-w2-l`
receipted them, dropping the ceiling 5 → 3 on main ahead of this task. The
three that remained were the "frame container is the standard 390x844 phone
card" sanity checks (#3–#5 below), each of which read a `dc.html` line and
asserted only against that same string, in a `describe` block whose sibling
`it()`s already build and assert against the real rendered page.

Each of the three got a real, tree-anchored assertion added to the *same*
`it()`, alongside the untouched frame-line read (which now serves only as
the citation's receipt, per the task's framing):

- `test/portal-remaining-phone-frames.test.ts:54` ("Portal · Resources",
  `:1561`) — now also asserts the rendered `ResourcesPage` output carries
  `class="chq-portal-shell"`, and that `portal.css.ts`'s appended
  `@media (max-width: 700px)` block (the one this same test file's other
  blocks already isolate via the `APPENDED` marker slice) both exists and
  contains a `.chq-portal-shell` rule — i.e. the frame's 390 width maps onto
  a real narrower-than-700 override that the rendered page's own top-level
  class is subject to.
- `test/portal-remaining-phone-frames.test.ts:123` ("Portal · co-presenter
  rejected", `:1304`) — same shape, against the rendered `EditPage` output.
- `test/portal-session-phone-frames.test.ts:149` ("Portal · Edit your
  session", `:600`) — same shape, against `PORTAL_CSS`'s
  `@media (max-width: 700px)` block (via this file's own `phoneBlock`
  helper) and the rendered `EditPage` output.

`FRAME_RECEIPT_OFFENDER_CEILING` is lowered **3 → 0** in
`app/src/tautological-assertion.scan.test.ts`; its doc comment now states the
true population (0) and what the ceiling means there: any newly-matching
block is a regression, with no remaining allowance to spend. The
`known-good: settings-phone-390.frames.test.ts:236 …` sentinel (which had
already gone red on main, re-pointed nowhere — DEC-967 wave 103: a
live-offender sentinel is deleted when its population empties, never
re-pointed at another live offender) is deleted; the existing synthetic
`POSITIVE control`/`NEGATIVE control` blocks a few lines above it (each
writes its own offender/non-offender into a tmpdir) remain as the
scan's anti-vacuity guard.

## The offenders as measured before this task (5, now 0)

| # | File:line | `it()` title | Owner | Status |
|---|---|---|---|---|
| 1 | `app/src/pages/settings/settings-phone-390.frames.test.ts:236` | "reads the frame's 46px filled full-width \"New token\" action (gap: read-drilled view does not yet render it)" | v12m-w2-a | **Closed** — control built and receipted before this task ran; left the population at ceiling 5→3. |
| 2 | `app/src/pages/settings/settings-phone-390.frames.test.ts:260` | "reads the frame's 46px filled full-width \"Invite someone\" action (gap: read-drilled view does not yet render it)" | v12m-w2-a | **Closed** — same as above. |
| 3 | `test/portal-remaining-phone-frames.test.ts:54` | "frame container (:1561) is the standard 390x844 phone card" | v12m-w3-m (this task) | **Closed** — real assertion added, see above. |
| 4 | `test/portal-remaining-phone-frames.test.ts:123` | "frame container (:1304) is the standard 390x844 phone card" | v12m-w3-m (this task) | **Closed** — real assertion added, see above. |
| 5 | `test/portal-session-phone-frames.test.ts:149` | "frame container (:600) is the standard 390x844 phone card" | v12m-w3-m (this task) | **Closed** — real assertion added, see above. |
