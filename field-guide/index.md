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
  assign max+1 INSIDE the insert; a negated predicate skips NULLs; "same
  semantics" claims END in the same helper.
- FINDINGS w1-6 (DEC-570..630, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; fan-out with no count is a hidden cap; blank CSV cell is ABSENT
  DATA; SSR phone layout is a SECOND markup via display:none; seed has
  ONE clock -- SEED_NOW; a file id in a URL is never proof of ownership
  -- walk it to root; an imported row keeps THEIR id -- one namespaced
  `external_ref` per owner scope; dry/real run are ONE planner, counts of
  rows PLANNED never sampled; a drawer is a RECORD: facts, history,
  action bar; an audit is enumerated by a test or it drifts; two readings
  of one row END in one resolver -- a withheld cell says '(anonymized)',
  never blank; anonymity is a RATCHET, never revocable once an evaluation
  exists; cache purge is a closed two-list (/e/*, /embed/*); merge takes
  a SET; a phone selector's top-level rule is display:none or absent.
- FINDINGS w7 (DEC-631..638): a confirmation is a DIALOG in our own
  contract -- window.confirm is browser chrome the design never saw. A
  row that shows a decision must CARRY it: optimistic state with no
  server field forgets on reload. A filter applied AFTER the page window
  lies twice -- items and total come from ONE where clause. A request
  the router cannot answer is still our response: /api/v1 gets the
  envelope, a human gets a page. Framing is a closed two-list -- /embed/*
  frames, everything else DENIES. A hand-listed API reference is
  enumerated from app.routes or it drifts; a capability the API has and
  no screen exposes is a DEAD endpoint. Re-grep before concluding
  something is missing: main moves mid-wave.
- FINDINGS w8 (DEC-639..647): a join row's identity is the PAIR its
  uniqueIndex already names -- no third namespace, no migration; an
  imported speaker carries the DEC-258 attribution SNAPSHOT or the public
  card renders nameless. A claim of ABSENCE is testable like a claim of
  presence -- name the artefact, assert it isn't there; an audit that
  UNDERSTATES the product is as wrong as one that overstates it. A type
  FLOOR cannot see a 600 that should be 700: roles are tokens, weights
  are measured. Scale is a profile at BOTH ends of the pipe -- the
  harness measures the profile the seeder built; a bar the mandate says
  to verify is a timed check, never an assumption. Seeded lateness is
  demo COPY: match the mock. A closed two-list is closed in BOTH
  directions -- a pattern matching no route is invisible in both modes.
