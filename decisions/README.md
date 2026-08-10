# Design decisions

One file per decision, named `DEC-NNN.md` (three digits, e.g. `DEC-001.md`),
written only by the swarm scribe from the planner's output. Format:

```markdown
# DEC-NNN: <title>

<rationale — why this decision, what alternatives it forecloses>
```

Every decision is also rendered as a compile-checked constant in
`src/decisions.ts`; code that depends on a decision references its constant so
deleting the decision breaks the build.
