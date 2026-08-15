# task-w45-b — comms-integrity adjudication, detail

Scope: DEC-069/DEC-099/DEC-068/DEC-358 w45 ADJUDICATE task for J5
(communications, send door, email log). FILE-NEVER-FIX: no src/**,
app/src/**, migrations/**, package.json, docs/eval-findings.md,
scripts/exit-predicate.ts, scripts/assemble-verification-log.ts touched by
this lane.

## Claim 1 — send-door 100-recipient cap

`MAX_COMPOSE_RECIPIENTS = 100` is defined once at `src/domain/compose.ts:9`.
The question posed was whether `src/routes/comms/send.ts` independently
enforces the cap, or only `compose-core.ts`'s preview/compose path does.

Trace: `send.ts:45` — `const input = await resolveComposeInput(c, eventId, body);`
`resolveComposeInput` (`compose-core.ts:90-108`) is the FIRST thing send.ts
calls, before any D1 read (`repo.loadComposeSubmissions` at `send.ts:47`
comes after). Inside it, `compose-core.ts:107-109`:

```
const submissionIds = parseBoundedIdArray(b.submissionIds, "submissionIds", {
  maxCount: MAX_COMPOSE_RECIPIENTS,
});
```

`parseBoundedIdArray` (`src/server/http.ts:92`) throws `ApiError("invalid", ...)`
when the array exceeds `maxCount`. `preview.ts:32` calls the exact same
`resolveComposeInput` function. There is no second, preview-only copy of
this validation — it is one shared entry gate for both routes. An API
caller posting straight to `/api/v1/events/:eventId/compose/send` with 101
submissionIds hits this throw before any recipient is rendered or any
mailer call is made. Verdict: NOT-CONFIRMED — the premise that the cap
"lives only on the compose/preview path" does not hold; it lives on the
shared resolver both routes call as their first action.

## Claim 2 — per-recipient log + partial-failure contract

Read `src/routes/comms/send.ts:210-239` (the per-recipient send loop) and
the three `Mailer` implementations: `src/mail/dev-sink.ts`,
`src/mail/email-binding.ts`, `src/mail/unconfigured.ts`.

Loop shape (`send.ts`):
```
for (const rendered of toSend) {
  try {
    ...
    await mailer.send(attempt);
  } catch (err) {
    failed.push({ email: rendered.email, message: ... });
  }
}
```
A per-recipient try/catch — one recipient's throw does not stop the loop
(comment at `send.ts:186-189`, DEC-238 class 2).

Each `Mailer.send` implementation:
- `DevSinkMailer.send` (`dev-sink.ts:12-30`): builds a row with
  `status: "sent"` and always writes it (no throw path in dev sink — the
  dev sink never fails).
- `EmailBindingMailer.send` (`email-binding.ts:227-256`): tries the real
  send; on catch sets `status = "failed"`, `sendError = err`; ALWAYS calls
  `await this.log.write(row)` (line 254) BEFORE the conditional rethrow
  (line 256, `if (sendError !== null) throw sendError;`). Comment at
  `email-binding.ts:250-252`: "Log first so the email history reflects the
  failed attempt, then fail loudly ... DEC-923 single-writer discipline."
- `UnconfiguredMailer.send` (`unconfigured.ts:16-38`): always writes a row
  with `status: "failed"`, `provider: "none"`, THEN throws
  `MailNotConfiguredError` (comment at `unconfigured.ts:1-9` explicitly
  documents this was a wave-43 fix for exactly the failure mode claim 2
  probes: "previously makeMailer THREW at construction time ... so every
  send path 500'd with no email_log row written at all").

Consequence for a batch of n where recipient k fails: recipients 1..k-1 are
each logged `sent` (one row per `mailer.send` call, since `mailer.send` is
the sole writer per DEC-923). Recipient k is logged `failed` (write-before-
throw ordering in both real mailer implementations). Recipients k+1..n are
still iterated (the loop's try/catch means k's exception never propagates
out of the loop) and each gets its own logged outcome. No recipient is
attempted without being logged, and no logged row corresponds to a
recipient that was never attempted (the log write always happens inside
`mailer.send`, which is called exactly once per `toSend` entry, never
speculatively). Verdict: DELIBERATE-BY-DESIGN — the log neither overstates
nor understates the batch; this is explicitly documented, tested (DEC-923)
behavior, not an accidental gap.

## Claim 3 — status changes never auto-email (DEC-009 / DEC-720)

Enumerated every `mailer.send`/`makeMailer` hit under `src/routes/**`
(excluding `test/`):

| site | classification | reasoning |
|---|---|---|
| `content-notes.ts:157` | DEC-720 sanctioned exception | already ruled per task instructions — not re-filed |
| `auth-reset.tsx:170` | deliberate-send | password-reset REQUEST action, not a status write |
| `tasks.ts:617` (`/onboarding/remind`) | deliberate-send | organizer clicks "remind now" |
| `tasks.ts:686` (`runDueReminders`) | schedule-driven | invoked from `src/index.ts`'s `scheduled()` cron handler; file comment: "Never reachable from a status-change path (DEC-009)" |
| `comms/portal-invites.ts:102` | deliberate-send | organizer-triggered portal invite send |
| `comms/send.ts:235` | deliberate-send | the compose/send door itself — organizer's explicit "send" action |
| `public/submit-post.tsx:485` | deliberate-send (create, not status) | fires on submission CREATE, confirming receipt — no status column is being flipped by this handler |
| `review/plans-progress.ts:333` | deliberate-send | reviewer progress-reminder, organizer-triggered (DEC-238 class 2) |
| `api/users.ts:111` | deliberate-send (create, not status) | welcome email on account CREATE, best-effort (DEC-238) |
| `api/contacts/bulk-email.ts:281` | deliberate-send | organizer bulk email action |

Cross-check of the two content-status WRITERS DEC-720's amendments name
(`src/routes/files.ts`, `src/routes/api/submissions.ts`): both carry the
invariant comment "this module MUST NEVER import a mailer" at their top
(`files.ts:6-7`, `submissions.ts:5-6`), and `grep -n "mailer\|makeMailer"`
on both files returns zero hits tied to actual mailer imports/calls (only
the invariant comments themselves, plus unrelated `contact.email` string
fields). No status-writing handler outside `content-notes.ts` (the DEC-720
exception) reaches a mailer. Verdict: NOT-CONFIRMED.

## Claim 4 — unknown merge token render-time behavior

`src/mail/render.ts:1-3` states the house rule directly: "Fail loudly on
any placeholder absent from vars — no silent blanks in emails to real
speakers." The implementing function `renderTemplate` (`render.ts:159-166`)
enforces this:
```
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const canonical = canonicalMergeField(name);
    if (!Object.prototype.hasOwnProperty.call(vars, canonical) || vars[canonical] === undefined) {
      throw new MergeFieldError(name);
    }
    return vars[canonical];
  });
}
```
An unknown/missing token throws `MergeFieldError`, never renders empty,
never leaks the raw `{token}` text into rendered output.

But the live send path (`comms/send.ts`) never lets this throw fire for a
real recipient — it is guarded upstream by a non-throwing preflight:
`preflightRender` (`src/domain/compose.ts:195-225`) calls
`missingMergeFields` (`render.ts:143-157`, a scan, no throw) for both
subject and body per target, and only calls `renderTemplate` once every
target has already been confirmed to have zero missing fields
(`compose.ts:204-224`). `send.ts:76-83` (pre-mint pass) and `send.ts:98-100`
(post-mint pass) both convert a non-empty `preflightResult.missing` into an
`ApiError("invalid", ...)` — a 400 that aborts the ENTIRE batch before the
per-recipient mailer loop starts. So no recipient in a real send ever
receives a rendered mail from a template referencing an unknown/missing
token: the whole compose call is rejected atomically first. The
`renderTemplate` throw exists as the fail-loud backstop (and is the live
path for compose.ts's own second-pass render at `compose.ts:223-224`,
where by construction `missingMergeFields` has already returned empty, and
for other single-value callers per the `missingMergeFields` doc-comment at
`render.ts:138-140`, e.g. reminder sends). Verdict: DELIBERATE-BY-DESIGN —
matches SPEC's fail-loudly principle; no raw-token leak path found.

## Targeted tests

Ran (`npm run test:targeted -- <files>`), 15 files:
`test/compose-ics.test.ts`, `test/compose-preview-html-shell.test.ts`,
`test/comms-send-mailer-failure.test.ts`, `test/comms-send-dedupe.test.ts`,
`test/comms-failed-send-audit.test.ts`, `test/send-response-no-credentials.test.ts`,
`test/send-result-single-reporter.test.ts`, `test/compose-full-set.test.ts`,
`test/compose-duplicate-ids.test.ts`, `test/compose-preview-no-token.test.ts`,
`test/compose-order.test.ts`, `test/email-binding.test.ts`,
`test/email-address-agreement.test.ts`, `test/comms-email-log-detail.test.ts`,
`test/cfp-confirmation-email-honesty.test.ts`.

Result: `Test Files  15 passed (15)` / `Tests  95 passed (95)`.

## Summary

Zero CONFIRMED-DEFECT rows across the four claims. This lane touched no
src/**/app/src/**/migrations/**/package.json files (adjudication-only, per
DEC-069 w45 FILE-NEVER-FIX instruction).
