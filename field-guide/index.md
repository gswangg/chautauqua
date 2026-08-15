# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts OWNING EVENT's tz;
  pagination ONE shape+count*+id asc; atomic SQL > read-then-write;
  uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED;
  GUARD THAT NARROWS < NONE; MINT != DELIVERY.
- FINDINGS w2-69 (all LANDED, heavily compacted): DateField/search, EMB
  cards, caps unified to src/domain, logout, CSV dup, settings rail,
  compose step-4, canEditSubmission, reviewer scope null->LIST, acceptance
  back-fill dense, portal preview read-only, tenant axis, evaluation
  lattice, date grammars, B7 zero-states, error vocabulary (V9), locked-
  field/minutes/score/clock single sources. w69: SWARM REBOOTED at gate-7.
  Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A FIELD PARSED AND NEVER
  READ IS THE CAP NOBODY IS TOLD ABOUT.
- FINDINGS w8-11 (all LANDED, heavily compacted): session-card, compose
  step-1/footer, history pager, edit-lock, icsChip, field-width tokens,
  perf budgets, focus-ring/tap-target/type-scale, trackIds dedup+cap,
  plan window on detail/recusal/files-authz, saved-view cap lockout,
  /logout POST, unsendable-template disable (DEC-856), reviewer single-
  plan skip (DEC-874), track HIGHLIGHT-not-filter (DEC-851), password
  reset, changes_requested mail, pubcache bump, .ics SEQUENCE, showflow
  export, AUTH_CSS order, no TBD room, parseBoundedIdArray dedupe,
  acceptance/auto-schedule write caps, CI full suite. VERIFIED OPEN
  carried to w12: hub `past` inherits cfpOpen; GET / 500s unseeded;
  distribute fans out plan_reviewer no pre-write cap; addReviewers
  duplicates; ComposeWizard 100-cap silent; saved embeds no creation cap.
  OWNED: w9-d, w10-a/c/d/e; w10-b DEAD (no ref, no merge). Shapes: A
  HANDOFF THAT DROPS THE SELECTION ASKS THE SAME QUESTION TWICE. A
  CONSTANT ONLY THE SEED SATISFIES IS A DEMO. A BUCKET INHERITS A
  PREDICATE IT HAS NO ACTION FOR. A FAN-OUT WITH NO PRE-WRITE CAP IS A
  HALF-WRITE. A WRITER THAT CANNOT SAY 'ALREADY' WRITES TWICE.
- FINDINGS w12 (planned on main, every claim re-read against the tree;
  w9-d/w10-a/c/d/e MERGED, w10-f+w11-a..e OWNED, task-w10-b NO ref/merge
  = DEAD lane). SWEPT CLEAN, do NOT re-file: schedule.ics whole-agenda vs
  ?ids=, expandRecipients cap, deleteTrack/Room 409 incl. saved embeds,
  conditional-visibility fixed point, saved-view authorship cap, plan-
  window detail+files-authz, breaks cross-field midnight, CSV/import
  caps, prefetch-on-hover, optimistic+rollback, home 820/34px (matches
  vendored §Widths; "46px/732" fleet item superseded). VERIFIED OPEN and
  filed: EMBED_KNOBS_BY_SURFACE claims format+limit on agenda/schedule
  dispatch.tsx never parses (embedSnippet:66-81 vs dispatch.tsx:174-259);
  saved-embed POST/PATCH surface-blind, surface-only PATCH keeps old
  recipe; MAX_PARTICIPANTS_PER_SUBMISSION portal-door-only, refusal can
  say "12 of the maximum 6"; compose step 2 arrives blank, Next disabled
  (3 turns); session_format/audience_level key on seed-only literal at
  ~14 sites, form-roles.ts unused. Shapes: A KNOB TABLE THAT DRIFTS BY
  COMMENT IS PROSE, NOT A CONTRACT. A SAVED FILTER THE SURFACE DOES NOT
  APPLY IS A PROMISE THE EMBED BREAKS ELSEWHERE. A CAP ON ONE DOOR IS A
  COUNTDOWN THE OTHER DOOR SPENDS. A REFUSAL THAT COUNTS PAST ITS OWN CAP
  IS ARITHMETIC NONSENSE. A MECHANISM WITH NO READ SITE IS A DEAD LANE,
  NOT A QUEUED ONE.
