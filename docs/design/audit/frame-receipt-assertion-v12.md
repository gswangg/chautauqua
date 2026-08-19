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
- **Shape**: a two-sided ceiling seeded to the measured count
  (`FRAME_RECEIPT_OFFENDER_CEILING = 5`, `toBeLessThanOrEqual`, so it can
  only tighten), never an allowlist. A floor test asserts the
  citation-carrying population is non-empty (209 blocks measured) and a
  known-good test pins one specific known offender, so a citation regex that
  silently stops matching fails loudly instead of passing over an empty set.

This is a **house-technique heuristic scan**, not a real type-checker:
identifier resolution is textual and gives up after 6 hops. It can both
under- and over-count relative to true JS semantics; the ceiling is a
measured snapshot of this branch, not an aspiration.

## The measured offenders (5)

| # | File:line | `it()` title | Owner | Status |
|---|---|---|---|---|
| 1 | `app/src/pages/settings/settings-phone-390.frames.test.ts:236` | "reads the frame's 46px filled full-width \"New token\" action (gap: read-drilled view does not yet render it)" | v12m-w2-a | Expected inside this ceiling — v12m-w2-a builds the "New token" control in the settings phone drill in the same batch. Once landed, lower the ceiling to 3. |
| 2 | `app/src/pages/settings/settings-phone-390.frames.test.ts:260` | "reads the frame's 46px filled full-width \"Invite someone\" action (gap: read-drilled view does not yet render it)" | v12m-w2-a | Same as above — "Invite someone" control, same batch, same lane. Lower the ceiling to 3 once landed. |
| 3 | `test/portal-remaining-phone-frames.test.ts:54` | "frame container (:1561) is the standard 390x844 phone card" | v12m-w5-a (portal remaining-frames lane) | A frame-anatomy sanity check (confirms the cited line really is a `width:390px; height:844px` frame opener) with no accompanying app-side assertion in the same block. The block's SIBLING `it()`s in the same `describe` do assert against the rendered `ResourcesPage`/`EditPage` output — only this one anatomy check itself is offending. Unbuilt work: none — give it a real assertion (e.g. fold it into the sibling receipt) or accept it as a structural sanity check outside this contract. |
| 4 | `test/portal-remaining-phone-frames.test.ts:123` | "frame container (:1304) is the standard 390x844 phone card" | v12m-w5-a (portal remaining-frames lane) | Same shape as #3, for the "Portal · co-presenter rejected" frame. |
| 5 | `test/portal-session-phone-frames.test.ts:149` | "frame container (:600) is the standard 390x844 phone card" | portal session-frames lane | Same shape as #3/#4, for the "Portal · Edit your session" frame — reads `docs/design/Chautauqua Public and Portal.dc.html` line 600 inline via `readFileSync(...).split("\n")[599]` and asserts only against that string. |

Offenders #3–#5 are a different sub-shape than #1–#2: not an unbuilt-control
gap, but a "frame container is the right size" sanity check that never
touches the app. They are real per the amendment's rule (every `expect()`
subject in that specific `it()` block resolves only to the design file) even
though the enclosing `describe()` as a whole is well-receipted by its other
`it()`s. Left as measured debt for their owning lanes to fold into a
sibling assertion or otherwise resolve — this task does not edit files it
does not own.
