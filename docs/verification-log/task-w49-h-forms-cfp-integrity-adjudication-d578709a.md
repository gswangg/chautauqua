# task-w49-h — CFP form-builder and public-submit integrity adjudication

DOCS ONLY. No file under `src/`, `app/src/`, `migrations/`, `scripts/`, or
`package.json` was touched — this is an adjudication-only lane per
DEC-069 (a gate inside a code wave can never qualify) and DEC-358
(adjudicate the whole population, don't accrete a list of maybes).

Surface read at this task's own runtime (HEAD `d578709a`, worktree
`task-w49-h` cut from `main`): `src/routes/api/forms.ts`,
`src/forms/{builder,visibility,rule-match,validate,types}.ts`,
`src/server/repo/forms.ts`, `src/lib/submit-core.ts`,
`src/routes/public/{submit,submit-get,submit-post,submit-draft,submit-guards,
submit-body,submit-messages,submit-views}.tsx?`, `src/server/repo/submit.ts`.

Explicitly out of scope, already owned this wave (not re-derived, not
re-filed): the PATCH-invalidates-a-sibling-rule gap in
`src/routes/api/forms.ts` (task-w49-b), the agenda/schedule feed envelope
(task-w49-d), the spec9 close-date-lock test / day-label contract
(task-w49-a), and anything owned by committed-but-unmerged task-w47-a or
task-w47-g.

## Claim 1 — CONFIRMED-DEFECT: `createField`'s position allocation is a
read-then-write race, not the atomic-subquery pattern this codebase
already uses for the identical class of counter

`src/server/repo/forms.ts:369-392` (`createField`):

```
export async function createField(db: Db, formId: string, input: CreateFieldInput): Promise<FormFieldRow> {
  const existing = await listFields(db, formId);
  const maxPosition = existing.reduce((max, f) => Math.max(max, f.position), -1);
  ...
  await db.insert(schema.formField).values({
    ...
    position: maxPosition + 1,
    ...
  });
```

This is a plain SELECT (via `listFields`) followed by a separate INSERT
using a value computed from that SELECT — no DB-level atomicity ties the
two together. `formField.position` (`src/db/schema/event.ts:70`) carries
no `uniqueIndex`, so nothing downstream rejects a duplicate.

The codebase has already diagnosed and fixed exactly this class of bug for
a structurally identical counter: `src/server/repo/submissions/seq.ts`
(DEC-100) replaces a "SELECT-then-INSERT" for `submission.seq` with an
atomic `(SELECT COALESCE(MAX(seq),0)+1 ...)` subquery embedded directly in
the INSERT's own values, with the header comment stating plainly: "Rather
than a SELECT-then-INSERT (a UNIQUE-violation race under concurrent
submits to the same event), this fragment is passed straight into the
`seq` column of the single INSERT statement." `createField` is the same
shape DEC-100 was written to retire, just for `position` instead of `seq`,
and it silently reused the retired shape.

Consequence: two POST `/api/v1/forms/:formId/fields` requests against the
same form (e.g. an organizer double-clicking "Add question", or two
organizer sessions in the same org editing the same form concurrently —
both are legitimate same-org, requireOrganizer-authenticated requests, not
a cross-tenant IDOR) that interleave (A's `listFields` read, B's
`listFields` read, A's insert, B's insert) both compute the same
`maxPosition` and both insert at that `maxPosition + 1`. Because there is
no uniqueness constraint on `position`, this does not throw (unlike the
UNIQUE-violation the DEC-100 comment describes for `seq`) — it silently
produces two sibling fields with an identical `position` value. Every
reader orders by `.orderBy(asc(schema.formField.position))` with no
secondary key (`listFields`, `getFormFields` in `src/server/repo/
submit.ts:131-136`), so the tie-break becomes DB-implementation-defined
(row insertion order is not a documented SQLite ORDER BY guarantee for
ties), and the organizer's builder UI, the public CFP form, and the
rule-cycle-detection walk in `src/forms/builder.ts` (which iterates
`fields` in whatever order the caller supplies) can each observe a
different relative order for the two colliding fields.

Falsifying check: an integration test that fires two concurrent
`repo.createField(db, formId, ...)` calls against the same `formId` (or
two concurrent POST `/api/v1/forms/:formId/fields` requests through the
Hono app) and asserts the two resulting fields have distinct `position`
values. Today this assertion fails intermittently under real interleaving,
and deterministically if the second call's `listFields` read is stubbed to
race the first call's insert (mirrors how DEC-100's own regression test —
`test/submission-seq-race` or equivalent — proves the seq subquery's
atomicity by forcing the interleaving).

Owner: UNOWNED (no wave-49 lane claims this file/function; not one of the
four explicitly-out-of-scope items above).

## Claim 2 — ADVISORY: `MAX_FORM_FIELDS` cap check shares the same
read-then-write race window as Claim 1

`src/routes/api/forms.ts:171-176`:

```
const existing = await repo.listFields(c.var.db, formId);
if (existing.length >= MAX_FORM_FIELDS) {
  throw new ApiError("invalid", ...);
}
```

