// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only. This module consumes
// already-parsed CSV rows (parseCsv lives in src/domain/csv.ts, DEC-011); it
// never imports the CSV parser itself.
//
// Part of the contacts.ts decomposition (structure custodian): CSV import
// row mapping and per-field cap checks. src/domain/contacts.ts re-exports
// everything here; import from that barrel, not this file, outside of the
// contacts-parts/* sibling modules themselves.

import { overBudgetBy } from "../count-copy";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH, MAX_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import type { ContactRecord } from "./types";

// DEC-422 (amendment, wave 59): CSV import request-input bound, before
// parseCsv touches an arbitrarily large body (DEC-417).
export const MAX_IMPORT_CSV_BYTES = 5_000_000;

/** Hard cap on rows per CSV import (DEC-356, DEC-478): protects against an
 * unbounded per-row write burst. This is the ONE MAX_IMPORT_ROWS in the
 * product (DEC-478); the route layer imports it from here rather than
 * declaring its own. Producers must split larger files client-side.
 *
 * DEC-491 amendment (wave 47): the commit loop below issues NO awaited
 * writes per row — every create/update is resolved in memory and flushed
 * AFTER the loop through chunked multi-row statements (chunkRowsForInsert,
 * DEC-528), so the per-request statement count is O(rows / chunk size), not
 * O(rows). See MAX_D1_STATEMENTS_PER_REQUEST below for the derived bound
 * this is checked against.
 *
 * DEC-478 amendment (wave 62): moved from src/server/repo/contacts/import.ts
 * (a drizzle-importing repo module the SPA cannot import) to this pure-core
 * module so app/src/pages/contacts/ImportWizard.tsx can disclose the cap
 * where the file is chosen, not only in the 400 at the end. */
export const MAX_IMPORT_ROWS = 2000;

/** DEC-663 amendment (wave 64): caps possibleDuplicates at this many rows
 * per plan row so a large duplicate cluster never inflates the dry-run
 * payload -- the excess count is still disclosed via
 * ImportPlanRow.possibleDuplicatesMore.
 *
 * DEC-422: lives here (pure core), not in the repo module that applies it —
 * route/repo modules never hand-declare their own batch/count cap literal;
 * src/server/repo/contacts/import.ts imports this one from the
 * src/domain/contacts.ts barrel. */
export const MAX_POSSIBLE_DUPLICATES = 5;

/**
 * DEC-478 (amendment, wave 47): an import column mapping is INJECTIVE -- no
 * two CSV columns may target the same destination field. mapImportRow below
 * walks the header left to right and assigns by plain assignment, so a
 * mapping with two columns pointed at one destination silently keeps the
 * RIGHTMOST value and drops the other -- last-write-wins, exactly the silent
 * fallback the house rule forbids, and invisible in the preview because the
 * preview runs the same fold. This is the ONE place the injectivity rule
 * lives (called from the server door AND the SPA's mapping step, never
 * duplicated) -- throws (never coerces, never silently drops, never
 * auto-renames) naming BOTH offending columns and the shared target.
 * custom.<key> targets are compared by their full target string ("custom.foo")
 * so two columns aimed at the same custom key are refused too. Keys mapped
 * to ""/undefined are ignored (they mean "skip this column", not a target).
 *
 * Throws a plain Error, not ApiError: this module is pure core (no node:/cf
 * imports, per the file header) and is imported directly by the SPA
 * (app/tsconfig.json includes ../src/domain/**\/*.ts but NOT src/server/**),
 * so it cannot import src/server/http.ts (which pulls in Cloudflare Workers
 * ambient types via ./env, unavailable in the app's TS project) -- matching
 * the existing mapImportRow's own "throw Error, route wraps it" pattern
 * immediately below. The route layer (src/routes/api/contacts/import.ts)
 * catches this and wraps it in ApiError('invalid', message, { mapping:
 * message }); the message alone already names both offending columns and
 * the shared target for either caller.
 */
export function validateImportMapping(mapping: Record<string, string>): void {
  const columnsByTarget = new Map<string, string>();
  for (const [column, target] of Object.entries(mapping)) {
    if (!target) continue;
    const existing = columnsByTarget.get(target);
    if (existing !== undefined) {
      throw new Error(
        `Columns "${existing}" and "${column}" are both mapped to "${target}" -- point one of them elsewhere or skip it.`,
      );
    }
    columnsByTarget.set(target, column);
  }
}

/**
 * Maps an already-parsed CSV row into a partial ContactRecord using a
 * csvColumn -> targetField mapping. Targets are the standard fields
 * (email, firstName, lastName, company, title, phone, bio) plus 'custom.<key>'.
 * Columns with no mapping entry are ignored. If the mapped email column is
 * missing or blank, returns {} so callers can reject the row.
 */
export function mapImportRow(
  mapping: Record<string, string>,
  header: string[],
  row: string[],
): Partial<ContactRecord> {
  const result: Partial<ContactRecord> = {};
  const customFields: Record<string, string> = {};
  let hasCustom = false;

  for (let i = 0; i < header.length; i++) {
    const column = header[i];
    if (column === undefined) continue;
    const target = mapping[column];
    if (!target) continue;
    const value = row[i] ?? "";

    if (target.startsWith("custom.")) {
      const key = target.slice("custom.".length);
      customFields[key] = value;
      hasCustom = true;
      continue;
    }

    switch (target) {
      case "email":
        result.email = value;
        break;
      case "firstName":
        result.firstName = value;
        break;
      case "lastName":
        result.lastName = value;
        break;
      case "company":
        result.company = value;
        break;
      case "title":
        result.title = value;
        break;
      case "phone":
        result.phone = value;
        break;
      case "bio":
        result.bio = value;
        break;
      default:
        throw new Error(`mapImportRow: unknown target field "${target}"`);
    }
  }

  if (hasCustom) result.customFields = customFields;

  if (!result.email || result.email.trim() === "") {
    return {};
  }

  return result;
}

/** DEC-417 (amendment): the per-column caps every hand-typed contact editor
 * enforces (src/routes/api/contacts/crud.ts's checkLen, portal-edit.ts) —
 * applied to an already-mapped import row, so a CSV import can never mint
 * (or update) a contact its own drawer would then refuse to re-save.
 * NEVER truncates: a value over cap is reported by target name, and the
 * caller (planImportRows/applyImportRows) refuses the whole row instead of
 * silently shortening it (fail loudly). custom.<key> values are capped at
 * MAX_TEXT_LENGTH, matching checkLen's own customFields.<key> cap in
 * crud.ts. Returns {} when the row is within every cap. */
export function importFieldCapViolations(parsed: Partial<ContactRecord>): Record<string, string> {
  const violations: Record<string, string> = {};
  const check = (value: string | undefined, field: string, max: number) => {
    if (value !== undefined && value.length > max) violations[field] = overBudgetBy(value.length, max);
  };
  check(parsed.email, "email", MAX_NAME_LENGTH);
  check(parsed.firstName, "firstName", MAX_NAME_LENGTH);
  check(parsed.lastName, "lastName", MAX_NAME_LENGTH);
  check(parsed.company, "company", MAX_NAME_LENGTH);
  check(parsed.title, "title", MAX_NAME_LENGTH);
  check(parsed.phone, "phone", MAX_NAME_LENGTH);
  check(parsed.bio, "bio", MAX_LONG_TEXT_LENGTH);
  if (parsed.customFields) {
    for (const [key, value] of Object.entries(parsed.customFields)) {
      check(value, `custom.${key}`, MAX_TEXT_LENGTH);
    }
  }
  return violations;
}
