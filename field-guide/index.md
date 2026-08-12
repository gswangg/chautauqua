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
  never sample; pagination ONE shape+count*+`id asc`; a cap the UI can't
  see LIES, render `total`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- enumerate in a test; conditional visibility is a
  FIXED POINT; hand-copied vocabularies drift -- IMPORT them; a
  uniqueIndex is a CONTRACT; a `position` column nobody sets is dead --
  assign max+1 INSIDE the insert; a negated predicate (NOT IN/!=) skips
  NULLs; "same semantics" claims END in the same helper.
- FINDINGS w1-4 (DEC-570..611, compacted): full suites SERIALIZED via
  with-test-lock.sh; real <button> not `div draggable`; colour alone
  isn't track identity -- NAME it. Fan-out with no count is a hidden
  cap; upload-that-navigates DISCARDS the form; blank CSV cell is
  ABSENT DATA; SSR phone layout is a SECOND markup via display:none.
  Seed has ONE clock -- SEED_NOW. Publish counts through the PUBLIC
  predicate; a file id in a URL is never proof of ownership -- walk it
  to the root. A role's route subtree ENDS in a catch-all.
- FINDINGS w5 (DEC-612..621, compacted): an imported row keeps THEIR id
  -- one namespaced `external_ref`, unique per owner scope. Dry run and
  real run are ONE planner; counts are of rows PLANNED, never sampled.
  A drawer is a RECORD: facts, history, action bar. Code on someone
  else's page lives in ONE file its own test EXECUTES. An audit is
  enumerated by a test or it drifts.
- FINDINGS w6 (DEC-622..630, compacted): two readings of one row END in
  one resolver -- a withheld cell says '(anonymized)', never blank. A
  ref the product PRINTS is a ref the API ACCEPTS, server-side. Anonymity
  is a RATCHET, never revocable once an evaluation exists. A plain-form
  throw renders a PAGE with answers intact. Cache purge is a closed
  two-list (/e/*, /embed/*). CSRF/rate limits enumerated from source,
  floor-counted. Merge takes a SET. A phone selector's top-level rule
  is display:none or it does not exist.
- FINDINGS w7 (DEC-631..638): a confirmation is a DIALOG in our own
  contract -- window.confirm is browser chrome the design never saw, and
  the ban is a scan with a floor count, not a habit. A row that shows a
  decision must CARRY it: optimistic state with no server field forgets
  on reload, and a refetch cannot restore what the wire shape omits. A
  filter applied AFTER the page window lies twice -- items and total come
  from ONE where clause, and the predicate ends in the same helper as the
  fact it filters. A request the router cannot answer is still our
  response: /api/v1 gets the envelope, a human gets a page. Framing is a
  closed two-list -- /embed/* frames, everything else DENIES. A
  hand-listed API reference is enumerated from app.routes or it drifts.
  A capability the API has and no screen exposes is a DEAD endpoint.
  Re-grep before you conclude something is missing: main moves mid-wave.
