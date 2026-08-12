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
import { mapImportRow } from "../../../domain/contacts";
import { DEC_290 } from "../../../decisions";
import { currentOrgId, asRecord, isPlainObject } from "./shared";

// Compile-checked dependency marker: the optional eventId on POST
// /contacts/import (roster-scoped import) implements DEC-290.
void DEC_290;

// DEC-417: CSV import request-input bound, before parseCsv touches an
// arbitrarily large body.
export const MAX_IMPORT_CSV_BYTES = 5_000_000;
// DEC-478: the row cap lives ONE place, src/server/repo/contacts/import.ts,
// so this route's bound and message always agree with what applyImportRows
// actually enforces.
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
    let eventId: string | undefined;
    if (body.eventId !== undefined) {
      if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
        throw new ApiError("invalid", "Validation failed", { eventId: "must be a non-empty string" });
      }
      const event = await getEventForOrg(c.var.db, body.eventId, orgId);
      if (!event) throw new ApiError("not_found", "Event not found");
      eventId = event.id;
    }

    let table: string[][];
    try {
      table = parseCsv(body.csvText);
    } catch (err) {
      throw new ApiError("invalid", err instanceof Error ? err.message : "Failed to parse CSV");
    }
    if (table.length === 0) {
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

    const result = await repo.applyImportRows(c.var.db, orgId, rows);

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
    await repo.pushContactsToEvent(c.var.db, eventId, orgId, toAdd, undefined);
    const addedToEvent = toAdd.length;

    return c.json({ created: result.created, updated: result.updated, skipped: result.skipped, addedToEvent });
  });
}
