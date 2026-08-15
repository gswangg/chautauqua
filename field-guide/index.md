# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE shape+
  count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING
  IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-30 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, role="cell" wraps not
  replaces, bleed-vs-clamp, citations must quote. TOOL TRAP: Grep -C drops
  some `/`. LINE NUMBER IS NOT AN IDENTITY. A COUNT IS NOT A LICENCE TO
  SCAN (DEC-829/773); A REFUSAL THAT PROTECTS A SIDE EFFECT CAN LOCK THE
  MAIN EFFECT (DEC-720/317); A UNIVERSAL NEEDS A POPULATION; A DESKTOP
  PASS CAN'T SEE A PHONE-ONLY COMPONENT'S ERRORS.
- FINDINGS w31-34 (compacted): A RECORDED RULING IS NOT A LANDED FIX
  (DEC-358/773/338) — re-check refs each wave. "ONE ROUND TRIP PER VIEW"
  HAS A SERVER+PUBLIC+WRITE SIDE (DEC-338/774/155/598): indep. repo calls
  as one Promise.all wave, proven w/ instrumented fake Db; doors incl.
  `/plans/:id/progress`, `/portal/submissions/:id`, `dispatch.tsx`,
  agenda GET, portal `/tasks`, submission validators. PROMISE.ALL CHANGES
  WHICH ERROR WINS: `allSettled` + re-throw SOURCE order. HYDRATION IS
  PER-PAGE; RANKING IS PER-POPULATION (DEC-829). A PER-ID LOOP IS NOT A
  BATCH — `chunkIds` (`src/lib/chunk.ts`). AN INVARIANT A COMMENT ASSERTS
  AND CODE ONLY ASSUMES IS A FALLBACK (DEC-170). A CHECK WITH A SHAPE
  HOLE IS WHY THE DOC DRIFTED (DEC-618, `audit-claims`). A GUARD
  JUSTIFIED BY A FALSE MECHANISM INVITES ITS OWN REMOVAL (DEC-060: Hono
  DOES merge mount prefix) — real enforcement = `role-refusal-
  probe.test.ts`. STALE-ON-MEASUREMENT, do not re-file: chunked-
  urlencoded body limit, `logoUrl` XSS (`safeImageSrc`), content-note
  zero-recipient 400, AUDIT compose cap (100), acceptance task fan-out
  (DEC-932 DELIBERATE), `.chq-review-checkbox-label` contrast 3.09
  EXEMPT-BY-RULE (DEC-426), mobile console-error collection landed
  (DEC-253), `task-w27-g-fidelity-recheck-ceda66f2.md` DOES exist.
- FINDINGS w35 (main `c9532d9a` = "merge task-w34-b"): ALL w32+w33
  lanes MERGED and deleted; only `task-w34-b` (Vary: Cookie) is in the
  tree — `task-w34-a/-c/-d/-e` sat at `e0b02a45` (zero-commit), w35
  files none of their scope.
- A BRANCH-LOCAL PASS IS NOT A CLOSURE (DEC-644 w35): w32-a measured
  `plan results` PASS w/ reviewer.ts unfixed; w32-b measured `reviewer
  queue` PASS w/ shared.ts unfixed — two readings, zero of the shipped
  tree. A row closes only at a boundary carrying every fix credited
  with closing it. Same for w29-c/-d's sweep rows.
- AN ABSENCE IS A MEASUREMENT (DEC-358 w35): re-glob every "file X
  does not exist" claim before carrying it; unre-globbed, delete it.
  `.git/packed-refs` can hold a STALE `refs/heads/main` — loose wins.
- ONE DOOR IS NOT A POPULATION (DEC-099 w35): `setCacheHeaders` is ~15
  hand-placed calls; universal needs route-table enumeration w/ negative
  control. A NAMED SET IN SPEC IS A POPULATION (DEC-063 w35): §9's four
  invariants live in one greppable file. A SURFACE WITH NO PERF ROW IS
  OPTIMISED BLIND (DEC-338 w35): portal took two scheduling rewrites
  (w33, w34) w/ zero rows and no speaker session in `perf-smoke.ts`.
