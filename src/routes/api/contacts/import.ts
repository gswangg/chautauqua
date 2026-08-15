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
import { mapImportRow, MAX_IMPORT_CSV_BYTES as DOMAIN_MAX_IMPORT_CSV_BYTES } from "../../../domain/contacts"; // DEC-422 (amendment, wave 59)
import { DEC_290, DEC_810 } from "../../../decisions";
import { currentOrgId, asRecord, isPlainObject } from "./shared";
import { MAX_NAME_LENGTH } from "../../../forms/validate"; // DEC-417

// Compile-checked dependency marker: the optional eventId on POST
// /contacts/import (roster-scoped import) implements DEC-290.
void DEC_290;
// Compile-checked dependency marker: POST /contacts/import below rejects a
// missing/blank `sessionTitle` when `eventId` is present, before applying
// any import row -- the whole batch shares one session title, never an
// invented per-row 'Invited: <name>' fallback (DEC-810).
void DEC_810;

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
    if (new TextEncoder().encode(body.csvText).length > MAX_IMPORT_CSV_BYTES) {
      throw new ApiError("invalid", `csvText must be at most ${MAX_IMPORT_CSV_BYTES} bytes`, {
        csvText: `Max ${MAX_IMPORT_CSV_BYTES} bytes`,
      });
    }
    if (!isPlainObject(body.mapping)) {
      throw new ApiError("invalid", "Validation failed", { mapping: "required, column -> field" });
    }
    const mapping = body.mapping as Record<string, string>;

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
        throw new ApiError("invalid", "Validation failed", { sessionTitle: `Max ${MAX_NAME_LENGTH}` }); // DEC-417
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
        csvText: `Max ${MAX_IMPORT_ROWS} rows`,
      });
    }

    // Fail loudly on a bad mapping (e.g. a target field the pure core doesn't
    // recognize) with a 400 naming the offending column, instead of letting
    // mapImportRow's thrown Error surface as an unhandled 500 mid-batch — a
    // client/server mapping mismatch should be visible, not a silent/opaque
    // failure of the whole import (P1 fix, w1-f).
    let rows: { line: number; parsed: Record<string, unknown> }[];
    try {
      rows = dataRows.map((row, idx) => ({
        line: idx + 2,
        parsed: mapImportRow(mapping, header, row) as Record<string, unknown>,
      }));
    } catch (err) {
      throw new ApiError("invalid", err instanceof Error ? err.message : "Invalid column mapping", {
        mapping: err instanceof Error ? err.message : "invalid",
      });
    }

    if (dryRun) {
      // DEC-663: never applyImportRows/pushContactsToEvent on a dry run.
      const plan = await repo.planImportRows(c.var.db, orgId, rows);
      return c.json(plan);
    }

    const result = await repo.applyImportRows(c.var.db, orgId, rows, { skipLines });

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
