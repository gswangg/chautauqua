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
- FINDINGS w15-17 (DEC-687..716, compacted): `.toString()`-embedded fns
  carry NO closure; tier class ALWAYS wins; hub gives a row ONE action;
  settings is SUMMARY + drill-in; immutable headers via ONE clone-on-
  failure helper; grid cells POSITIONAL, absent -> EMPTY; waitlisted is
  a HOLD status; badge refetches on nav + mutation; merge preview is
  the merge fn's OWN output; section action is a LINK on its rule;
  filled primary on title row/form footer only; progress speaks
  DONE/N TO GO/NOT STARTED; person named by CONTACT via batched
  account->contact; tab selection is URL state; directory is
  TABLE + RAIL; ONE reorder affordance, pointer+keyboard.
- FINDINGS w18 (DEC-717..726, compacted): a column with side effects has
  ONE writer; validators refuse what the store can't carry (Infinity ->
  `null`), assert per KIND. Sandboxed child's origin IS "null" --
  identity is source window + nonce. Asking for changes is a MESSAGE;
  status route stays mailer-free. One deliverable at a time: a chip
  scopes versions AND thread. Review renders criterion LABELS + plan's
  weighted score. Null-room column: "No room yet" only when armed.
  Periodic push INCREMENTAL from a watermark, backs off on 429. Labels
  are customFields, one keyed format (supersedes DEC-712).
- FINDINGS w19 (DEC-727..735): tiers are a PREDICATE over the tree, not a
  list -- caps bind in vitest.config.ts, not the env. Settings is a
  SUMMARY + drill-in, drill in the URL. Portal shows EVERY submission a
  speaker owns -- a decline they never see is a bug. Three states, ONE
  control family: outline is the shared "not done" axis. Publish is the
  WINDOW, not a flag. A dialog's form is one measure via ModalFrame's
  FormRow; a preview names each recipient's blocker. An action that can't
  apply is ABSENT, not disabled. A duplicate group carries the fields its
  merge screen shows. A class describes ONE layout behaviour -- split it
  before a media block mutates it. Desktop first, phone in @media.
