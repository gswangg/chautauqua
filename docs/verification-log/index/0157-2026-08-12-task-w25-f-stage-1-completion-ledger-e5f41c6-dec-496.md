## 2026-08-12 task-w25-f — stage-1 completion ledger @ e5f41c6 (DEC-496)

Full ledger: `docs/verification-log/task-w25-f-stage-1-completion-ledger.md`. LOG-ONLY task; own
`npm run build` (clean, exit 0), `npm test` (303 files / 2765 tests passed), and
`npm run bundle:check` (62.06 kB gzip entry bundle, budget 300 kB) all re-run fresh in this
task's own worktree at this exact sha.

J1-J12 (SPEC.md:95-183): PASS — one clean `npm run walkthrough` run against a freshly
migrated+seeded `wrangler dev --port 8794` (DEC-498: own port, `kill <own PID>` only) passed all
six modules/all twelve journeys, mapped to `scripts/walkthrough/<module>.ts` file:line in the
ledger's §1 table. No module fails at this sha; DEC-493's harness repair (task-w25-a, ancestor of
this sha) holds. One harness usage note logged (the walkthrough scripts are not idempotent
across repeated runs against the same seeded DB) — not a J1-J12 defect.

SPEC.md:353 admin-list pagination: PASS — `npx vitest run test/list-envelope-enumeration.test.ts`
(4/4 green); DEC-488 closure re-confirmed by direct read (`src/server/repo/forms.ts:250`
`MAX_FORM_FIELDS = 200`, `src/routes/api/forms.ts:154-156,264` cap+full envelope); the
`ENVELOPE_ALLOWLIST` in the test carries exactly two entries (`src/routes/comms.ts:388`,
`src/routes/api/contacts/bulk-email.ts:189`), each traced to the constant that actually enforces
it (`MAX_COMPOSE_RECIPIENTS = 100` via `expandRecipients`, `BULK_EMAIL_PREVIEW_LIMIT = 5`).
`src/routes/api/forms.ts:259` (task-w21-f's open item #2 site) is GONE from the allowlist and
from the file — CLOSED.

DEC-488/489/490/491/492 each graded one row at file:line at this sha (ledger §3), all PASS.
DEC-492 in particular — flagged by this task's own brief as a possible PENDING-OWNED
candidate — was checked by mechanical ancestry (`git merge-base --is-ancestor
03c03b9(merge task-w24-e) HEAD` → ancestor) AND by direct read of `src/server/repo/agenda.ts`
(atomic set-based `bumpIcsSequences`, chunked bounded `runAutoSchedule` insert loop capped at
`MAX_AUTO_SCHEDULE_PLACEMENTS = 2000`): landed, not pending.

Perf (SPEC.md:325-338), render/phone (SPEC.md:374-377), quickstart/zero-secrets (SPEC.md:42-47,
361-366): all three cited from in-history ancestor artifacts (`task-w25-c-perf-smoke.md`,
`task-w25-c-public-speaker-scale-stage1.md` for DEC-495's 800-speaker ceiling,
`task-w25-d-render-sweep-stage1.md`, `task-w25-e-fresh-clone-stage1.md`), each confirmed an
ancestor via `git merge-base --is-ancestor`, all `RESULT: PASS` with only advisory open items
carried forward (submission-detail perf noise, a phone-manifest embed-twin gap, a
non-default-port README predev-step gap — the last independently reproduced again in this
ledger's §1/§6).

Carried items from `task-w21-f-stage-1-completion-ledger.md`: item #1 STRUCK by direct quote of
its own cited source (`task-w21-e-perf-smoke-stage1.md:102-103`: "Neither row is
UNMEASURABLE-BY-CONSTRUCTION at this sha" — the opposite of what the open item claimed); item #2
CLOSED (`src/routes/api/forms.ts:259` no longer bare, see above).

Stage-2 scope (Cloudflare provisioning, `wrangler deploy`, real Resend, Airtable sync, DNS, CI
deploy, prod cache) explicitly out of scope and not graded.

FAIL-unowned: none.

PENDING-OWNED: none.

RESULT: PASS — build/test/bundle green, all twelve journeys pass in a clean single-seed
walkthrough run, the DEC-473/480 list-envelope enumeration passes with both allowlist entries
constant-enforced, DEC-488/489/490/491/492 all verify by direct file:line read (including
DEC-492, confirmed landed not pending), perf/render/quickstart artifacts all PASS with only
advisory open items, and both carried task-w21-f items are settled (one struck, one closed). The
FAIL-unowned list is empty.

