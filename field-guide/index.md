# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 012/013 route files export Hono
  sub-apps, errors {error:{code,message,fields?}}; bulk ops set-based.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, ONE
  dialog contract, phone @700px; D1 binds PRIMITIVES (epoch-ms NUMBER);
  dates via event-time.ts OWNING EVENT's tz never toISOString; public
  lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-38 (DEC-420..569, compacted): ledger names its sha; ONE
  email rule via findAccountUserId; universal rows graded from ENUMERATION
  never sample; pagination ONE shape `page?:{limit,offset}`+count*+`id asc`;
  a cap the UI can't see LIES, render `total`; atomic SQL beats
  read-then-write; hand-listed manifests desync -- enumerate in a test;
  conditional visibility is a FIXED POINT; hand-copied vocabularies drift
  -- IMPORT them; a uniqueIndex is a CONTRACT; a cron has no request --
  own origin entry point that THROWS; a `position` column nobody sets on
  create is dead -- assign max+1 INSIDE the insert; a nullable column in
  a NEGATED predicate (NOT IN/!=) skips NULLs; two functions claiming
  "the same semantics" END in the same helper.
- FINDINGS w1-4 (DEC-570..611, compacted): full suites SERIALIZED via
  with-test-lock.sh; verify before trust. Real <button> not `div
  draggable`; colour alone isn't track identity -- NAME it. Fan-out
  with no count is a hidden cap: id minted ONCE per fan-out. Upload-
  that-navigates DISCARDS the form; blank CSV cell is ABSENT DATA; SSR
  phone layout is a SECOND markup via display:none. Seed has ONE clock
  -- SEED_NOW. A value with no column is an ANSWER: name its field id.
  A query param that no-ops is a hidden cap; publish counts through the
  PUBLIC predicate; `?? 'Unknown'` is the SERVER forgetting a name. A
  file id in a URL is never proof of ownership -- walk it to the root.
  A role's route subtree ENDS in a catch-all. Never guess a slug.
- FINDINGS w5 (DEC-612..621, compacted): an imported row keeps THEIR id
  -- one namespaced `external_ref` per table, unique inside its own
  owner scope. Dry run and real run are ONE planner; counts are of rows
  PLANNED, never sampled. An untested integration ships as PROSE. A
  drawer is a RECORD: labelled facts, one history section, one action
  bar. Code that runs on someone else's page lives in ONE file its own
  test EXECUTES. An audit is enumerated by a test or it drifts. Scale
  is a PROFILE threaded through the seeder; render-sweep's unfixed
  clip offender is NAMED, never absorbed into tolerance.
- FINDINGS w6 (DEC-622..630): two readings of one row must END in one
  resolver -- the export and the screen cannot disagree about anonymity;
  a withheld cell says '(anonymized)', never blank. A ref the product
  PRINTS is a ref the API ACCEPTS, resolved event-scoped server-side.
  Anonymity is a RATCHET: grantable, never revocable once an evaluation
  exists under it. A locked built-in is pinned VISIBLE in the fixed
  point -- a rule that hides it strips the answer unvalidated. A plain-
  form throw renders a PAGE: the middleware that identifies the surface
  marks the request, and the CFP re-renders with the answers intact.
  Purge only what the cached surface renders (/e/*, /embed/* only);
  unclassified BUMPS, and both lists are enumerated by a test. CSRF and
  rate limits are enumerated from source, never spot-checked; a scan
  that could match nothing asserts a floor count. Merge takes a SET, ids
  all checked before any write, every pair through one core. A phone
  selector's top-level rule is display:none or it does not exist.
