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
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, role="cell" wraps not
  replaces, bleed-vs-clamp, citations must quote. TOOL TRAP: Grep -C drops
  some `/`. LINE NUMBER IS NOT AN IDENTITY. RULING WITH NO SCAN DRIFTS BACK.
- FINDINGS w25-30 (compacted): MANDATE WAS MEASURED ALL ALONG (DEC-620/976/
  129); THE RED TEST WAS THE MANDATE; FAN-OUT OWNS ITS OWN CLEANUP (DEC-530);
  KV IS NOT A PURGE BUS (DEC-083); A GATE'S OWN INSTRUMENTS LIE HALF THE TIME
  (DEC-409/426); A LINE QUOTED OUT OF ITS SECTION IS A RUMOUR (DEC-976). A
  COUNT IS NOT A LICENCE TO SCAN (DEC-829/773). A REFUSAL THAT PROTECTS A
  SIDE EFFECT CAN LOCK THE MAIN EFFECT (DEC-720/317). A CEILING THAT GUARDS
  ONE CONTENT TYPE IS NOT A CEILING (DEC-020). AN ALLOWLIST NAMED IN A
  CONTRACT MUST BE CALLED AT EVERY DOOR (DEC-322). A UNIVERSAL NEEDS A
  POPULATION (DEC-459/618). A DESKTOP PASS CANNOT SEE A PHONE-ONLY
  COMPONENT'S ERRORS (DEC-253). w30 amended DEC-720/317/020/322/618/459/253.
- FINDINGS w31 (main `dbac66d1`, ref-measured not inherited: w28 gates all
  merged; w29 a/c/d/f MERGED, **b and e produced ZERO commits** so their
  scope returned to unowned; w30 a-f IN FLIGHT — a/b carry commits, c/d
  branched at main with none, e/f not yet cut. Do not re-file w30 scope).
- A RECORDED RULING IS NOT A LANDED FIX (DEC-358/773 w31). DEC-773's
  wave-29 amendment argued the files-library fix at file:line, compiled
  into `src/decisions.ts`, and `files-library.ts:215` never moved — the
  owning lane produced nothing. `decisions/` is a MANDATE, never a receipt.
- NON-INDEXABLE "BY CONSTRUCTION" IS USUALLY NON-INDEXABLE BY SPELLING
  (DEC-773 w31): `contact.headshot_url = '/headshots/' || file.id` buries
  the PK inside a concat, so no planner drives `file` by id — 1.6M
  comparisons, twice per request, 481ms. Rewritten `file.id =
  substr(contact.headshot_url, 12)` + an explicit 11-char prefix guard, the
  same rows come back off the PK with no migration. Move the indexed column
  to one side before reaching for a schema change.
- "ONE ROUND TRIP PER VIEW" HAS A SERVER SIDE (DEC-338 w31): SPEC §7's
  no-waterfall rule was only ever enforced on the client. The reviewer
  queue awaits ELEVEN repo calls in a row (reviewer.ts:99-215), buildResults
  five (shared.ts:433-460). Independent calls issue as one `Promise.all`
  wave; envelope/order/numbers stay byte-identical; prove concurrency with
  an instrumented fake Db that counts in-flight statements, never a grep.
- A PERF NUMBER TAKEN DURING A PARALLEL WAVE GRADES A DELTA (DEC-347 w31):
  N lanes each seeding + running `wrangler dev` + 30 iterations inflate
  every absolute by an unrecordable amount. Paired before/after in ONE
  session; the absolute belongs to the serial verification wave. Migration
  numbers are pre-assigned per lane so concurrent lanes cannot collide.
- A HARNESS THAT SKIPS A CHECK MEASURES NOTHING (DEC-644 w31): seeder was
  profile-threaded, smoke script kept two literals, `DEFAULT_ONLY_CHECK_
  NAMES` silently dropped the review subsystem from non-default runs.
- DEC space FULL (001-999); w31 amended DEC-773/338/347/644/358.
