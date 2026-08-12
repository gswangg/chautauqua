# J1-J12 persona walkthrough — task w6-g

LOG-ONLY gate (SPEC section 9 "the real bar", DEC-062, DEC-389 reporting
discipline). This lane touches only this file.

- SHA measured (`git -C <repo> rev-parse main` at run time): `2553346d4a86a51207d784742e8469f72545d808`
- Run date: 2026-08-12
- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w6-g`

## Procedure and exit codes

| Step | Command | Exit code | Notes |
|---|---|---|---|
| 1 | `npm ci --prefer-offline --no-audit --no-fund --silent` | 0 | `node_modules` was absent, ran fresh |
| 2 | `npm run db:migrate` (`wrangler d1 migrations apply chautauqua --local`) | 0 | 18 migrations, all ✅, no secret required |
| 3 | `npm run seed` (`tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts`) | 0 | seeded D1 rows + 8 R2 objects, no secret required |
| 4 | `npm run dev` (`wrangler dev`) | n/a (long-running) | `predev` auto-created `.dev.vars` from `.dev.vars.example` (DEV_MODE=1, PUBLIC_BASE_URL only — no secret values, both non-secret local dev config). Booted on `http://localhost:8787`, `GET /` returned 200. ZERO secrets present at any point. |
| 5 | `npm run walkthrough -- --url http://localhost:8787` | 1 | **FAILED at producer module, J2** (see below) |

No step in the procedure demanded a secret at any point (open item would
apply only if one had).

## Per-area PASS/FAIL table (automated `npm run walkthrough`)

| Area | Result | Failing assertion (if any) |
|---|---|---|
| producer — J1 (launch a CFP) | PASS | — |
| producer — J2 (public submit + claim) | **FAIL** | `"J2 submit page shows a deadline"` — `expected a 'Submissions close ...' deadline line` |
| review | NOT RUN | walkthrough.ts aborts the whole run at the first area failure (fixed order producer → review → speaker → public → data) |
| speaker | NOT RUN | as above |
| public | NOT RUN | as above |
| data | NOT RUN | as above |

### Root cause investigation (read-only; this lane makes no product-code changes)

`GET /submit/devflow-conf-2027` (seeded event, form has `closeDate` set)
renders the deadline as:

```
<span class="chq-cfp-sub">Call for papers · closes Mon, 01 Mar 2027 23:59:00 GMT</span>
```

