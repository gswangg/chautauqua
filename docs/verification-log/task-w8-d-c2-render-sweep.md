# task-w8-d - render-sweep @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d
OPEN ITEMS: 0
RESULT: PASS

## Method

1. `git worktree add --detach` this repo at `80b811d250285de0d37417ddc12f65445ce27f96`
   (`chautauqua-wt/task-w8-d-scratch`, removed after use). Confirmed
   `git merge-base --is-ancestor 80b811d... refs/heads/main` (ancestor OK).
2. `npm ci --prefer-offline --no-audit --no-fund --silent` (node_modules absent
   in the fresh worktree).
3. `npm run predev` (`tsx scripts/ensure-dev-vars.ts && vite build --config
   app/vite.config.ts`) — this is the command that produced `public/admin`
   (index.html + assets/*.js) per DEC-268; confirmed present with
   `ls public/admin` before any server boot, so the sweep below is not a
   false pass from an unbuilt SPA.
4. `npm run db:migrate` (17 migrations applied clean) then `npm run seed`
   (D1 rows + 8 R2 objects) as a manual smoke check.
5. Manually booted `npx wrangler dev --port 8793 --var
   PUBLIC_BASE_URL:http://localhost:8793` (lane d's reserved port, DEC-286)
   and confirmed `GET /login` -> 200, `GET /admin` -> 302 (pre-auth
   redirect, expected) against the pre-built `public/admin` bundle, then
   stopped that process.
6. `rm -rf .wrangler/state` to give the gate script (which does its own
   migrate+seed) a clean local D1/R2, then ran `npm run gate:render-sweep`
   (`scripts/render-sweep.ts`). The script builds the admin SPA bundle
   itself (DEC-268 comment at scripts/render-sweep.ts:266-268), re-applies
   migrations+seed, and boots its own `wrangler dev` on an internally
   `findFreePort()`-selected port (61358 this run) — this is the actual
   pass/fail source of truth, run in full twice: once at FROZEN SHA, once
   at RECHECK SHA (step 8).
7. POST-S DELTA (below) was non-empty, so per DEC-270/285 opened a second
   detached worktree (`chautauqua-wt/task-w8-d-recheck`) at
   `refs/heads/main` = `50354380d299969b12d0b46548cb77d28e861c9d`, `npm ci`,
   and re-ran `npm run gate:render-sweep` there in full (not just a partial
   check) since the delta touches `src/server/repo/{contacts,tasks}.ts`,
   which are exercised by admin `/admin/contacts` and portal `/portal/tasks`
   routes in the desktop pass.

## Desktop pass (34/34 PASS, both SHAs — identical results)

| route | role | status |
|---|---|---|
| /admin/overview | organizer | PASS |
| /admin/submissions | organizer | PASS |
| /admin/submissions/forms | organizer | PASS |
| /admin/submissions/seed_submission_0001 | organizer | PASS |
| /admin/speakers | organizer | PASS |
| /admin/content | organizer | PASS |
| /admin/agenda | organizer | PASS |
| /admin/comms | organizer | PASS |
| /admin/contacts | organizer | PASS |
| /admin/settings | organizer | PASS |
| /admin/review | organizer | PASS |
| /admin/review/plans/new | organizer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001 | organizer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001/progress | organizer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001/results | organizer | PASS |
| /admin/review | reviewer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001 | reviewer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 | reviewer | PASS |
| /portal | speaker | PASS |
| /portal/submissions/seed_submission_0001 | speaker | PASS |
| /portal/submissions/seed_submission_0001/edit | speaker | PASS |
| /portal/profile | speaker | PASS |
| /portal/tasks | speaker | PASS |
| /portal/tasks/seed_task_assignment_0001/form | speaker | PASS |
| /e/devflow-conf-2027/sessions | public | PASS |
| /e/devflow-conf-2027/speakers | public | PASS |
| /e/devflow-conf-2027/gallery | public | PASS |
| /e/devflow-conf-2027/agenda | public | PASS |
| /e/devflow-conf-2027/schedule | public | PASS |
| /submit/devflow-conf-2027 | public | PASS |
| /account/password | organizer | PASS |
| /account/password | reviewer | PASS |
| /account/password | speaker | PASS |
| /admin/* | organizer | PASS |

No console error, no pageerror, no blank #root/body, no SPA-vs-route key
mismatch (script asserts non-empty rendered content + zero console
error/pageerror events with no allowlist) on any of the 34 routes.

## Mobile pass, 390x844 (DEC-253) — 13/13 PASS, both SHAs — identical results

document.scrollingElement.scrollWidth measured against window.innerWidth
(390px); overflowPx = scrollWidth - innerWidth (pass requires <=1px slack).
minControlPx = smallest primary nav/filter/tap target height on the page
(pass requires >=40px).

| route | scrollWidth vs innerWidth (overflowPx) | minControlPx | status |
|---|---|---|---|
| /submit/devflow-conf-2027 | 0 | 40 | PASS |
| /e/devflow-conf-2027/sessions | 0 | 40 | PASS |
| /e/devflow-conf-2027/speakers | 0 | 40 | PASS |
| /e/devflow-conf-2027/agenda | 0 | 40 | PASS |
| /e/devflow-conf-2027/schedule | 0 | 40 | PASS |
| /e/devflow-conf-2027/gallery | 0 | 40 | PASS |
| /e/devflow-conf-2027/sessions/seed_submission_0001 (session detail) | 0 | 40 | PASS |
| /e/devflow-conf-2027/speakers/seed_contact_0001 (speaker detail) | 0 | 40 | PASS |
| /embed/devflow-conf-2027/sessions | 0 | 40 | PASS |
| /embed/devflow-conf-2027/agenda | 0 | 40 | PASS |
| /embed/devflow-conf-2027/speakers | 0 | 40 | PASS |
| /login | 0 | 40 | PASS |
| /portal | 0 | 40 | PASS |

Agenda time-grid overflow-x container: `/e/devflow-conf-2027/agenda` and
`/embed/devflow-conf-2027/agenda` both measured 0px page-level overflow
(the grid does not collapse its columns into the page), consistent with
the grid scrolling inside its own container: `.chq-agenda-day-scroll {
overflow-x: auto; -webkit-overflow-scrolling: touch; ... }` defined at
`src/routes/public/shell.tsx:95`, applied to the day-grid wrapper at
`src/routes/public/agenda.tsx:39`.

No OPEN ITEMS — every route in both passes measured PASS at both SHAs.

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty (task-w7-a landed between S and main tip). Not treated as a
failure or a stop condition per DEC-280.

## KNOWN IN-FLIGHT AT S (DEC-285)

- `src/server/repo/contacts.ts:207` (CONTACT_FK_TABLES missing
  `pipeline_entry`, six of seven contact FK tables) — at RECHECK SHA
  `50354380d299969b12d0b46548cb77d28e861c9d`, `CONTACT_FK_TABLES` at
  `src/server/repo/contacts.ts:200-208` lists all seven tables including
  `pipeline_entry` (added by `50a2947`). **CLOSED**, not present at
  RECHECK SHA.
- `src/server/repo/tasks.ts:263` (`listAcceptedContactIds` unfiltered) —
  at RECHECK SHA, `listAcceptedContactIds` (`src/server/repo/tasks.ts:263`)
  is documented and gated through `isActiveParticipant` per DEC-278/DEC-283
  (added by `7f003dd`). **CLOSED**, not present at RECHECK SHA.

Both fixes are in `src`, which the render-sweep desktop pass exercises via
`/admin/contacts` (contacts merge/CRM UI) and `/portal/tasks` +
`/admin/review/*` (task-assignment expansion) — re-running the full
render-sweep gate at RECHECK SHA (not just a source-diff read) confirmed
both routes and all others still render clean with these fixes in place;
no regression introduced by the merge.
