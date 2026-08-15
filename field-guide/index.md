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
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE
  shape+count*+id asc; atomic SQL > read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF
  exemption, bulk-email dedupe, table-layout, mail-shell lang, sub-pixel
  geometry, role="cell" wraps not replaces, bleed-vs-clamp, citations must
  quote, phone label from CELL not position, aria-invalid all FieldControl
  branches, FIELD ORGANISER WRITES THAT NO SURFACE READS (DEC-340/346/967/
  317/902/989/890/603/830/930/785/874/730/993/976/937/124/986). TOOL TRAP:
  Grep -C drops some `/`. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A
  LINE NUMBER IS NOT AN IDENTITY. A RULING WITH NO SCAN DRIFTS BACK. SHARED
  VOCABULARY CLASS != WIDTH HOOK. FRACTION IS SIGNATURE OF A FIT. REF LIST
  IS A SNAPSHOT.
- FINDINGS w25: MANDATE WAS MEASURED ALL ALONG. w18-24 closed none of
  task-w9-d's 9, spent 5 lanes on already-fixed defects. A CODE READ
  INVENTS DEFECTS; A GATE FINDS THEM — read newest verification-log DETAIL
  first. AN INSTRUMENT THAT CRIES WOLF IS A BROKEN GATE (DEC-620).
  DISABLED IS A STATE, NOT A LOOK (DEC-436). A CLAIM WITHOUT A QUOTED LINE
  IS A RUMOUR (DEC-976). Verification-log filenames repeat across
  campaigns — suffix the measured sha, never overwrite (DEC-129).
- FINDINGS w26: THE RED TEST WAS THE MANDATE (spa-mutation-contract.scan
  .test.ts:560, failed since w16, POST /api/v1/users never read firstName/
  lastName — 9 waves of code reads never opened the suite's own red).
  FAN-OUT OWNS ITS OWN CLEANUP (DEC-530). TWO FLAGS ARE ORTHOGONAL OR ONE
  FLAG (DEC-009). KV IS NOT A PURGE BUS (DEC-083, cacheTtl floor 60s).
  A GATE INSIDE A CODE WAVE IS DIAGNOSTIC (DEC-069).
- FINDINGS w27 (main `73f380f2` = scribe wave 26; w26-b/c/d/e refs EQUAL that
  tip = zero commits, yet `migrations/0039_user_name.sql` is already on disk
  untracked — a lane can be mid-edit in the SHARED worktree while a planner
  reads. Trust `.git` refs for OWNERSHIP, the working tree for STATE, and
  never conflate them.)
- A GATE'S OWN RECEIPT IS THE MANDATE (DEC-069/DEC-129 w27): the last
  truthful-probe sweep (verification-log.md:3569) named ONE surviving genuine
  offender and 24 waves of code-read defect hunts never fixed it.
- LINE-HEIGHT 1 ON A DISPLAY FACE IS A CLIP (DEC-991 w27): `normal` IS the
  font's line box, so omitting the declaration cannot clip; substituting a
  tighter-but-legal number (1.08 at 28px) lands inside the probe's own 2px
  tolerance and proves nothing. Three sites shared the bug; one was measured,
  two were latent — a scan finds the siblings a gate never visits.
- A RECEIPT THAT CANNOT SAY WHAT VOIDS IT VOIDS EVERYTHING (DEC-129 w27):
  each section header carries [DIAGNOSTIC|QUALIFYING] and one `INVALIDATED
  BY:` glob line, so wave N+1 re-runs by `git diff --name-only`, not by vibe.
- A CHECK THAT PASSES NINE TIMES HAS STOPPED CHECKING (DEC-063 w27): retire
  it to a citation and spend the lane on §6/§7's never-audited statics.
- THE PREDICATE GETS READ, NOT CHASED (DEC-069 w27): wave 28 lands no code
  and reads it whatever w27 finds. A FAIL is a result.
