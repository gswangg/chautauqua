# task-w12-e: SPEC.md / README.md doc-truth repair (DEC-428)

Docs-only task (no source, no test, no script touched). Scope: SPEC.md and
README.md only, per DEC-428.

## (1) SPEC.md:308 PBKDF2 iteration count

Changed from:

> - PBKDF2-SHA256 (≥600k iterations), constant-time compares; session rotation on login.

to:

> - PBKDF2-SHA256 (100,000 iterations, the workerd production ceiling; DEC-004/DEC-237), constant-time compares; session rotation on login.

Rationale: `src/auth/password.ts` pins `ITERATIONS = 100_000`. This is the
binding, ratified value per `decisions/DEC-004.md`'s 2026-08-11 amendment and
`decisions/DEC-237.md` — production workerd throws `NotSupportedError` above
100,000 iterations, so the original 600k spec value is not implementable on
the runtime this product deploys to. This is a correction of the swarm's own
synthesis (no doc under `docs/` specifies an iteration count anywhere); it is
not an override of a customer/source requirement. Five prior spec audits
(`docs/verification-log/task-w4-e-spec-audit.md:44`,
`task-w8-e-c2-spec-audit.md:17`, `task-w11-f-spec-audit-stage1.md:160-166`,
`task-w23-e-c3-spec-audit.md:78`) each re-raised this as a discrepancy and
concluded "binding amendment, not a gap" without editing SPEC.md; this task
closes the loop by editing the prose itself. Nothing else in SPEC §6 changed
(confirmed by diff — only this one bullet line was touched).

## (2) README.md "For evaluators" persona credentials + URLs

Byte-compared every row of the "For evaluators" persona table
(`README.md`, "Seeded persona credentials" table) against the `identities`
equivalent in `docs/fixtures/sample-data.json` (top-level keys `organizer`,
`speaker`, `speaker2`, `reviewer` — the fixture has no `identities` wrapper
key; these four objects are what `scripts/seed.ts` and
`scripts/render-sweep.ts` read):

| Persona | README email | Fixture email | README password | Fixture password | Match |
|---|---|---|---|---|---|
| Organizer | `sbek-organizer@example.com` | `sbek-organizer@example.com` | `SbekTest!2027-org` | `SbekTest!2027-org` | yes |
| Speaker | `sbek-speaker@example.com` | `sbek-speaker@example.com` | `SbekTest!2027-spk` | `SbekTest!2027-spk` | yes |
| Speaker (second) | `sbek-speaker2@example.com` | `sbek-speaker2@example.com` | `SbekTest!2027-spk2` | `SbekTest!2027-spk2` | yes |
| Reviewer | `sbek-reviewer@example.com` | `sbek-reviewer@example.com` | `SbekTest!2027-rev` | `SbekTest!2027-rev` | yes |

Same table also appears (organizer/reviewer/speaker only, no speaker2 —
deliberate, that surface is the live-demo blurb not the evaluator table) in
the "Live demo" section at the top of README.md; those three rows byte-match
the fixture too.

No drift found. This is a re-confirmation, not a repair — the drift noted as
"not re-diffed" two campaigns ago
(`docs/verification-log/task-w11-f-spec-audit-stage1.md:90`) does not
currently exist; either it was fixed in an intervening wave or the earlier
note was a caution rather than a found discrepancy. Nothing in README.md's
persona/URL content was changed by this task.

Route URLs in both the "Live demo" and "For evaluators" tables (`/login`,
`/admin`, `/portal`, `/submit/<slug>`, `/e/<slug>/sessions|speakers|agenda|
schedule|gallery`, `/embed/<slug>/<surface>`, `/dev/mailbox`, `/docs/api`)
were spot-checked against `app/src/routeManifest.ts` and
`src/routes/*` mount points; no stale routes found.

## Quickstart command sequence (README.md:43-46)

README.md's quickstart block:

```
npm i
npm run db:migrate
npm run seed
npm run dev
```

matches `package.json` verbatim:

- `db:migrate` → `wrangler d1 migrations apply chautauqua --local`
- `seed` → `tsx scripts/seed.ts && wrangler d1 execute chautauqua --local --file=.seed.sql && tsx scripts/seed-r2.ts`
- `dev` → `wrangler dev` (with `predev` hook building the admin SPA bundle,
  as README.md's following paragraph already documents)

No drift; no change made to this block.

## (3) README.md 600k iteration figure

Searched README.md for `600` — zero matches. README.md never repeated the
600k iteration figure, so there was nothing to correct here.

## Gates

`npm run build` PASS. `npm test --silent` PASS — full suite green, unchanged
from before this docs-only edit (expected: no source/test file was touched).

## Summary of file changes

- `SPEC.md`: one line changed (§6, line 308 as filed in the task; the
  ≥600k bullet corrected to 100,000 with DEC-004/DEC-237 citation).
- `README.md`: no changes — persona credentials, URLs, and quickstart
  commands were all confirmed already accurate; no 600k figure present.
- `docs/verification-log/task-w12-e-doc-truth.md`: this file (new).
- `docs/verification-log.md`: one appended section (this task's summary).
