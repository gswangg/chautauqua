// CSV import (DEC-011/DEC-026). Split out of the former monolithic
// src/routes/api/contacts.ts for contention (803-line hotspot) reasons
// only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import { getEventForOrg } from "../../../server/repo/events";
import { listAcceptedContactIds } from "../../../server/repo/tasks";
import { parseCsv } from "../../../lib/csv";
import {
  mapImportRow,
  importFieldCapViolations,
  validateImportMapping,
  MAX_IMPORT_CSV_BYTES as DOMAIN_MAX_IMPORT_CSV_BYTES,
} from "../../../domain/contacts"; // DEC-422 (amendment, wave 59)
import { DEC_290, DEC_604, DEC_810 } from "../../../decisions";
import { currentOrgId, asRecord, isPlainObject } from "./shared";
import { MAX_NAME_LENGTH } from "../../../forms/validate"; // DEC-417
import { overCapFieldMessage, overCapCountMessage } from "../../../domain/cap-copy";
import { isValidEmail, normalizeEmail } from "../../../domain/email"; // DEC-604 amendment (wave 15)
import { MAX_PARTICIPANTS_PER_SUBMISSION } from "../../../domain/participant-roles";

// Compile-checked dependency marker: the optional eventId on POST
// /contacts/import (roster-scoped import) implements DEC-290.
void DEC_290;
// Compile-checked dependency marker: POST /contacts/import below rejects a
// missing/blank `sessionTitle` when `eventId` is present, before applying
// any import row -- the whole batch shares one session title, never an
// invented per-row 'Invited: <name>' fallback (DEC-810).
void DEC_810;
// Compile-checked dependency marker: POST /contacts/import below refuses
// (before any write, and before the dryRun branch so the Review step
// discloses it too) a roster import whose distinct not-already-on-the-event
// contacts would exceed MAX_PARTICIPANTS_PER_SUBMISSION on the batch's one
// shared session (DEC-604 amendment, findings wave 15).
void DEC_604;

// DEC-417/DEC-422 (amendment, wave 59): the cap itself lives ONE place,
// src/domain/contacts.ts, matching this route's own MAX_IMPORT_ROWS
// pattern just below -- both are re-exported here (not re-declared) so
// every existing caller/test of this route module still finds them by
// this name.
export const MAX_IMPORT_CSV_BYTES = DOMAIN_MAX_IMPORT_CSV_BYTES;
// DEC-478 (amendment, wave 62): the row cap lives ONE place,
// src/domain/contacts.ts (moved from src/server/repo/contacts/import.ts so
// app/src/pages/contacts/ImportWizard.tsx can import it too), so this
// route's bound and message always agree with what applyImportRows
// actually enforces AND what the SPA discloses before the user maps a
// single column.
export const MAX_IMPORT_ROWS = repo.MAX_IMPORT_ROWS;

