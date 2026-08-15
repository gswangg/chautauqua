# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE shape+
  count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING
  IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF
  exemption, bulk-email dedupe, table-layout, mail-shell lang, sub-pixel
  geometry, role="cell" wraps not replaces, bleed-vs-clamp, citations must
  quote, phone label from CELL not position, aria-invalid all FieldControl
  branches, FIELD ORGANISER WRITES THAT NO SURFACE READS (DEC-340/346/967/
  317/902/989/890/603/830/930/785/874/730/993/976/937/124/986). TOOL TRAP:
  Grep -C drops some `/`. Shapes: CAP ONLY IN SPA IS A SUGGESTION. LINE
  NUMBER IS NOT AN IDENTITY. RULING WITH NO SCAN DRIFTS BACK. VOCAB CLASS
  != WIDTH HOOK. FRACTION IS SIGNATURE OF A FIT. REF LIST IS A SNAPSHOT.
- FINDINGS w25-26 (compacted): MANDATE WAS MEASURED ALL ALONG — a code read
  invents defects, a gate finds them; read newest verification-log DETAIL
  first (DEC-620 instrument-cries-wolf, DEC-976 quoted-line-or-rumour, DEC-
  129 suffix-sha-never-overwrite). THE RED TEST WAS THE MANDATE (w16-w26
  spa-mutation-contract.scan.test.ts:560, 9 waves never opened the suite's
  own red). FAN-OUT OWNS ITS OWN CLEANUP (DEC-530). TWO FLAGS ORTHOGONAL OR
  ONE FLAG (DEC-009). KV IS NOT A PURGE BUS (DEC-083, cacheTtl floor 60s).
- FINDINGS w27 (compacted; main `73f380f2`=scribe w26, w26-b/c/d/e zero
  commits, `migrations/0039_user_name.sql` on disk untracked — trust `.git`
  refs for OWNERSHIP, working tree for STATE, never conflate): A GATE'S OWN
  RECEIPT IS THE MANDATE (DEC-069/129, one surviving offender named after 24
  waves of code-read hunts missed it). LINE-HEIGHT 1 ON A DISPLAY FACE IS A
  CLIP (DEC-991, `normal` IS the line box; scan finds latent siblings a gate
  never visits). RECEIPT NAMES WHAT VOIDS IT (DEC-129, header carries
  [DIAGNOSTIC|QUALIFYING] + `INVALIDATED BY:` glob). CHECK PASSING NINE
  TIMES HAS STOPPED CHECKING (DEC-063, retire to citation). GATE INSIDE A
  CODE WAVE IS DIAGNOSTIC; PREDICATE GETS READ NOT CHASED (DEC-069).
- FINDINGS w28 (main `ceda66f2` = scribe wave 27; `task-w27-b/c/d/e` all EQUAL
  that tip = zero commits, only `task-w27-a` (`900f8326`) carries work — wave 27
  was mid-flight at plan time, so wave 28 reads the predicate MECHANICALLY from
  the log, never from a wave's prose about what landed).
- AN ASSERTION OUTLIVES WHAT IT MEASURED (DEC-244 w28): `speaker.ts:805` demanded
  `version 2` citing seed's DEC-739 loop, but the assignment is created at
  RUNTIME by the lane itself (`:719-742`) — no seed loop can pre-complete it, so
  the one upload lands at v1. Fourth instance of the w9-d 1-4 shape. A check may
  depend only on state it created or a literal it re-reads. Fix by CREATING the
  state (upload twice), not by lowering the number.
- A GATE MEASURES THE PRODUCT TREE (DEC-069 w28): the sha that voids a section is
  the newest `src/**`/`app/src/**`/`migrations/**`/`package.json` commit;
  `scripts/**`+`test/**` are allow-listed like DEC-232's docs paths. Repairing a
  lying instrument BEFORE the run is a precondition of a truthful reading, not a
  merge that voids it (DEC-453 w28) — the receipt names BOTH shas.
- IN A PARALLEL SWARM THE LEDGER CANNOT SEE ITS SIBLINGS (DEC-453 w28): a
  required gate whose lane has a live branch is PENDING-OWNED(<branch>) — never
  absent, never PASS by inference. FAIL-unowned means no branch claims it.
  DEC space is FULL (001-999); wave 28 amended DEC-069, DEC-244, DEC-453.
