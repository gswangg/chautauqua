# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips
  NULLs; merge a SET showing EVERY differing field; irreversible action a PAGE
  naming what goes AND what it refuses; publish the WINDOW not a flag;
  decision with no code a LIE; mandate file a HYPOTHESIS -- tree MOVES WHILE
  YOU PLAN; every page says who's signed in; submitted blank CLEARS, absent
  key is silence; main can be RED -- grep `<<<<<<<` every wave; a gate must
  not render children while identity loads; a per-row count is N scans --
  one grouped query; blank is ABSENT for EVERY kind; a row is a DRAFT until
  Save; a CREATE-time expansion is a snapshot -- BACK-FILL every activation
  path; undefined var(--chq-*) resolves TRANSPARENT; the scrim IS the
  dialog; two roots of one kind are two documents not two versions; a JOIN
  row cascades on contact delete, only a row losing a document may refuse;
  a grid class shared by two components is a CELL COUNT contract.
- FINDINGS w32-37 (DEC-983..999; 001-999 FULL, no DEC-1000+; successor rule
  is `## Amendment (wave N)` on the nearest existing DEC, decisions/README.md,
  DEC-004 precedent -- never a new file): a grep "no matches" is a fact about
  that minute, not main -- re-probe. Confessions in comments are defects; a
  predicate applied HALF is worse than none; an exclusion REASON can expire
  (check the lane landed). Mandate lists age fast -- MINE THE CODE twice. A
  DEFERRAL IS A DATED PROMISE -- grep "not this wave", check if it landed. A
  decision can land on ONE PACKAGE and read as done (DEC-989 stopped at src/
  boundary) -- ask WHICH PACKAGE did it reach. A TOKEN declared and consumed
  by nobody is the same lie as a rule no markup uses. TRUST FLOWS ONE WAY: an
  untrusted path MORE permissive than the trusted one is a defect in the WRITE.
- FINDINGS w38 (amendments only; the DEC-004 `## Amendment (wave N)` form): the
  MANDATE IS EXHAUSTED. w38 re-probed ~20 more named items (public search rows,
  per-surface published counts, headshot library, seed required-flags, .chq-file
  inputs, participation MENU, filter-rules panel, Home landmarks, {first_name}
  placeholder, weighted caption, CSV org->Company) -- every one already closed.
  Worse, TWO of four external review-lens "P1"s were closed before the reviewer
  read the tree (send_email binding -> DEC-996 Resend; login rotation -> DEC-994)
  and a third by DEC-995. A REVIEW FINDING IS A HYPOTHESIS WITH A FILE:LINE --
  open the line. Three defect shapes recur once you mine the code: (1) a WRITE
  gated by a READ predicate (POST /files/:id/comments through authzFileRead; an
  upload through a helper NAMED ...Write that only checks membership) -- name a
  predicate after the verb it protects; (2) a RESPONSE carrying what the request
  MINTED (compose/send returned result.rendered, live /claim/ tokens, to a client
  that reads only sent/failed) -- a send reports counts, never bodies; (3) a rule
  stated in a COMMENT instead of a CONSTRAINT ("no unique index on (org_id,name)
  yet... that dedupe is separate work") -- prose plus read-then-write is not a
  contract, and the named blocker IS the work. And a predicate with THREE readers
  must be ONE function: DEC-318's event-range bound guards the agenda and the
  public schedule but not loadIcsScheduleData, so .ics disagrees with both.
