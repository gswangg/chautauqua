# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-30 (DEC-002..999, space FULL no DEC-1000+; rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic
  SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED
  SURFACE NEVER PAGED. TOOL TRAP: Grep -C drops some `/`. LINE NUMBER IS
  NOT AN IDENTITY. A UNIVERSAL NEEDS A POPULATION (DEC-829/773).
- FINDINGS w31-36 (heavily compacted): A RECORDED RULING IS NOT A LANDED
  FIX (DEC-358/773/338); AN ABSENCE IS A MEASUREMENT (DEC-358 w35, loose
  ref beats stale packed-refs); ONE DOOR IS NOT A POPULATION (DEC-099 w35,
  needs enumeration + negative control); RANKING IS PER-POPULATION
  (DEC-829); A SNAPSHOT IS NOT A STATE (DEC-069 w36, re-read refs at END of
  planning); A GATE INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069 w36) —
  wave 36 froze src/app/migrations/package.json so receipts share one
  product sha; A RECEIPT NAMES THREE SHAS (DEC-644 w36); A CREDITED ROW FOR
  A SELECTOR THE INSTRUMENT NEVER ENUMERATES IS AN INSTRUMENT GAP (DEC-426
  w36). Verification-log sections are appended as NEW files under
  `docs/verification-log/index/` (`--next-seq`), then assembled; never
  hand-edit docs/verification-log.md.
- FINDINGS w37 (compacted): A BRANCH MINUTES OLD AT ITS BASE IS RUNNING,
  NOT DEAD (DEC-069 w37). WAVE 37 WAS THE SECOND FROZEN WAVE (docs/scripts
  only). THE ASSEMBLER MINTS COLLIDING SEQS BY CONSTRUCTION (DEC-068 w37):
  `nextSeq()` reads only the highest prefix; on conflict take NEITHER side,
  re-run `tsx scripts/assemble-verification-log.ts`. A UNIVERSAL WITH NO
  FAILING CASE IS NOT A MEASUREMENT (DEC-099 w37): every derived population
  ships a NEGATIVE CONTROL; known violations go in a RATCHET, never an
  allowlist. A RECEIPT BLOCK IS GENERATED (DEC-644 w37): `scripts/ref-state.ts`,
  read refs via `git for-each-ref`. DEC-296 w37: dev-loopback exception
  needs loopback evidence ON THE REQUEST; walkthrough now pre-flights.
- FINDINGS w38 (main `494b6c01` = scribe wave 37; w37-a/-c COMMITTED-UNMERGED,
  w37-b/-d/-e AT BASE AND RUNNING — scope NOT re-filed; `scripts/exit-predicate.ts`/
  `ref-state.ts` still absent, theirs). WAVE 38 IS A CODE WAVE AND VOIDS THE
  BATTERY IT INHERITS (DEC-069 w38): four tree-verified defects beat one
  preserved gate reading; wave 39 must re-run all four gates FROZEN. No
  code lane writes `docs/verification-log/**`.
- A BUDGET KEYED ON A VICTIM IS A WEAPON AIMED AT THE VICTIM (DEC-072 w38):
  w54/w66 flip-flopped bare-email vs email|ip because BOTH hard
  pre-verification denials lock the owner out. Settled: the account bucket
  is a FAILURE budget — never skip verification, refuse only a failed one.
  Precedent already in-tree: `src/routes/account.tsx:202-221`.
- A DAY-LABEL FIELD FED AN INSTANT IS A TYPE ERROR THE COMPILER CANNOT SEE
  (DEC-801/DEC-522 w38): six surfaces piped `effectiveAssignmentDueDate`'s
  grace INSTANT into `formatCalendarDate`/`dayLabelEndInstant`. Fix is
  structural — UN-EXPORT the instant form; a comment about which callers
  must convert is the fragile shape.
- A CSRF-EXEMPT CREDENTIAL IS AN ESCALATION (DEC-027 w38): `csrfJson` is
  bearer-exempt, so every route without `requireCookieSession` is
  bearer-reachable — `POST /api/v1/users` + `/reset-password` returned
  plaintext passwords to a bearer client while `tokens.ts` kept the correct
  guard PRIVATE. A guard that lives in one file guards one file.
