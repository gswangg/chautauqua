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
- FINDINGS w20-23 (compacted): `.chq-table` table-layout fixed across
  files-library/submissions/contacts/compose/review/worklist (DEC-902);
  mail-shell literals (DEC-037); FITTED SUB-PIXEL GEOMETRY (DEC-369); row
  grid replacing a table keeps table semantics (DEC-930); unwidthed-table
  family CLOSED (4 members); bleed-vs-clamp (DEC-989); citations must
  quote (DEC-976); dead phone labels first fixed (DEC-937 w23). Shapes: A
  SHARED VOCABULARY CLASS IS NOT A WIDTH HOOK. A FRACTION IS THE
  SIGNATURE OF A FIT. A REF LIST IS A SNAPSHOT (tree moves mid-plan).
  FULL BLEED IS A POSITION, NOT A MARGIN.
- Swept and CLOSED w20-23, do not re-file: prefetch-on-hover, export row
  caps, cron fan-out, smart placement, public Cache-Control/SWR, headshot
  serve headers, mail shell 560, Insert-a-field dropdown, participants
  table tracks, distribute preview/apply parity, active-filter chips,
  upload-reject modal, write-failed banner, Delete plan footer.
- FINDINGS w24 (read from main `173a4a41` = merge task-w23-a; w23-b..e in
  flight, their surfaces excluded): FIVE review-lens claims re-checked and
  CLOSED at this tip — tasks.ts grid filters refuse unknown tokens
  (DEC-340 w18); countEvaluationsBySubmission/isSubmissionInReviewerScope
  cap on MAX_PLAN_SUBMISSION_SCAN; clearSessionCookie appends Secure; the
  public sessions LIST hydrates speakers through
  visibleParticipantConditions(). Do not re-file. isSlugTaken's missing
  orgId is DELIBERATE: `/e/:slug` is one global namespace.
- New defect class: A FIELD THE ORGANISER CAN WRITE THAT NO SURFACE READS
  (DEC-986 w24). `form.description` edited in Settings, validated in the
  API, documented as "intro shown on the public CFP form", carried in the
  public view's own props — submit-views.tsx rendered a computed lede
  instead. Shape: FOLLOW A FIELD TO A PIXEL, NOT A COLUMN.
- A STRUCTURE ROLE NEVER LANDS ON A CONTROL (DEC-930 w24): `role="cell"`
  on a `<Link>`/`<button>` REPLACES link/button in the a11y tree the judge
  drives. The wrapper carries the role; the control keeps its own
  (PeopleRolesPanel is the reference).
- A PHONE LABEL IS SOURCED FROM ITS CELL, NEVER ITS POSITION (DEC-937
  w24): contacts.css keyed 'Company'/'Labels: ' to `td:nth-child(3)/(4)`.
  Position may carry order/width; never letters; punctuation-only
  decoration stays, as a reason.
- One vocabulary, all kinds (DEC-124 w24): three of six SSR FieldControl
  kinds skipped `aria-invalid` + `.chq-field-invalid`. A rule stated in a
  header comment isn't a rule until every branch of the switch runs it.
- Every emitted document declares `lang` — except mail/shell.ts, the one
  that leaves the app, now scanned (DEC-037 w24).
