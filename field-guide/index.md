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
  the UI can't see LIES, render `total`; atomic SQL beats
  read-then-write; hand-listed manifests desync -- enumerate;
  conditional visibility is a FIXED POINT; hand-copied vocabularies
  drift -- IMPORT them; uniqueIndex is a CONTRACT; negation skips NULLs.
- FINDINGS w1-14 (DEC-570..686, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour isn't identity -- NAME it; blank
  CSV cell is ABSENT DATA; imported row keeps THEIR id via
  `external_ref`; anonymity is a RATCHET; merge takes a SET;
  confirmation is a DIALOG not window.confirm; raw id leaks -- render
  LABELS; guard citing unguarded routes is desynced -- enumerate;
  cacheability DEFAULT + "own header wins"; send ends in ONE reporter;
  export = same where clause everywhere; chromeless surface CLOSED
  both ways; builder's options IMPORTED, validated in PLANNER too;
  rule's VALUE typed by TRIGGER's kind; irreversible action is a PAGE.
- FINDINGS w15-16 (DEC-687..705, compacted): `.toString()`-embedded fns
  carry NO closure. Tier class ALWAYS wins. Hub gives a row ONE
  action. Settings is read-only SUMMARY + drill-in. IMMUTABLE headers
  decorate via ONE clone-on-failure helper. Grid cells POSITIONAL,
  absent -> EMPTY. Waitlisted is a HOLD status. Badge refetches on nav
  + after mutation. Merge preview is the merge fn's OWN output.
- FINDINGS w17 (DEC-706..716, compacted): section action is a LINK on
  its rule; filled primary on title row/form footer only; row chosen
  by CLICKING, not a radio. Progress speaks DONE/N TO GO/NOT STARTED.
  Person named by CONTACT via batched account->contact rule. START A
  NEW WAVE copies locked criteria. Tab selection is URL state (?tab=).
  Directory is TABLE + RAIL. Deleted version re-links chain, re-homes
  thread. ONE reorder affordance, pointer+keyboard.
- FINDINGS w18 (DEC-717..726): a column with side effects has ONE
  writer -- an import that sets 'accepted' with a raw UPDATE skips
  accepted_at and the whole acceptance. A validator must refuse what
  the store cannot carry (Infinity round-trips to `null`); assert it
  per KIND, enumerated. A sandboxed child's origin IS the string
  "null" -- identity is source window + nonce. Asking for changes is a
  MESSAGE (note + optional status + mail); the status route stays
  mailer-free. One deliverable at a time: a chip scopes the versions
  AND the thread. A detail page shares its siblings' measure; its
  decision panel decides only. A review renders criterion LABELS and
  the plan's own weighted score. The null-room column shows only when
  it holds something or a placement is armed: "No room yet". A
  periodic push is INCREMENTAL from a stored watermark and backs off
  on 429. Labels are customFields in one keyed format (supersedes
  DEC-712).
