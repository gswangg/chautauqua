# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding; src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash' (workerd 100k cap); 005 route map+admin nav; 002
  pure-core src/{auth,domain,forms,mail,lib} import nothing node:/cf;
  012/013 route files export Hono sub-apps, only src/index.ts mounts,
  middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}; 015 append-only/016 locked=real cols/114 sha rule/129
  homonym=full heading. Never hand-edit src/decisions.ts.
- Wave3-251+Campaign2 w1-w10 (DEC-012..302, ultra-compact): sub-apps/
  repos/ctx/uploads/ics/statuses/perf/headshots/walkthrough/claim;
  criteriaForRound sole resolution; CRM=SegmentRule[]+'any'; batteries
  LATE grep-not-prose; resolveBaseUrl+RELATIVE hrefs; mobile 390x844;
  8 battery sections a-h (g=fresh-clone verbatim, h=rubric->file:line
  +test); 271-273 recusal/WAIVES ABS-14; 270/279-281 wave-N battery
  (FROZEN sha, POST-S DELTA never STOP); 282 seven contact FK tables;
  285/286 pre-register defects, logs MANDATORY; 287 exit=grep 8 files
  (superseded by 303/304/307/315/320); tripwires(test/) docs-route-
  coverage/spa-contract-sweep/schema-fk-indexes/migration-parity;
  289-302: embed PATH SUFFIX, `travel_logistics`, PUBLIC_BASE_URL=
  localhost:8787 DEV-only, public non-200=>no-store, schedule int+
  bounds 400, NULL backfill, field delete 409/cascade=1.
- Campaign-2 w11 (DEC-303..306)=BATTERY-ONLY: 303 main moves UNDER
  planner; 305 ports a-h(8791-8794/8787), '-c3-' MANDATORY; 304
  superseded 307/315/320; 306 merge.ts tie-break refuted.
- Campaign-2 w12 (DEC-307..312)=NARROWING-FIX, not exit. 308 drizzle-
  orm ^0.45.2 (kit+config DELETED); 309 perf p95 MINUS /health floor,
  schedule.ics=public; 310 getPublicAgendaByIds (never hydrate whole
  agenda); 312 SQL WHERE normative, no app-code filters (precedent
  for 317/318).
- Campaign-2 w13 (DEC-313..316)=CLOSING battery, log-only lanes.
  314: '-c3-' MANDATORY, WAVE-12 GATE polls 10x60s then PARTIAL+
  PROCEEDS. 315 exit: seven w13 -c3- logs OPEN ITEMS:0/RESULT:PASS
  => goalComplete; partial => ZERO tasks (superseded by 320). 316:
  §D row=OPEN ITEM only if action fails; latency out of scope.
- Campaign-2 w14 (DEC-317..322)=NARROW FIX on verified defects, not
  a battery. VERIFIED live: only w13-a-c3 log on main (PASS@f6983e6);
  b/c/d/g/i/j still in worktrees => DEC-315 un-evaluable. Review-
  lens findings 1-4 are STALE (fixed by DEC-298/299/300/301); always
  re-verify before planning. 317: invite state = THREE gates —
  public(visible AND active), notify(active ONLY, ignore `visible`),
  portal(read=not declined, write=active);
  zero-recipient compose rejects loudly via a fields map like
  unscheduledIcsFields. 318: all 4 public schedule_slot reads carry
  the event [startDate,endDate] bound admin classifies on. 319:
  MAX_REMINDER_BATCH=100 + contactId order + 1h manual dedupe (vs
  cron's 24h) + reported remainder; cap, never reject. 321: default
  CFP gains optional locked job_title/company/bio on contact cols,
  blank-only fill. 322: safeExternalUrl http/https allowlist gates
  the first user-supplied href in the tree. 320 EXIT: DEC-315's seven
  logs AND a wave-15 confirmation pass at a post-w14 sha; see (i) not
  (ii) => ZERO tasks, wait.
