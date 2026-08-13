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
  CSV cell is ABSENT DATA; seed has ONE clock; imported row keeps THEIR
  id via `external_ref`; drawer is a RECORD; anonymity is a RATCHET;
  merge takes a SET; confirmation is a DIALOG not window.confirm;
  items+total from ONE where clause; raw id leaks -- render LABELS;
  worklist row carries its action; guard citing unguarded routes is
  desynced -- enumerate; cacheability DEFAULT + "own header wins"; send
  ends in ONE reporter; capped ANONYMOUS list counts only what it
  shows; export = same where clause everywhere; chromeless surface
  CLOSED both ways; builder's options IMPORTED, validated in PLANNER
  too; server rule the UI never states is a trap; rule's VALUE typed by
  TRIGGER's kind; public list is list + rail, never /embed; irreversible
  action is a PAGE at its own URL; paged read touches only the page.
- FINDINGS w15 (DEC-687..696, compacted): `.toString()`-embedded fns carry
  NO closure -- proved by EXECUTING the emitted script. Tier class
  ALWAYS wins. Hub gives a row ONE action. Settings is read-only
  SUMMARY + drill-in. Worklist row names LATEST artefact, two actions
  only. Test vs docs conflict: THE TEST is wrong. Scope param on send
  AND preview, identically. Thrown render is DESIGNED, never blank.
- FINDINGS w16 (DEC-697..705, compacted): IMMUTABLE headers decorate via
  ONE clone-on-failure helper. Grid cells POSITIONAL, absent -> EMPTY.
  Waitlisted is a HOLD status; new enum re-reads every NEGATIVE
  predicate. Badge refetches on nav + after mutation. Seeded prose
  never says it's seed data. Ranked row names human+track; bulk label
  states scope it SENDS; merge preview is the merge fn's OWN output.
- FINDINGS w17 (DEC-706..716): section action is a LINK on its rule; a
  filled primary lives on the title row or a form footer, never a
  floating band; a row is chosen by CLICKING THE ROW, not a radio.
  Progress speaks DONE/N TO GO/NOT STARTED; remind label names the
  scope it SENDS -- ONE predicate, imported by route AND SPA. Person is
  named by their CONTACT via one batched account->contact rule;
  unresolved shows the email, never an invented name. START A NEW WAVE
  copies locked criteria into a new round. Tab selection is URL state
  (?tab=), never component state. Directory is TABLE + RAIL, every
  figure endpoint-backed. Labels are DERIVED roles, batched per page --
  no invented column. Deleted version re-links the chain, re-homes the
  thread. Role control offers the app's OWN imported vocabulary. ONE
  reorder affordance, pointer+keyboard. Sign-in names the event, offers
  only the CFP that is open.
