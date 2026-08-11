# task-w17-c: post-decomposition conformance + build/test/audit (DEC-330, DEC-332)

FROZEN SHA: `1fbc7f6b9cfa77c0efe33a0069206b14ef3ecf17` (main tip at task start — "scribe
wave 17"). This sha already contains task-custodian-w16-3's decomposition of
`src/server/repo/public.ts` into a re-export barrel over
`src/server/repo/public/{gates,event,sessions,speakers,detail,agenda}.ts`
(commit `6206b4a`, landed after every green lane in the w13/w15 chain froze —
after `f0d56ce` (w15-c) and after `2fe1ea0` (w15-d/e)). No build, test, or
audit evidence existed at any sha containing that split before this task.

## Part 1 — Restored guard (DEC-332)

The pre-split `public.ts` carried, immediately after its imports:

```ts
import { DEC_258 } from "../../decisions";
...
// Compile-checked dependency marker: every speaker title/company read below
// comes from participant.title_at_time/org_at_time (DEC-258's frozen
// snapshot), never the live contact — no fallback.
void DEC_258;
```

After the split, only `src/server/repo/public/detail.ts:8,18` kept this
marker. Two submodules read the same frozen-snapshot columns
(`participant.titleAtTime`/`participant.orgAtTime`) with no compile-checked
DEC-258 dependency:

- `src/server/repo/public/sessions.ts:185-186` (speaker-row select inside
  `hydrateSessions`, reading `title: schema.participant.titleAtTime,
  company: schema.participant.orgAtTime,` at the time of audit — now at
  `sessions.ts:191-192` after the import block was added below).
- `src/server/repo/public/speakers.ts:43-44` (speaker-row select inside
  `getPublicSpeakers`, same two columns — now at `speakers.ts:49-50` after
  the import block was added below).

Fix applied verbatim to both files: added
`import { DEC_258 } from "../../../decisions";` (three levels up from
`repo/public/`), the one-line comment, and `void DEC_258;`, immediately after
each file's existing import block. No other behaviour change in either file.

Post-fix locations of the marker:
- `src/server/repo/public/sessions.ts:13,20` (import + `void DEC_258;`).
- `src/server/repo/public/speakers.ts:7,14` (import + `void DEC_258;`).
- `src/server/repo/public/detail.ts:8,18` (untouched — already present
  pre-task).

All three public submodules that read `participant.titleAtTime`/
`participant.orgAtTime` now carry the compile-checked DEC-258 marker.

## Part 2 — Build / test / audit at the fix sha

Commands run verbatim, in the worktree, no server boot, no port assigned:

1. `([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund)` —
   `added 366 packages`.
2. `npm run build` — runs `tsc --noEmit && tsc --noEmit -p app/tsconfig.json
   && vite build --config app/vite.config.ts`. Both `tsc --noEmit`
   invocations completed with zero output (clean) before vite ran; vite
   build succeeded, `138 modules transformed`, emitted to `../public/admin`.
   Confirmed `"strict": true` still set in both `tsconfig.json:6` and
   `app/tsconfig.json:8` — untouched by this task.
3. `npm test` — **226 test files passed (226), 1888 tests passed (1888)**.
   Zero failures. Grep sweep of `test/` and `app/src/` for
   `\.skip\(|it\.todo|xit\(|describe\.skip` — zero matches (exit code 1,
   no output).
4. `npm audit --omit=dev` — **0 vulnerabilities** (production dependency
   tree clean).
5. `npm audit` (full tree, includes devDependencies) — 4 vulnerabilities
   recorded: `form-data` 4.0.0-4.0.5 (high, CRLF injection via unescaped
   multipart field/filenames), `lodash` <=4.17.23 (high, code injection via
   `_.template` + prototype pollution via `_.unset`/`_.omit`), `react-router`
   6.0.0-7.17.0 / `react-router-dom` (moderate, open redirect + arbitrary
   constructor injection in SSR hydration deserializeErrors — not exercised,
   this is a Stage-1 SPA with no SSR). Per DEC-302 these are **recorded, not
   open items** — all four advisories resolve to devDependency-only
   transitive packages (build tooling / dev-time react-router usage in the
   admin SPA's dev chain), none reachable from the production `--omit=dev`
   dependency tree, which audits clean.
6. Four tripwires:
   `npx vitest run test/docs-route-coverage.test.ts
   test/spa-contract-sweep.test.ts test/schema-fk-indexes.test.ts
   test/migration-parity.test.ts` — **4 test files passed (4), 12 tests
   passed (12)**.

## Part 3 — Re-anchored citations (DEC-328/DEC-332)

`task-w15-c-c3-build-test.md`'s Part B cites the pre-split monolithic
`src/server/repo/public.ts` by line for the wave-14 surfaces. Re-anchored to
the post-decomposition submodules at this task's sha:

- **DEC-274 gates** (previously `public.ts:44`/`55`/`73`), now in
  `src/server/repo/public/gates.ts`:
  - `visibleSessionConditions()` — `gates.ts:25`.
  - `visibleParticipantConditions()` — `gates.ts:36`.
  - `visibleSubmissionConditions()` — `gates.ts:54`.
- **`slotWithinEventRange`** (previously `public.ts:84`), now
  `gates.ts:65`, ANDed into all four public schedule_slot reads (DEC-318):
  - `src/server/repo/public/sessions.ts:238` — inside `hydrateSessions`.
  - `src/server/repo/public/detail.ts:43` — inside
    `getScheduleInfoForSubmissions`.
  - `src/server/repo/public/agenda.ts:40` — inside `getPublicAgenda`.
  - `src/server/repo/public/agenda.ts:120` — inside `getPublicAgendaByIds`.
- **`getPublicAgendaByIds`** (DEC-310; previously `public.ts:806`), now
  `src/server/repo/public/agenda.ts:90`.
- **`safeExternalUrl` consumption** (DEC-322; previously `public.ts:644`
  inside `getPublicSpeakerDetail`), now `src/server/repo/public/detail.ts:158`
  inside `getPublicSpeakerDetail` (declared `detail.ts:96`).

**Barrel re-export completeness**: diffed the pre-split file's export list
(`git show 6206b4a~1:src/server/repo/public.ts | grep '^export'`, 22 exports:
3 gate functions, `PublicEvent`/`getPublicEventBySlug`,
`PublicTrack`/`getPublicTracks`, `PublicSpeaker`, `PublicSession`,
`PublicSessionsPage`/`getPublicSessions`/`getPublicSessionsByIds`,
`PublicSpeakerWithSessions`/`getPublicSpeakers`,
`PublicSpeakerDetailSession`/`PublicSpeakerDetail`/`getPublicSpeakerDetail`,
`PublicSessionDetail`/`getPublicSessionDetail`, `PublicAgendaItem`/
`getPublicAgenda`/`getPublicAgendaByIds`) against `src/server/repo/public.ts`'s
current barrel (`export { ... } from "./public/{gates,event,sessions,
speakers,detail,agenda}"` blocks, lines 21-44): all 22 symbols present,
none dropped, none renamed. `slotWithinEventRange` was never part of the
pre-split public export surface (internal helper only), so its absence from
the barrel is not a regression. Confirmed call sites resolving through the
unchanged barrel path are unbroken: `src/routes/public/{shell,sessions,
dispatch,cards,index,feeds,speakers,detail,agenda}.tsx` and
`src/server/repo/profile.ts:11` (`import { visibleSubmissionConditions }
from "./public";`) — none needed edits, `npm run build`/`npm test` above
confirm they still resolve and type-check.

**Citation staleness never re-opens findings**: the line-number drift in
`task-w15-c-c3-build-test.md` Part B is caused solely by
task-custodian-w16-3's mechanical decomposition (contention-relief,
no behavior change per that commit's own message and the diff confirming
identical logic per function, only relocated). Per DEC-328, a lens citation
aging out because a module moved is not itself a finding — the underlying
wave-14 guarantees (DEC-274 speakerless-session visibility, DEC-318
schedule-slot event-range bounding, DEC-310 id-scoped agenda lookup, DEC-322
safe external URL filtering) are unchanged in substance and their tests
(all 226 files, 1888 tests) pass at this sha. task-w15-d already confirmed
these findings live at `2fe1ea0`; this task's job was solely to re-anchor
the file:line pointers, which is now done above. **This does not re-open any
wave-14 open item.**

## OPEN ITEMS

None. DEC-332's dropped-guard defect is fixed (Part 1). Build, full test
suite, both audit invocations, and all four tripwires are green at the fix
sha (Part 2). Wave-14 citation staleness is re-anchored with no substantive
regression found (Part 3).

## RESULT

**PASS.** DEC-332 guard restored in `sessions.ts` and `speakers.ts`; build
clean (both `tsc --noEmit` invocations, strict mode intact); 226/226 test
files, 1888/1888 tests green, zero skips; `npm audit --omit=dev` clean, full
`npm audit`'s 4 advisories are dev-only per DEC-302 and recorded above; all
four tripwires green; barrel re-export surface verified complete; wave-14
citations re-anchored to the post-decomposition submodule paths.

## RECHECK SHA

`<pending commit of this task>` — the commit created by this task on branch
`task-w17-c`, containing only the two-file DEC-258 guard restoration plus
this verification log. Run `git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline
-1 task-w17-c` after merge for the concrete sha.

## POST-S DELTA (DEC-280: informational, never a STOP)

Between FROZEN SHA and the fix sha, the only change is the two-file DEC-258
guard restoration in `src/server/repo/public/{sessions,speakers}.ts` plus
this document. No other file differs. This is a strict-narrowing delta (adds
a compile-checked marker + comment; zero runtime/behavioral change) and does
not warrant a STOP under DEC-280 — reported here as the POST-S delta record
only.
