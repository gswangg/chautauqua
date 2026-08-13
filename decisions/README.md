# Design decisions

One file per decision, named `DEC-NNN.md` (three digits, e.g. `DEC-001.md`),
written only by the swarm scribe from the planner's output. Format:

```markdown
# DEC-NNN: <title>

<rationale — why this decision, what alternatives it forecloses>
```

Every decision is also rendered as a compile-checked constant in
`src/decisions.ts` (a barrel that re-exports the range-scoped modules under
`src/decisions-data/`); code that depends on a decision references its
constant so deleting the decision breaks the build. `src/decisions-data/*`
stays strictly 1:1 with `decisions/*.md` — exactly one exported `DEC_NNN`
constant per `DEC-NNN.md` file, added only by the scribe's regeneration and
never hand-edited outside it. `test/decisions-parity.test.ts` enforces this
mechanically.

## The three-digit id space is CLOSED (wave 37 ruling)

`decisions/DEC-001.md` through `decisions/DEC-999.md` all exist — the
three-digit space (`DEC-001` .. `DEC-999`) is now full. No `DEC-1000.md` (or
any id outside `^DEC-\d{3}$`) will ever be created; the planner's own output
schema pins ids to that exact three-digit shape, and hundreds of source
comments and `void DEC_NNN` compile checks depend on existing ids staying
stable references. This supersedes any earlier note (in the field guide or
elsewhere) suggesting the space would be widened to `DEC-1000+`.

From wave 37 onward, a new design ruling is recorded as an
`## Amendment (wave N[, short context])` section **appended to the most
relevant existing `DEC-NNN.md` file** — never as a new file, and never by
overwriting or deleting an existing decision's body. `decisions/DEC-004.md`'s
`## Amendment (2026-08-11, stage-2 deploy)` section is the precedent this
convention formalizes. An amendment adds no new `DEC_` constant to
`src/decisions-data/*` — the amended decision's existing constant (e.g.
`DEC_004`) still stands for the whole file, original body plus every
amendment appended to it.
