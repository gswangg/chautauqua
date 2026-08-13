# Design decisions

One file per decision, named `DEC-NNN.md` (three or more digits, e.g.
`DEC-001.md`, and `DEC-1000.md` onward once 001-999 are all taken), written
only by the swarm scribe from the planner's output. Format:

```markdown
# DEC-NNN: <title>

<rationale — why this decision, what alternatives it forecloses>
```

Every decision is also rendered as a compile-checked constant in
`src/decisions.ts`; code that depends on a decision references its constant so
deleting the decision breaks the build.
