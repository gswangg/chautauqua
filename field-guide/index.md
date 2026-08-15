# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE shape+
  count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING
  IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, role="cell" wraps not
  replaces, bleed-vs-clamp, citations must quote, FIELD ORGANISER WRITES
  THAT NO SURFACE READS. TOOL TRAP: Grep -C drops some `/`. LINE NUMBER IS
  NOT AN IDENTITY. RULING WITH NO SCAN DRIFTS BACK. REF LIST IS A SNAPSHOT.
- FINDINGS w25-29 (compacted): MANDATE WAS MEASURED ALL ALONG (DEC-620/976/
  129); THE RED TEST WAS THE MANDATE; FAN-OUT OWNS ITS OWN CLEANUP (DEC-530);
  KV IS NOT A PURGE BUS (DEC-083); A GATE'S OWN INSTRUMENTS LIE HALF THE TIME
  (a probe declares the viewport it measured, DEC-409; two probes cannot
  disagree about one element, DEC-426; disabled-register contrast is a
  cited WCAG 1.4.3 exemption not a defect). A LINE QUOTED OUT OF ITS SECTION
  IS A RUMOUR (DEC-976): cite `path:line` AND the enclosing heading. A COUNT
  IS NOT A LICENCE TO SCAN (DEC-829/773): SCOPED SET drives, totals are
  aggregates; a formatted-string JOIN PREDICATE defeats any index. A GATE
  MEASURES THE PRODUCT TREE (DEC-069/453); a live-branch lane is
  PENDING-OWNED(<branch>), never absent. `.git` refs = OWNERSHIP, tree = STATE.
- FINDINGS w30 (main `0f854f0a` "scribe wave 29"; all w28 gate lanes merged,
  w29 lanes a-d zero-commit = OWNED, don't re-file: 4 perf FAILs, 3 contrast
  rows, 2 interaction-state rows). TWO INHERITED ALARMS ARE DEAD: "37 failing
  tests" and DEC-244 "version 2" was the INSTRUMENT (single upload, correct).
  A REVIEW-LENS CLAIM IS A LEAD, NOT A FINDING — "no requireOrganizer" was
  false, the mount already guards it.
- A REFUSAL THAT PROTECTS A SIDE EFFECT CAN LOCK THE MAIN EFFECT (DEC-720/
  317 w30): content-note 400s on zero mailable participants BEFORE writing,
  and it is the ONLY writer of `changes_requested` — status became
  unsettable for those sessions. A send-time guard is not a write-time
  precondition.
- A CEILING THAT GUARDS ONE CONTENT TYPE IS NOT A CEILING (DEC-020 w30):
  missing Content-Length was refused for multipart only; chunked urlencoded
  still reached `csrfForm`'s `parseBody()` in MIDDLEWARE, ahead of auth.
- AN ALLOWLIST NAMED IN A CONTRACT MUST BE CALLED AT EVERY DOOR (DEC-322
  w30): social links pass `safeExternalUrl`; `branding.logoUrl` reached
  three `<img src>` unchecked for 30 waves. A CONTRACT IS A CALL SITE, NOT A
  COMMENT.
- A UNIVERSAL NEEDS A POPULATION (DEC-459/618 w30): AUDIT.md stated caps it
  never counted (`MAX_PER_PAGE=200` vs real `MAX_COMPOSE_RECIPIENTS=100`)
  and a "never auto-emails" absolute its own DEC-720 route falsifies.
  Constants importable, absolutes enumerable — both are now tests.
- A DESKTOP PASS CANNOT SEE A PHONE-ONLY COMPONENT'S ERRORS (DEC-253 w30):
  mobile render-sweep passed 26/26, 28/28 while never collecting console/
  pageerror; phone-only mounts (PhoneAgenda, submissions phone cards, Comms
  phone landing) had no evaluator watching. Mobile now collects both
  channels desktop does.
- DEC space FULL (001-999); w30 amended DEC-720/317/020/322/618/459/253.
