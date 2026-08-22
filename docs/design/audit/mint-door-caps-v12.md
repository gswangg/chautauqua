# Mint-door cap census (DEC-180, wave-23 amendment)

MEASUREMENT ONLY. This lane files the roster; it fixes no door. Measured on
branch `v12m-w23-d`, sha `e3b90e69749476eb143d9b421f57e8397ed88cbd` (base
`main` before this wave's other lanes land — in particular `v12m-w23-b`,
which is capping the templates door in this same batch: the template row
below may already read PASS by the time these lanes merge, depending on
merge order. **This doc reports what was measured on the sha above, not a
prediction of the post-merge state.**

## Why this census exists

`test/batch-cap-declaration.scan.test.ts` and `app/src/cap-crossing.scan.test.ts`
both start from the DECLARED caps (`export const MAX_* = <number>` in
`src/domain/**`) and grade where they live, how they cross into the SPA, and
whether copy quotes them. Neither starts from the WRITE DOORS and asks
whether each has a cap **at all** — which is exactly how
`POST /api/v1/events/:eventId/templates` shipped with no bound past both. A
population derived from the answers can never find a missing answer
(DEC-180's own rule). This census enumerates every `POST /api/v1/...`
handler under `src/routes/**` (via `readdirSync`, never a hand-listed file
array — see `test/mint-door-cap-census.scan.test.ts`), classifies each as a
MINT door (reaches a `db.insert(` in its own handler or in a specific
`src/server/repo/**` function) or a NON-MINT door, and grades every MINT
door PASS iff it references a batch/count `MAX_*` constant or carries a
`mint-cap-exempt: <reason>` comment.

## Grading rule, precisely

A MINT door's handler body, or the one named `src/server/repo/**` insert
function it calls, is scanned for `MAX_[A-Z0-9_]*` identifiers. Names ending
`_LENGTH`/`_MAX_LEN` are **excluded** — that partition is not invented here,
it reuses `test/batch-cap-declaration.scan.test.ts`'s own established
distinction (`isTextLengthName`, DEC-422) between a text-length bound on one
field and a batch/count cap on how many rows can accumulate or how large one
mint's batch is. Without that exclusion the census is vacuous: `templates`
already references `MAX_NAME_LENGTH`/`MAX_TEXT_LENGTH`/`MAX_RICH_TEXT_LENGTH`
for field validation and would read PASS despite having zero cap on how many
templates an event can accumulate — the motivating gap this census exists to
catch. If the census had graded on *any* `MAX_*` reference (the more literal
reading of the mandate text), it would have missed that gap entirely; this
narrower reading is what makes the instrument actually work.

**Scope limitation, stated plainly:** the grading surface is the handler's
own body text plus the one *named* repo function's body text — nothing
transitively reached through a shared, non-repo helper (e.g.
`src/routes/review/shared.ts`, `src/server/http.ts`) is scanned. This misses
two real caps that exist but sit outside the grading surface as specified:
`MAX_PLAN_ROUNDS` (inside `parseRounds`'s own body in
`src/routes/review/shared.ts`, called but not inlined by the plans-create
handler) and `DEFAULT_BOUNDED_ID_ARRAY_MAX` (inside `parseBoundedIdArray` in
`src/server/http.ts`, a validator module, not `src/server/repo/**`). Both
doors are recorded as uncapped below for that reason — worth a follow-up
amendment widening the grading surface, not something this measurement-only
lane should decide unilaterally.

## The doors (16 total: 9 mint, 7 non-mint)

| Route | File | Kind | Repo write reached | Cap / exemption | Verdict |
|---|---|---|---|---|---|
| `POST /api/v1/forms/:formId/fields` | `api/forms.ts` | mint | `repo.createField` → `db.insert(schema.formField)` | `MAX_FORM_FIELDS` (existing.length gate before insert) | **PASS** |
| `POST /api/v1/forms/:formId/fields/reorder` | `api/forms.ts` | non-mint | — (reorders existing rows) | — | n/a |
| `POST /api/v1/tokens` | `api/tokens.ts` | mint | handler itself → `db.insert(schema.apiToken)` | `MAX_API_TOKENS_PER_ORG` (existingCount gate before insert) | **PASS** |
| `POST /api/v1/users/:id/reset-password` | `api/users.ts` | non-mint | — (rotates existing hash) | — | n/a |
| `POST /api/v1/users` | `api/users.ts` | mint | `repo.createUser` → `db.insert(schema.user)` | none (only `MAX_NAME_LENGTH`/`MAX_PASSWORD_LENGTH`, text-length) | **FAIL — uncapped** |
| `POST /api/v1/events/:eventId/portal-invites` | `comms/portal-invites.ts` | mint | `mintPortalLinks` (KV credential mint) + mailer `email_log` insert | `MAX_PORTAL_INVITE_RECIPIENTS` (`parseBoundedIdArray` maxCount) | **PASS** |
| `POST /api/v1/events/:eventId/compose/preview` | `comms/preview.ts` | non-mint | — (dry-run render) | — | n/a |
| `POST /api/v1/events/:eventId/compose/send` | `comms/send.ts` | non-mint | — (sends to existing recipients; `email_log` write is a mailer side-effect, not this door's primary mint) | — | n/a |
| `POST /api/v1/events/:eventId/templates` | `comms/templates.ts` | mint | `repo.createTemplate` → `db.insert(schema.emailTemplate)` | none (only `MAX_NAME_LENGTH`/`MAX_TEXT_LENGTH`/`MAX_RICH_TEXT_LENGTH`, text-length) | **FAIL — uncapped** (the motivating gap; `v12m-w23-b` capping in this batch) |
| `POST /api/v1/plans/:id/advance-round` | `review/plans-crud.ts` | non-mint | — (advances existing plan row) | — | n/a |
| `POST /api/v1/plans/:id/waves` | `review/plans-crud.ts` | non-mint | `repo.startNewWave` is `db.update`, not insert | (also gated on `plan.rounds >= MAX_PLAN_ROUNDS` regardless) | n/a |
| `POST /api/v1/events/:eventId/plans` | `review/plans-crud.ts` | mint | `repo.createPlan` → `db.insert(schema.evaluationPlan)` | none in grading surface (only `MAX_NAME_LENGTH`/`MAX_LONG_TEXT_LENGTH`, text-length; `MAX_PLAN_ROUNDS` exists but lives inside `parseRounds`'s body in `shared.ts`, out of scope — see limitation above) | **FAIL — uncapped by this census's rule** |
| `POST /api/v1/plans/:id/assignments/distribute` | `review/plans-distribute.ts` | mint | `repo.addReviewers` → `db.insert(schema.planReviewer)` | `MAX_DISTRIBUTE_ASSIGNMENT_WRITES` (pre-write refusal on `created.length`) | **PASS** |
| `POST /api/v1/plans/:id/remind` | `review/plans-progress.ts` | non-mint | — (emails existing reviewer rows) | — | n/a |
| `POST /api/v1/plans/:id/reviewers` | `review/plans-reviewers.ts` | mint | `repo.addReviewers` → `db.insert(schema.planReviewer)` | none in grading surface (`parseBoundedIdArray`'s `DEFAULT_BOUNDED_ID_ARRAY_MAX` bounds the array-form batch but lives in `src/server/http.ts`, not `src/server/repo/**` — see limitation above) | **FAIL — uncapped by this census's rule** |
| `POST /api/v1/review/plans/:planId/recusals/:submissionId` | `review/recusals.ts` | mint | `repo.createRecusal` → `db.insert(schema.reviewRecusal).onConflictDoNothing` keyed on the `(planId, submissionId, userId)` uniqueIndex | none (only `MAX_RECUSAL_REASON_LENGTH`, text-length); structurally bounded by the uniqueIndex, but no `MAX_*`/exemption on this door | **FAIL — uncapped** |

## Corrective note against the census's own mandate

The task mandate that opened this lane listed "distribute" as an
illustrative NON-MINT example alongside preview/send/reorder/advance-round/
remind/reset-password. That is wrong for this codebase:
`plans-distribute.ts`'s handler calls `repo.addReviewers`, which
`db.insert`s `plan_reviewer` rows for the whole computed assignment set — a
genuine mint. It happens to PASS anyway (`MAX_DISTRIBUTE_ASSIGNMENT_WRITES`
gates the write), so this correction changes no offender count, but the
doors table above classifies it as mint per DEC-967 ("a citation is not an
assertion") — the actual code, not the illustrative list, decided the
classification.

## Result

- **16 doors total: 9 mint, 7 non-mint.**
- **5 mint doors are uncapped** by this census's grading rule:
  `POST /api/v1/users`, `POST /api/v1/events/:eventId/templates`,
  `POST /api/v1/events/:eventId/plans`, `POST /api/v1/plans/:id/reviewers`,
  `POST /api/v1/review/plans/:planId/recusals/:submissionId`.
- `test/mint-door-cap-census.scan.test.ts` ratchets this at
  `MINT_DOOR_UNCAPPED_CEILING = 5`, two-sided per DEC-808, seeded by forcing
  the constant to `-1` and reading the offender list back (recorded in the
  test's `SEEDED MEASUREMENT` case and in this doc — never invented, never
  converted into an allowlist). It carries a vacuity tripwire (exact 16-door
  population, 9/7 mint/non-mint split) and two positive controls (a
  synthetic uncapped fixture must grade FAIL; the same fixture with a real
  batch/count `MAX_*` must grade PASS) plus a `mint-cap-exempt` control, so
  the scan cannot pass green over an empty match.

This lane fixes none of the five. It files the roster.
