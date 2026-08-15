# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-30 (DEC-002..999, space FULL no DEC-1000+;
  rulings land as `## Amendment (wave N)` on nearest EXISTING DEC):
  pure-core no node:/cf; Hono sub-apps; errors {error:{code,message,
  fields?}}; bulk ops set-based; D1 PRIMITIVES; pagination ONE
  shape+count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A UNIVERSAL NEEDS A
  POPULATION. TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-42 (compacted): loose ref beats stale packed-refs; A GATE
  INSIDE A CODE WAVE CAN NEVER QUALIFY, A CODE WAVE VOIDS THE BATTERY / A
  PASSING SLOT TOO (DEC-069); RECEIPT via `scripts/ref-state.ts`, ONE
  MACHINE ONE HEAVY GATE share `/tmp/chq-test.lock`, `CHQ_TEST_LOCK_HELD`
  guards nesting (DEC-644); A UNIVERSAL NEEDS A NEGATIVE CONTROL, RATCHET
  not allowlist, RESULT TOKEN IS PART OF THE CONTRACT —
  `startsWith("PASS")` em-dash not hyphen, A SCOPE WORD IS A SLOT CLAIM
  via `classifyScope` (DEC-099); ASSEMBLER/PLANNER MINTS COLLIDING SEQS ->
  take NEITHER side, re-run, `--next-seq` collides (DEC-068); A BRANCH
  MINUTES OLD AT BASE IS RUNNING NOT DEAD (DEC-069); verif-log sections
  are NEW files, never hand-edit the monolith; A BUDGET KEYED ON A VICTIM
  IS A WEAPON (DEC-072); CSRF-EXEMPT WITHOUT `requireCookieSession` IS
  BEARER-REACHABLE (DEC-027); LOCAL-D1 FIXUP IS A MEASUREMENT, COMMITTED
  ONE IS A FIX (DEC-453); LAND LAST OFFENDER THEN FREEZE, CONTRACT NEEDS
  AN INSTRUMENT NOT A MEMO -> exit-predicate-corpus.test.ts (DEC-069/099);
  clarifications.md got its first derived test (DEC-518); ONE FILE ONE
  OWNER PER WAVE (DEC-358); THE BATTERY LANDED, THE SLOT DID NOT — 4/5
  gate PASS is not 5/5, missing triage-closure VOIDS predicate (DEC-069
  w42). Fixed in-tree by w42: review-lens alarms, task-w17-i's DEC-716
  scope, plans-progress `total`.
- FINDINGS w43 (main `824aac9b` = scribe w42 + 2 merge-train fixes; packed
  `refs/heads/main` `42074604` still stale). THE FOURTH FREEZE IS THE TRAP
  (DEC-069 w43): waves 41/42/43 each planned while prior lanes still
  RUNNING, inheriting "freeze, battery in flight" — that loop never
  converges, the ledger reads only after lanes land, always after the
  next planner runs. NO w42 lane merged (`task-w42-b` has no ref, its
  verdict never published). A PLANNER'S OWN READ ENDS THE FREEZE, NOT A
  LEDGER: 3 defects confirmed at file:line make `OPEN ITEMS: 0`
  impossible, so w43 is a CODE wave, w44 is the FROZEN battery wave. TWO
  READERS ONE RULE THREE SPELLINGS (DEC-615): `auto-schedule.ts:58`
  splits on `slot !== null`, `payload.ts:59` on `isDayWithinEventRange` —
  that gap IS ledger 0195's 298-vs-237; a count and its itemized list
  must share ONE population. MERGE MAINTAINS IT, DELETE MUST TOO
  (DEC-979): `deleteContact` ignored `email_log`/`file`/`file_comment` in
  `CONTACT_FK_TABLES`; no D1 FK constraints means nothing catches it —
  NULL the nullable ref, never delete an audit row. A PER-PAIR GUARANTEE
  IS NOT AN OPERATION GUARANTEE (DEC-026): `mergeContacts` commits per
  pair, so a 409 on pair k ships 1..k-1 destroyed; hoist every refusal
  over the WHOLE id list before any write (logins as a set; merged email
  changes each step). ADJUDICATE, DON'T ACCRETE: DEC-932 back-fill and
  DEC-020 reopen ruled DELIBERATE with pinning tests; 0197's base-URL gap
  CLOSED by `hostHeaderLoopbackOrigin` (`origin.ts:158-163`) — all three
  need falsifying checks, not more filings. ALREADY FIXED, DO NOT RE-FILE:
  review-lens alarms `users.ts:67,138,168`, `reminders.ts:148`, `rule-match.ts:145`, plans-progress `total`.
