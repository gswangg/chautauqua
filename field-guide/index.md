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
  read-then-write; event-clock strings carry their event's tz; hand-listed
  manifests desync -- enumerate in a test; date-only field is a DAY
  LABEL; conditional visibility is a FIXED POINT; offset-paged ORDER BY
  ends in a unique column; hand-copied vocabularies drift -- IMPORT
  them; a uniqueIndex is a CONTRACT; a cron has no request -- own origin
  entry point that THROWS; a `position`/`order` column nobody sets on
  create is dead -- assign max+1 INSIDE the insert; a nullable column
  inside a NEGATED set predicate (NOT IN/!=) silently skips NULL rows;
  two functions claiming "the same semantics" END in the same helper.
- FINDINGS w1-2 (DEC-570..590, compacted): full suites SERIALIZED via
  with-test-lock.sh, workers run TARGETED tests; verify before trust --
  read main first. Real <button> not `div draggable`; colour alone
  isn't track identity -- NAME it. Fan-out with no count is a hidden
  cap: preview/queue END in one predicate builder. Comment thread
  belongs to the version CHAIN. Upload-that-navigates DISCARDS the
  form; blank CSV cell is ABSENT DATA. `flex:1;min-height:0;overflow-y:
  auto` beats guessed padding. Drill-in resolves its own subject;
  fidelity report is OBSERVATION, not spec. GET / is an ANONYMOUS hub,
  stranger-visible is a PURE predicate (home-hub.ts). Credentials
  copied by hand drift -- IMPORT, assert against fixture. SSR can't
  know viewport: phone layout is a SECOND markup via display:none;
  mirrored inputs must MIRROR. ONE stylesheet per layer: THEME_CSS
  (SSR)/styles.css (SPA) own bare controls. A ratio whose num/denom
  count different KINDS is false. Branch against a copied-wrong
  vocabulary never fires -- import the label.
- FINDINGS w3 (DEC-591..601): the seed has ONE clock -- SEED_NOW,
  every instant an offset from it, and a loud assert when the demo's
  own event has already happened. A value with no column is an ANSWER:
  name its field id once (SESSION_FORMAT_FIELD_ID) and import it, seed
  included. Two renderings of one person must not disagree about which
  facts a person has -- one card, two layouts. A query param that
  parses and then no-ops is the same lie as a hidden cap: honor it in
  BOTH the HTML and the .json twin, or delete it; and an embed whose
  links leave the iframe is not an embed. A count taken at the wrong
  gate is not a count -- publish reports through the PUBLIC visibility
  predicate, never through placement, and names what it held back.
  Anonymity is the plan's fact, decided server-side, never the
  renderer's. `?? 'Unknown'` in a component is the SERVER forgetting to
  resolve a name. A phone block with no desktop `display:none` renders
  TWICE. And a defect report can be wrong: 'Pending' vs 'Under review'
  is deliberate (DEC-600) -- the speaker must never see the queue.
