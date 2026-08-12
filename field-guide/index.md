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
  conditional visibility is a FIXED POINT; hand-copied vocabularies
  drift -- IMPORT them; a uniqueIndex is a CONTRACT; a cron has no
  request -- own origin entry point that THROWS; a `position`/`order`
  column nobody sets on create is dead -- assign max+1 INSIDE the
  insert; a nullable column inside a NEGATED set predicate (NOT IN/!=)
  silently skips NULL rows; two functions claiming "the same semantics"
  END in the same helper.
- FINDINGS w1-2 (DEC-570..590, compacted): full suites SERIALIZED via
  with-test-lock.sh, workers run TARGETED tests; verify before trust --
  read main first. Real <button> not `div draggable`; colour alone
  isn't track identity -- NAME it. Fan-out with no count is a hidden
  cap: preview/queue END in one predicate builder. Upload-that-navigates
  DISCARDS the form; blank CSV cell is ABSENT DATA. SSR can't know
  viewport: phone layout is a SECOND markup via display:none, mirrored
  inputs MIRROR. ONE stylesheet per layer owns bare controls. A ratio
  whose num/denom count different KINDS is false.
- FINDINGS w3 (DEC-591..601, compacted): seed has ONE clock -- SEED_NOW,
  every instant an offset from it, loud assert if the demo's own event
  already happened. A value with no column is an ANSWER: name its field
  id once and import it, seed included. Two renderings of one person
  must not disagree which facts they have -- one card, two layouts. A
  query param that parses and no-ops is a hidden cap: honor it in BOTH
  HTML and .json twin, or delete it; embed links must stay in the
  iframe. A count taken at the wrong gate isn't a count -- publish
  through the PUBLIC visibility predicate, name what it held back.
  Anonymity is server-side, never the renderer's. `?? 'Unknown'` is the
  SERVER forgetting to resolve a name. A phone block needs desktop
  `display:none` or it renders TWICE. 'Pending' vs 'Under review' is
  deliberate (DEC-600) -- speaker must never see the queue.
- FINDINGS w4 (DEC-602..611): verify the DEFECT, not the report -- three
  mandate items were already fixed in main. A grid slot has a FIXED
  height: clip to it, nothing interactive inside, label the gutter from
  the SAME row map the blocks use. /agenda is the grid; /schedule is
  the LIST (EMB-09) at every width. A send is a batch at one recipient
  too -- group by COALESCE(batch_id, id) or NULL rows vanish; id minted
  ONCE per fan-out. Version CHAIN is speaker-visible; a file id in a
  URL is never proof of ownership -- walk it to the root. Speaker-side
  writes must never touch someone else's contact row. A copy can FAIL:
  say so, reveal the text. A route belonging to another role is neither
  a 404 nor a blank <main> -- every role subtree ENDS in a catch-all.
  Never print a total you did not count; never guess a slug you can read.