export function registerImportRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.post("/contacts/import", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    if (typeof body.csvText !== "string" || body.csvText.trim() === "") {
      throw new ApiError("invalid", "Validation failed", { csvText: "required" });
    }
    // DEC-417: bound the raw CSV payload BEFORE parseCsv touches it.
    const csvByteLength = new TextEncoder().encode(body.csvText).length;
    if (csvByteLength > MAX_IMPORT_CSV_BYTES) {
      throw new ApiError("invalid", `csvText must be at most ${MAX_IMPORT_CSV_BYTES} bytes`, {
        csvText: overCapCountMessage(csvByteLength, MAX_IMPORT_CSV_BYTES, "byte"),
      });
    }
    if (!isPlainObject(body.mapping)) {
      throw new ApiError("invalid", "Validation failed", { mapping: "required, column -> field" });
    }
    const mapping = body.mapping as Record<string, string>;
    // DEC-478 (amendment, wave 47): a mapping is INJECTIVE -- no two columns
    // may target the same field. Checked before any parse/plan/write so a
    // refused import touches no storage. validateImportMapping throws a
    // plain Error (pure core, see its doc comment); wrapped here into the
    // house ApiError envelope, naming the offending columns/target on the
    // `mapping` field.
    try {
      validateImportMapping(mapping);
    } catch (err) {
      throw new ApiError("invalid", err instanceof Error ? err.message : "Invalid column mapping", {
        mapping: err instanceof Error ? err.message : "invalid",
      });
    }

    // DEC-290: an optional eventId puts every imported/updated contact (not
    // already on the roster) onto the event, riding the existing add-to-event
    // push (no new roster table, no new route).
    // DEC-663: an organizer-facing dry-run plan (never writes) vs. the real
    // import run. Validated up front, alongside the other bounds, so an
    // organizer never falls through to a real write on a malformed request.
    let dryRun = false;
    if (body.dryRun !== undefined) {
      if (typeof body.dryRun !== "boolean") {
        throw new ApiError("invalid", "Validation failed", { dryRun: "must be a boolean" });
      }
      dryRun = body.dryRun;
    }

    let skipLines: number[] = [];
    if (body.skipLines !== undefined) {
      if (
        !Array.isArray(body.skipLines) ||
        body.skipLines.length > MAX_IMPORT_ROWS ||
        !body.skipLines.every((n): n is number => typeof n === "number" && Number.isInteger(n))
      ) {
        throw new ApiError("invalid", "Validation failed", { skipLines: "must be an array of integers" });
      }
      skipLines = body.skipLines as number[];
    }

    // DEC-663 (wave-64 amendment): mergeLines mirrors the skipLines shape
    // check above -- an array of { line, contactId }, bounded the same way,
    // with contactId itself bounded (never trusted past 64 chars) and no
    // line repeated. The SEMANTIC re-derivation (candidate/org/email
    // checks) happens inside applyImportRows, against the DB, not here.
    let mergeLines: { line: number; contactId: string }[] = [];
    if (body.mergeLines !== undefined) {
      const invalid = () =>
        new ApiError("invalid", "Validation failed", {
          mergeLines: "must be an array of { line: integer, contactId: string }, line values unique",
        });
      if (!Array.isArray(body.mergeLines) || body.mergeLines.length > MAX_IMPORT_ROWS) {
        throw invalid();
      }
      const seenLines = new Set<number>();
      for (const entry of body.mergeLines) {
        if (
          !isPlainObject(entry) ||
          typeof entry.line !== "number" ||
          !Number.isInteger(entry.line) ||
          typeof entry.contactId !== "string" ||
          entry.contactId.trim() === "" ||
          entry.contactId.length > 64
        ) {
          throw invalid();
        }
        if (seenLines.has(entry.line)) throw invalid();
        seenLines.add(entry.line);
      }
      mergeLines = body.mergeLines as { line: number; contactId: string }[];
    }

    // DEC-810: an eventId means every imported contact not already on the
    // roster gets pushed on with one shared session title -- rejected loudly
    // up front (before parsing/writing anything) rather than an invented
    // per-row 'Invited: <name>' fallback.
    let eventId: string | undefined;
    let sessionTitle: string | undefined;
    if (body.eventId !== undefined) {
      if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
        throw new ApiError("invalid", "Validation failed", { eventId: "must be a non-empty string" });
      }
      const event = await getEventForOrg(c.var.db, body.eventId, orgId);
      if (!event) throw new ApiError("not_found", "Event not found");
      eventId = event.id;
      if (typeof body.sessionTitle !== "string" || body.sessionTitle.trim() === "") {
        throw new ApiError("invalid", "Validation failed", {
          sessionTitle: "required to name the session this batch is added to the event with",
        });
      }
      if (body.sessionTitle.length > MAX_NAME_LENGTH) {
        throw new ApiError("invalid", "Validation failed", { sessionTitle: overCapFieldMessage(body.sessionTitle.length, MAX_NAME_LENGTH) }); // DEC-417
      }
      sessionTitle = body.sessionTitle.trim();
    }

    let table: string[][];
    try {
      table = parseCsv(body.csvText);
    } catch (err) {
      throw new ApiError("invalid", err instanceof Error ? err.message : "Failed to parse CSV");
    }
    if (table.length === 0) {
      if (dryRun) return c.json({ rows: [], created: 0, updated: 0, skipped: 0 });
      return c.json(eventId !== undefined ? { created: 0, updated: 0, skipped: [], addedToEvent: 0 } : { created: 0, updated: 0, skipped: [] });
    }
    const [header, ...dataRows] = table;
    if (!header) throw new ApiError("invalid", "CSV has no header row");
    // DEC-417: bound row count after parsing, before mapImportRow/applyImportRows.
    if (dataRows.length > MAX_IMPORT_ROWS) {
      throw new ApiError("invalid", `csvText must have at most ${MAX_IMPORT_ROWS} data rows`, {
        csvText: overCapCountMessage(dataRows.length, MAX_IMPORT_ROWS, "row"),
      });
    }

    // Fail loudly on a bad mapping (e.g. a target field the pure core doesn't
    // recognize) with a 400 naming the offending column, instead of letting
    // mapImportRow's thrown Error surface as an unhandled 500 mid-batch — a
    // client/server mapping mismatch should be visible, not a silent/opaque
    // failure of the whole import (P1 fix, w1-f).
    // DEC-417 (amendment): the row's per-column cap check runs here, at
    // parse time -- BEFORE planImportRows/applyImportRows so a capped row
    // surfaces on the dry-run plan (not only as a 500/refusal at apply)
    // and applyImportRows refuses the exact same rows the plan flagged.
    let rows: { line: number; parsed: Record<string, unknown>; capViolations?: Record<string, string> }[];
    try {
      rows = dataRows.map((row, idx) => {
        const parsed = mapImportRow(mapping, header, row);
        const capViolations = importFieldCapViolations(parsed);
        return {
          line: idx + 2,
          parsed: parsed as Record<string, unknown>,
          ...(Object.keys(capViolations).length > 0 ? { capViolations } : {}),
        };
      });
    } catch (err) {
      throw new ApiError("invalid", err instanceof Error ? err.message : "Invalid column mapping", {
        mapping: err instanceof Error ? err.message : "invalid",
      });
    }

    // DEC-604 amendment (findings wave 15): a roster import's whole batch
    // lands on ONE shared submission (DEC-810) -- refuse BEFORE any write
    // (and before the dryRun branch, so the Review step discloses this too)
    // when the distinct not-already-on-the-event-roster contacts in the
    // file would exceed MAX_PARTICIPANTS_PER_SUBMISSION on that one
    // session. Closes the door pushContactsToEvent -> insertActiveParticipants
    // otherwise left open (a 200-row roster CSV writing 199 participants
    // onto one submission against a cap of 6).
    if (eventId !== undefined) {
      const fileEmails = new Set<string>();
      for (const { parsed } of rows) {
        const email = typeof parsed.email === "string" ? parsed.email : undefined;
        if (!email || email.trim() === "" || !isValidEmail(email)) continue;
        fileEmails.add(normalizeEmail(email));
      }
      const existingByEmail = await repo.lookupContactIdsByEmail(c.var.db, orgId, [...fileEmails]);
      const alreadyOnRosterForCap = new Set(await listAcceptedContactIds(c.var.db, eventId));
      let toAddCount = 0;
      for (const email of fileEmails) {
        const contactId = existingByEmail.get(email);
        if (contactId && alreadyOnRosterForCap.has(contactId)) continue;
        toAddCount++;
      }
      if (toAddCount > MAX_PARTICIPANTS_PER_SUBMISSION) {
        throw new ApiError(
          "invalid",
          `Importing this file onto one event session would add ${toAddCount} participants, which exceeds the ${MAX_PARTICIPANTS_PER_SUBMISSION}-participant-per-submission cap.`,
          {
            eventId: `${overCapCountMessage(toAddCount, MAX_PARTICIPANTS_PER_SUBMISSION, "participant")} -- import without choosing an event, then add speakers to sessions individually`,
          },
        );
      }
    }

    if (dryRun) {
      // DEC-663: never applyImportRows/pushContactsToEvent on a dry run.
      const plan = await repo.planImportRows(c.var.db, orgId, rows);
      return c.json(plan);
    }

    const result = await repo.applyImportRows(c.var.db, orgId, rows, { skipLines, mergeLines });

    if (eventId === undefined) {
      return c.json({ created: result.created, updated: result.updated, skipped: result.skipped });
    }

    const alreadyOnRoster = new Set(await listAcceptedContactIds(c.var.db, eventId));
    const toAddIds = result.contactIds.filter((contactId) => !alreadyOnRoster.has(contactId));
    const contacts = await repo.findContactsForOrg(c.var.db, toAddIds, orgId);
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
    const toAdd = toAddIds.map((contactId) => {
      const contact = contactsById.get(contactId);
      if (!contact) throw new Error(`applyImportRows returned contactId ${contactId} not owned by org ${orgId}`);
      return contact;
    });
    if (sessionTitle === undefined) throw new Error("sessionTitle required when eventId is set (checked above)");
    // DEC-810 amendment (wave 59): the batch is pushed onto the event as ONE
    // session with `sessionTitle`, carrying every not-already-on-roster
    // contact as a participant of that single submission -- never one
    // session per imported row. `addedToEvent` below is a people count (how
    // many contacts joined the roster), not a session count.
    if (toAdd.length > 0) {
      await repo.pushContactsToEvent(c.var.db, eventId, orgId, toAdd, sessionTitle);
    }
    const addedToEvent = toAdd.length;

    return c.json({ created: result.created, updated: result.updated, skipped: result.skipped, addedToEvent });
  });
}
