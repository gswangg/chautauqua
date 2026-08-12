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
  with-test-lock.sh; verify before trust -- read main first. Real
  <button> not `div draggable`; colour alone isn't track identity --
  NAME it. Fan-out with no count is a hidden cap: preview/queue END in
  one predicate builder, id minted ONCE per fan-out. Upload-that-
  navigates DISCARDS the form; blank CSV cell is ABSENT DATA; SSR phone
  layout is a SECOND markup via display:none, mirrored inputs MIRROR;
  ONE stylesheet per layer owns bare controls. Seed has ONE clock --
  SEED_NOW, loud assert if the demo's event already happened. A value
  with no column is an ANSWER: name its field id once, seed included.
  Two renderings of one person must not disagree which facts they have.
  A query param that parses and no-ops is a hidden cap: honor it in
  BOTH HTML and .json twin. A count taken at the wrong gate isn't a
  count -- publish through the PUBLIC predicate; `?? 'Unknown'` is the
  SERVER forgetting to resolve a name. A grid slot has a FIXED height:
  clip to it, label the gutter from the SAME row map. A file id in a
  URL is never proof of ownership -- walk it to the root. A copy can
  FAIL: say so, reveal the text. A role's route subtree ENDS in a
  catch-all. Never print a total you did not count; never guess a slug.
- FINDINGS w5 (DEC-612..621): an imported row keeps THEIR id -- one
  namespaced `external_ref` per table, unique inside its own owner
  scope; SQLite NULLs are distinct so hand-made rows are untouched. Dry
  run and real run are ONE planner: a preview on a second code path is
  a lie; counts are of rows PLANNED, never sampled. An untested
  integration ships as PROSE, never a dead control. An unplaced session
  gets a reason from a closed enum, one renderer beside
  describeConflict -- name the constraint, promise nothing. A drawer is
  a RECORD: labelled facts, one history section, one action bar. Code
  that runs on someone else's page lives in ONE file its own test
  EXECUTES -- no TS copy to drift; origin, source and instance id must
  ALL match. An audit is enumerated by a test or it drifts. Scale is a
  PROFILE threaded through the seeder, not a second seeder. render-sweep
  measures vertical clip: scrollHeight > clientHeight with overflow
  visible/hidden is a bug; a scroll container is not, an unfixed
  offender is NAMED, never absorbed into tolerance.
