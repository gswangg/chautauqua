# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE
  shape+count*+id asc; atomic SQL > read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-19 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field caps unified; write caps, contact merge,
  CSRF exemption, bulk-email dedupe; DEC-340/346/967/317/902/989/890/603/
  830/930/785/874/730/993. TOOL TRAP: Grep -C drops some `/`. SPEC CLOSED,
  J1-J12+§5+§6 GREEN. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A LINE
  NUMBER IS NOT AN IDENTITY. A RULING WITH NO SCAN DRIFTS BACK.
- FINDINGS w20-24 (compacted): `.chq-table` table-layout, mail-shell
  lang, FITTED SUB-PIXEL GEOMETRY, role="cell" wraps not replaces
  link/button (DEC-930), unwidthed-table CLOSED, bleed-vs-clamp
  (DEC-989), citations must quote (DEC-976), phone label from CELL not
  position (DEC-937), aria-invalid all FieldControl branches (DEC-124),
  FIELD ORGANISER WRITES THAT NO SURFACE READS (DEC-986). Swept/CLOSED:
  prefetch-on-hover, export caps, cron fan-out, smart placement, public
  Cache-Control/SWR, headshot headers, mail shell 560, Insert-a-field,
  participants tracks, distribute parity, filter chips, upload-reject,
  write-failed banner, Delete plan footer, grid-filter tokens, scope
  caps, Secure cookie, session hydration, isSlugTaken global namespace.
  Shapes: SHARED VOCABULARY CLASS != WIDTH HOOK. FRACTION IS SIGNATURE
  OF A FIT. REF LIST IS A SNAPSHOT. FULL BLEED IS A POSITION NOT MARGIN.
- FINDINGS w25 (main `39ac22d0`): MANDATE WAS MEASURED ALL ALONG. Newest
  receipts: task-w17-d-render-sweep.md (FAIL, 14 open), task-w9-d's 9 —
  w18-24 closed none, spent 5 lanes on already-fixed defects. Verified
  pre-closed: form-render.tsx aria-invalid all 6 kinds; mail/shell.ts:70
  lang="en"; SpeakerDetailPage wraps in `<span role="cell">`;
  contacts.css:533 phone label from `td[data-label]`; submit-views.tsx
  renders authored CFP intro. Shape: A CODE READ INVENTS DEFECTS; A GATE
  FINDS THEM. Read newest verification-log DETAIL before newest prose.
- AN INSTRUMENT THAT CRIES WOLF IS A BROKEN GATE (DEC-620 w25):
  scrollHeight > clientHeight is not a clip unless something clips. The
  visually-hidden collapse and an `object-fit` crop are deliberate; a
  `line-height:1` h1 with no overflow declared cuts nothing on screen.
- DISABLED IS A STATE, NOT A LOOK (DEC-436 w25): the WCAG inactive-
  component exemption is earned by `disabled`/`aria-disabled` in the
  tree, never by a class name — and a 3:1 legibility floor still binds
  (`--chq-disabled` #8e8a7a on #ddd8c8 = 2.43).
- A CLAIM WITHOUT A QUOTED LINE IS A RUMOUR (DEC-976 w25): a brief must
  quote the offending source line; a worker who cannot reproduce it
  STOPS and reports CLOSED-AT-TIP rather than rewriting correct code.
- Verification-log filenames repeat across campaigns —
  `docs/verification-log/task-w25-*.md` already exist from an earlier
  run. Suffix the measured sha; never overwrite (DEC-129 w25).