(from `src/routes/public/submit.tsx`, `SubmitPage`'s header). The walkthrough
assertion in `scripts/walkthrough/producer.ts:376-380` requires
`/Submissions close/i` to match the page body. The literal substring
"Submissions close" does not appear anywhere in the open-submit-page markup
(only "· closes {date}"); it only appears in the *closed*-window copy
(`ClosedPage`: "Submissions for this event closed on ..."). This looks like
a genuine mismatch between the walkthrough's expected copy and the shipped
open-window CFP header copy — not a flaky/environmental failure. Recorded
as-is per this lane's LOG-ONLY scope; not fixed here.

## Manual exercises (DEC-398 form task, DEC-397 compose preview/send)

Performed by hand against the same booted server (organizer =
`sbek-organizer@example.com`, speaker = `sbek-speaker@example.com` /
contact `seed_contact_0001`, event `seed_event_0001`).

### DEC-398 — form-kind onboarding task created at /admin/speakers path, completed at /portal/tasks/:id/form

1. `POST /api/v1/events/seed_event_0001/tasks` `{kind:"form", formId:"seed_form_0001", ...}` → 201, task `ybszafu7pqm4qpqvow2x` (the event's one form, `isDefault:true`, picked by id here since the admin API takes `formId` directly — DEC-398's "picked by name" applies to task-completion binding, not creation).
2. `POST /api/v1/tasks/:id/assign` `{contactIds:["seed_contact_0001"]}` → 200, assignment `oilvaeian7qjq44mvq47`, status `pending`.
3. Logged in as the speaker, `GET /portal/tasks/oilvaeian7qjq44mvq47/form` → 200, rendered the event's default CFP form fields (title/description/format/audience/first/last/email/etc.) — the DEC-398 "form picked by name against the task's own event" path.
4. `POST /portal/tasks/oilvaeian7qjq44mvq47/form` with all required fields filled → 302 (success redirect).
5. Re-checked the onboarding grid as organizer: assignment `oilvaeian7qjq44mvq47` now `status: "complete"`.

**RESULT: PASS** — form task creation-by-organizer → speaker completion round-trip works end to end.

### DEC-397 — compose preview must never mint credentials; only send should

1. `POST /api/v1/events/seed_event_0001/compose/preview` for submission `seed_submission_0027` (speaker contact `seed_synth_contact_0024`, `hasAccount:false`, template `{{portal_link}}`) → 200, body:
   `"text":"Your portal: {http://localhost:8787/claim/fIhoj4kFBZsPD_eB_hzznalWEBc_YkqmI8MKB_F759g}"`
2. Repeating the same preview call again produces a **different** claim token each time, confirming each preview call performs a real `createClaimToken` mint (a fresh KV `put`), not a fixed placeholder.
3. `POST /api/v1/events/seed_event_0001/compose/send` for the same submission → 200, body: `"text":"Your portal: {http://localhost:8787/claim/30FO22H8FKMaiHrZ4Ou2_JimaIUSKJxoBojpuvavrB0}"` (yet another distinct real token).
4. `GET /dev/mailbox` then `GET /dev/mailbox/l32lmmoca3aw4geckpv4` (the sent message) confirms the sent body carries the real `/claim/30FO22H8FKMaiHrZ4Ou2_JimaIUSKJxoBojpuvavrB0` link — the send path does mint and deliver a working claim link.

**Finding**: the *send* half of DEC-397 works (real, working `/claim/` link
delivered via the mailbox), but the *preview* half does not: preview
returned a real, freshly-minted `/claim/<token>` rather than the fixed
placeholder `/claim/PREVIEW_CLAIM_TOKEN` the decision specifies, and it
performs a real KV `put` per preview call (not "zero KV puts"). Code
inspection: `resolvePortalLink` in `src/routes/comms.ts` calls
`createClaimToken(kv, ...)` unconditionally for both the `/compose/preview`
and `/compose/send` routes — there is no `mintClaimTokens` flag, no
`PREVIEW_CLAIM_TOKEN` constant, and no `DEC_397` reference anywhere in
`src/` outside of its definition in `src/decisions.ts` (confirmed via
`grep -rn DEC_397 src/`, only hit is the decisions.ts constant itself — the
field guide's compile-checked-dependency convention is not honored for this
decision, i.e. DEC-397 is undereferenced and, on this evidence, unimplemented
for the preview path).

**RESULT: FAIL** — DEC-397's core guarantee ("preview never mints
credentials") does not hold; preview mints a real, usable claim token
exactly like send does.

## Summary

RESULT: FAIL
OPEN ITEMS: 2

1. `scripts/walkthrough/producer.ts` J2 asserts the open-submit page body
   matches `/Submissions close/i`, but `src/routes/public/submit.tsx`
   renders the open-window deadline as "· closes {date}" (the literal
   substring "Submissions close" only appears in the closed-window copy) —
   walkthrough aborts at producer before review/speaker/public/data run at
   all. Needs a decision on which side (copy or assertion) is correct, then
   a fix + gate re-run.
2. DEC-397 ("a preview never mints credentials") is not implemented: both
   `/api/v1/events/:eventId/compose/preview` and `/compose/send` in
   `src/routes/comms.ts` call `resolvePortalLink` → `createClaimToken`
   unconditionally, so each preview call performs a real KV write and
   returns a real, working `/claim/<token>` link rather than the specified
   `/claim/PREVIEW_CLAIM_TOKEN` placeholder. Needs an implementation pass
   (a `mintClaimTokens` flag threaded from the two routes into
   `resolvePortalLink`/`buildRenderTargets`) plus a `DEC_397` compile-time
   reference per the repo's decision-dependency convention.
