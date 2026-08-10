# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs = verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml; fixtures
  (never referenced by product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route
  map + admin nav (exact strings). Pure-core (DEC-002): src/{auth,domain,
  forms,mail,lib} import nothing from node:/cloudflare.
- DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (app.ts + scheduled.ts, DEC-035). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked fields = real cols.
- Wave-3/4/5/6: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError http.ts; ctx factories context.ts; check app/src/lib/api.ts
  first. Compose (DEC-019) atomic, >100 recipients rejects. Public data
  only via repo/public.ts gate. Portal sub-apps share
  routes/portal/shared.tsx. Bearer chq_ in sessionLoader (CSRF-exempt),
  cookie-only mint. DEC-036 formWindowState(). DEC-037 email HTML ONLY
  escapeHtml/textToHtml. DEC-038 rate-limit.ts scoped KV. DEC-039 review
  resolves plans only via getPlanForOrg. DEC-040/041 form-answer uploads
  kind 'attachment', speaker edit routes/portal/edit.tsx. DEC-043/044
  reviewer mgmt /api/v1/users + plan_reviewer ids. DEC-050 locked fields
  PK '<formId>:<name>'. DEC-049 /admin worker-first via ASSETS; GET /
  SSR. DEC-047/048 resources kind 'resource'; seed writes .seed-assets/.
- Wave-7/8/9/10: DEC-051 compose attachIcs/ics_sequence. DEC-057 scoped
  limiter scope 'submit'. DEC-052 App.tsx-only React.lazy. DEC-054/055/056
  statuses deferred, showflow.csv, /docs/api SSR. DEC-058 perf CI budget
  (js+css<300KB gz). DEC-059 headshots downscale 512px (superseded by
  DEC-067). DEC-060 verification modular
  scripts/walkthrough/{producer,review,speaker,public,data}.ts, DEC-053
  conventions (cookie jar, chq_csrf, 'x-chq-csrf:1'). DEC-061 closes §10.
  DEC-062 runner order producer->review->speaker->public->data. DEC-063
  CI job 'walkthrough'. Unresolved Qs = 'PLANNER:'. w8-e/w9-a/w9-b
  DROPPED w/ ZERO commits; rebuilt as w10-a. DEC-064 claim POST consumes
  only right before user insert; DEC-065 task-assignment uploads via
  third GET /files/:fileId branch; DEC-066 reviewers download submission
  files iff plan_reviewer on event; DEC-067 /headshots/:fileId 404s
  unless a contact references it.
- Wave-11: tree moves MID-PLANNING — always re-read refs/reflog before
  concluding a branch dropped. Verified live on main: DEC-064/065/066/067
  + full DEC-062/063 walkthrough stack + CI job. w11-a = FIFTH zero-commit
  drop; root cause: triage-in-commit-body means a clean pass = empty
  diff = dropped branch. DEC-068: verification results land in tracked
  docs/verification-log.md (append-only, '## <date> <branch> — <scope>
  @ <sha>' sections; commit mandatory even on green). Planner
  re-verified ALL prior findings fixed live on main f6e3422, each with
  tests. w12 split 3-wide: w12-a build+test, w12-b seeded walkthrough
  (mirror ci.yml:57-85), w12-c commit-body defect harvest of w8-b..g +
  w10-b/c/d. Wave-13: if verification-log.md shows green + clean triage,
  return ZERO tasks, goalComplete: true; FAIL/open-PLANNER lines become
  the final fix tasks.
