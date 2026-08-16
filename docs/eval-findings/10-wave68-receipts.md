# Wave 68 mandate-hygiene receipts (task-w68-e)

Docs-only lane, DEC-358 wave-68 amendment. Every row below was re-run against
this worktree's `main` checkout (chautauqua HEAD `1b998068`, "scribe wave
68") at the runtime of this task — not copied from the planner's citations.
File:line numbers are what this session actually read; where a citation
drifted or didn't hold, that's recorded instead of silently repeating it.

This file does not touch `docs/eval-findings/03-tier0-landed.md`,
`04-tier0-dismissed.md`, or `07-tier1.md` — those are owned by an in-flight
wave-67 lane and their ten rows are out of scope here by design (see "Branch
ownership fence" below).

## Rows

1. **GATE-11 small #2, comms history TEMPLATE cell — CLOSED-WITH-RECEIPT.**
   `app/src/pages/comms/RecentSends.tsx:80` renders `Template:
   {templatesById[detail.templateId]}` in the per-batch disclosure; `:300`
   carries the `<span>Template</span>` column head. The Compose/History
   parity test lives at `app/src/pages/comms/Comms.render.test.tsx:508-509`
   ("renders the same Template cell for the same batch under both Compose
   and History"). **Caveat:** the "+ skipped count" half of this row does
   NOT hold against `RecentSends.tsx` — that file has no "skipped" text at
   all; `statusTally()` (`RecentSends.tsx:24,113`) renders a generic
   `sent`/`failed` status breakdown, not a skipped count. The only "skipped"
   vocabulary in comms lives in `app/src/pages/comms/ComposeWizard.tsx`
   (the send-report's skipped-recipients section, `:1346-1363`) — a
   different surface than this row's citation names. Recording the TEMPLATE
   half as closed and the skipped-count half as NOT FOUND AT THE CITED
   LOCATION, so a future wave doesn't re-file it against RecentSends.tsx
   without checking ComposeWizard.tsx first.

2. **GATE-11 small #3, API-tokens row + Import pluralisation —
   CLOSED-WITH-RECEIPT.** `app/src/pages/settings/YourDataPanel.tsx:198`
   is the read-at-rest row (`{ label: 'API tokens', value: <ApiTokensPanel
   readOnly /> }`); `:224` is the edit-branch mount (`<ApiTokensPanel />`,
   unread-only). `app/src/pages/contacts/ImportWizard.tsx:138` pluralises
   via `countOf` (`` `Import ${countOf(plan ? plan.rows.length -
   skipLines.size : 0, 'row')}` ``).

3. **P3 #23, add-to-event duplicate guard — CLOSED-WITH-RECEIPT.**
   `app/src/pages/contacts/AddToEventModal.tsx:122` renders `{alreadyOnRoster
   ? 'Add another session' : 'Add them'}`; `:185` renders the
   already-on-this-event advisory line ("... is already on this event —
   {N} session(s)").

4. **v11 frame 10--24, portal preview — CLOSED-WITH-RECEIPT.**
   `src/routes/portal/preview.tsx:59` — disabled Download button
   (`disabled aria-disabled="true"`); `:96` — "this preview shows the
   configuration, not a person's data"; `:121-122` — the "Not shown here"
   section (`aria-label="Not shown here"` / `chq-section-label`); `:135` —
   "&larr; Back to settings" link. All four line numbers match exactly.

5. **v11 frame 08--16, new contact — CLOSED-WITH-RECEIPT.**
   `app/src/pages/contacts/NewContactModal.tsx:162` — the email field's
   `help` text carries WHY ("It's how contacts are matched and merged — the
   same key the CSV importer's dedupe and the merge tool use."). The
   closing scope note is rendered at `:210` (the DEC-597 comment block sits
   at `:206-209`, the `<p>` itself one line below at `:210`): "Adding a
   contact here does not put them on an event — use 'Add to an event' on
   their row for that."

6. **P2 #6, SBEK-PORTAL-BIO-01 marker — CLOSED-WITH-RECEIPT.**
   `grep -n "SBEK-PORTAL-BIO-01" scripts/seed.ts` returns no match (exit
   code 1) against a 3131-line file — the marker is confirmed absent.

7. **"RULINGS NEEDED: status-cell hover ring inset vs outset" — MOOT, not
   owed.** `app/src/pages/speakers/speakers.css:297-299`:
   ```
   .chq-speakers-status:hover {
     box-shadow: 0 0 0 2px var(--chq-border-strong);
   }
   ```
   No `inset` keyword — the ring is already outset, exactly as the
   preceding comment block (`:288-296`) describes ("the status-cell ring is
   OUTSET, not inset — it reads as a halo drawn around the pill rather than
   a bevel eaten out of it"). Recording this so no future wave spends a
   lane picking a side that was never contested in the code.

8. **Four review-lens items re-filed into wave 68 — CLOSED-WITH-RECEIPT
   (with one scope note).**
   - **Mint-after-dedupe + templateId 400 above the mint,
     `src/routes/comms/send.ts`:** templateId validation at `:141-150`
     (throws `ApiError("invalid", ...)` for a bad/unknown template);
     `applyMintedPortalLinks` mint call at `:176` — below the templateId
     check and past both dedupe stages (comments at `:86-89` and `:124-125`
     name the ordering explicitly).
   - **Same shape, `src/routes/api/contacts/bulk-email.ts`:** dedupe checks
     at `:230-243`; `applyMintedPortalLinks` mint at `:259` — after dedupe.
     **Scope note:** this route has NO `templateId` parameter at all (`grep
     -n templateId` returns nothing), so only the mint-after-dedupe half of
     the claim applies here; there is no templateId-400-above-the-mint
     shape to verify in this file because there's no templateId to validate.
   - **Content-note config hoist, `src/routes/content-notes.ts`:**
     `resolveBaseUrl` read at `:105`, ABOVE the first durable write
     (`insertFileComment` at `:108`) — DEC-547 wave-62 amendment, comment at
     `:98-103` confirms the intent. `resolvePortalLinks` sits inside a
     `try` (`:152-166`) that returns the `{sent, failed, recipients}`
     envelope on catch (`:161-166`), never a 500, matching the DEC-547
     wave-62 amendment comment at `:141-149`.
   - **`readSortToken` throws on an unknown token, both readers wrap it into
     a 400:** `src/server/repo/submissions/query.ts:130-136` throws a plain
     `Error` naming the unrecognised token (documented at `:125-129`, "any
     token outside SORT_ORDERS THROWS a plain Error naming the token").
     `src/routes/api/submissions.ts:252-258` calls `parseListQuery` (which
     calls `readSortToken` per `query.ts:170`) inside a `try` that converts
     any thrown error to `ApiError("invalid", message)`. Same shape in
     `src/routes/api/exports.ts:94-101` (submissions-kind export) — both
     readers wrap `parseListQuery` in `try`/`catch` → `ApiError("invalid",
     ...)`.

## Branch ownership fence (so wave 69 doesn't re-file this)

Unmerged at wave-68 plan time (per the field guide's WAVE 68 entry), fencing
the following scopes off from this and future lanes until they land:

- `task-w66-e` — flagged break band + Done button
- `task-w66-f` — anchor-qualified CTA hover
- `task-w66-h` — auth-claim insert-then-consume
- `task-w66-i` — FieldModal sentence + far-left Delete (fences
  `app/src/pages/forms/**`)
- `task-w67-a` through the rest of wave 67's eight scopes (branch names
  `task-w67-a`..`task-w67-h`)

None of the files this receipts row touches (`docs/eval-findings/
10-wave68-receipts.md`, the one added line in `docs/eval-findings.md`)
overlap any of the above scopes.