Two concurrent creates that both read `existing.length` as
`MAX_FORM_FIELDS - 1` both pass the check and both insert, leaving the
form one field over the declared cap. Same request-interleaving window as
Claim 1, but the consequence is bounded (the form ends up with
`MAX_FORM_FIELDS + 1` fields, not silent data corruption or an
authz/visibility escape), and only reachable by an already-authenticated
organizer acting on their own org's own form. Advisory rather than
confirmed: worth closing in the same fix as Claim 1 (an atomic
INSERT-time position subquery would naturally want a `COUNT`-gated
variant too), but does not independently rise to a falsifiable
CONFIRMED-DEFECT distinct from Claim 1's root cause.

## Claim 3 — NOT-A-DEFECT: `save-draft` has no same-origin pre-check
(unlike final-submit), but is not thereby CSRF-exposed

`src/routes/public/submit-draft.tsx:29` mounts `csrfForm` (`src/server/
middleware.ts:296-309`) ahead of the handler; `csrfForm` unconditionally
throws `ApiError("invalid", "Missing CSRF cookie")` when the
`chq_csrf` cookie is absent and `ApiError("invalid", "CSRF token
mismatch")` when the posted `chq_csrf` form field doesn't match it
(`checkDoubleSubmitCsrf`, `src/server/middleware.ts:331-333` — "THE
double-submit CSRF comparison rule"). `submit-post.tsx`'s extra
`isSameOriginSubmitPost` check (`src/routes/public/submit-guards.ts:35-45`)
exists for a documented reason unrelated to CSRF defense-in-depth: per
`submit-post.tsx:63-68`, the in-body double-submit check on that route
runs manually (not via the `csrfForm` middleware) specifically so a
CSRF failure can re-render `<SubmitPage>` with the submitter's typed
answers intact rather than throwing a JSON-shaped `ApiError` that
discards them — the same-origin pre-check is a cheap short-circuit ahead
of that manual path, not an independent CSRF control. `save-draft`
redirects (302) rather than re-rendering on success and 400s via
`csrfForm`'s own `ApiError` on failure, so it has no typed-answers-to-
preserve problem to solve and no need for the extra pre-check. Both
routes end up equally CSRF-protected by the one double-submit rule
(DEC-544); this is a UX-shaped code-path difference, not a security gap.

## Claim 4 — DELIBERATE-BY-DESIGN: `reorderFields` issues one UPDATE per
row in a loop, not wrapped in a transaction

`src/server/repo/forms.ts:525-535`. This matches an explicit, already-
documented codebase-wide convention rather than an oversight:
`src/server/repo/submissions/status.ts:497-504` (DEC-079 wave-26
amendment) states "D1 has no interactive transaction available here and
`db.batch(` is not used anywhere in src/. This is deliberate: safety
rests on idempotence, not atomicity." `reorderFields` fits that same
shape: a partial failure mid-loop leaves some fields at their new
position and others at their old one, but re-issuing the same
`orderedIds` reorder call (the caller, `POST /api/v1/forms/:formId/
fields/reorder`, is naturally retryable by the organizer clicking "Save
order" again) re-sets every row's position from the same target list and
converges to the same terminal state — idempotent, per the established
convention. Distinguished from Claim 1: Claim 1 is not idempotent (two
racing `createField` calls each mint one NEW row from a stale read; there
is no "retry to the same value" to converge to), which is why Claim 1 is
confirmed and this is not.

## Claim 5 — NOT-A-DEFECT: `save-draft` stores `trackIds` without
validating them against the form's offered tracks

`src/routes/public/submit-draft.tsx:71,127` stores `extractTrackIds(body)`
verbatim into the KV draft blob under the reserved `__trackIds` key,
with no `validateTrackChoice` call (contrast `submit-post.tsx:234`, which
does call it before any write). This is not a defect: the draft write
touches no submission-shaped state — it is the submitter's own scratch
value, addressable only by the `chq_draft_<formId>` cookie minted for
that same browser (`src/lib/draft.ts` / `buildDraftCookie`), read back
only by the GET handler that pre-fills the same submitter's own form
(`src/routes/public/submit-get.tsx:52-61`), and is validated for real by
`validateTrackChoice` at final submit (`submit-post.tsx:234`) before any
`submission_track` row is ever written. There is no cross-user or
cross-tenant read of an unvalidated draft, and no path from an
unvalidated draft value to a persisted row.

## Claim 6 — NOT-A-DEFECT: `rule-match.ts`/`visibility.ts` transitive
fixed point and typed-canonicalization

`resolveHiddenFieldIds` (`src/forms/visibility.ts:35-74`) computes a
monotone visible→hidden fixed point (DEC-532/DEC-973), terminating in at
most `fields.length` passes including under a rule cycle (verified by
inspection: `hidden` only grows, the `changed` loop guard stops as soon
as a pass adds nothing). `canonicalizeOperand`/`ruleMatches`
(`src/forms/rule-match.ts`) are proven identical to their inline-JS
browser twin on both VALUE outcomes (`RULE_MATCH_CASES`) and REFUSAL
outcomes (`RULE_MATCH_THROW_CASES`) via `test/form-render-rules.test.ts`
(pre-existing, not re-run by this docs-only lane — cited, not executed,
per this task's "run no product test" instruction). No falsifiable claim
survived inspection of these two files.

Full-run test command: none — this lane runs no product test (per the
task's own instruction: "Run no product test; run only the two
verification-log commands"). Every claim above is settled by direct
citation of file:line plus reasoning from this codebase's own existing,
already-landed conventions (DEC-100's seq subquery, DEC-079's
idempotence-not-atomicity ruling, DEC-544's double-submit rule) — no new
test was written or run to produce these verdicts.
