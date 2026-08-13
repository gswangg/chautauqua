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
  dates via event-time.ts OWNING EVENT's tz never toISOString.
- STAGE1-CLOSE w11-38 (DEC-420..569, compacted): ledger names its sha; ONE
  email rule via findAccountUserId; universal rows graded from
  ENUMERATION never sample; pagination ONE shape+count*+`id asc`; a cap
  the UI can't see LIES, render `total`; atomic SQL beats read-then-write;
  hand-listed manifests desync -- enumerate; conditional visibility is a
  FIXED POINT; hand-copied vocabularies drift -- IMPORT them; uniqueIndex
  is a CONTRACT; negation skips NULLs.
- FINDINGS w1-17 (DEC-570..716, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour isn't identity -- NAME it; blank
  CSV cell is ABSENT DATA; anonymity is a RATCHET; merge takes a SET; raw
  id leaks -- render LABELS; cacheability DEFAULT + "own header wins";
  irreversible action is a PAGE; hub gives a row ONE action; settings
  SUMMARY + drill-in; grid cells POSITIONAL; person named by CONTACT; tab
  selection is URL state; directory is TABLE + RAIL.
- FINDINGS w18-20 (DEC-717..743, compacted): a column with side effects
  has ONE writer; validators refuse what the store can't carry. Sandboxed
  child's origin IS "null". One deliverable at a time: a chip scopes
  versions AND thread. Periodic push INCREMENTAL, backs off on 429.
  Labels are customFields, one keyed format. Tiers are a PREDICATE over
  the tree. Portal shows EVERY submission a speaker owns. Publish is the
  WINDOW, not a flag. An action that can't apply is ABSENT, not disabled.
  A recorded decision with no code is a LIE -- grep the ROUTE before
  re-tasking. Anonymised hides the SPEAKER from the REVIEWER, never the
  organiser. The seed must satisfy every read it enables -- assert by
  enumeration.
- FINDINGS w21 (DEC-744..753): an envelope's KEYS are fixed by its route,
  never by whether the branch had anything to say -- the empty case emits
  the empty array. A seeded reviewer is a NAMED person (user.contact_id) or
  every organiser surface shows an email. ONE measure token. Chrome
  fidelity never deletes a capability. A dialog may not offer what the
  store cannot carry. A task with no assignee is not a state we offer --
  creation always expands. Merge shows EVERY differing field.
- FINDINGS w22 (DEC-754..762): a roster and the set an action expands
  over are ONE predicate -- a screen that lists someone the action skips
  is lying. Every control in a creation dialog must reach the store; a
  selector the POST body drops is decoration. Contact identity is
  (org, lower(email)) on every find-or-create. An author is a PERSON --
  resolve the contact, never print the address, never "Unknown". Delete
  is refused with counts; merge is the answer for a contact carrying
  history. A card you must scroll inside is not readable: rows grow,
  clashes split into lanes. Position ("N of 47") re-derives from the
  URL's own filter, never router state.
- VERIFY, don't inherit: eval-findings.md ran ~2 probes stale this wave --
  Overview residue, portal session detail, Speakers overdue cells, results
  score column, response-modal em-dashes and Account/auth already closed;
  a wave-3 merge landed mid-planning. Grep the route before re-tasking.
