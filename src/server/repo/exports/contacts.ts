// contacts export (J11/J12, DEC-597): unlike every other kind in this
// directory, contacts are an org-scoped entity, not an event-scoped one —
// the route stays event-scoped (DEC-027's `/events/:eventId/export/:kind`,
// inherited verbatim per DEC-597) but the row query filters by the calling
// event's orgId, not its eventId, so the export is "every contact in this
// org" regardless of which event the URL names.
//
// Column order is fixed: id, firstName, lastName, email, company, title,
// labels, created. DEC-977: the seventh column carries Labels, not an
// always-empty "tags" placeholder — Labels ARE customFields (DEC-738/
// DEC-726), formatted once by domain/contact-labels's contactLabels, so
// this export reads the exact same values the directory table, contact
// drawer and merge screens render (reserved travel key excluded per
// DEC-292: travel/logistics is not a label).
//
// DEC-560: total order ends in a unique column. Contacts have no natural
// event-adjacent ordering (agenda's day/start, submissions' seq), so this
// sorts the same way the directory's default "name" sort and the speakers
// export do — (lastName, firstName) — tiebroken by id asc.

import { asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { type ExportTable, EXPORT_MAX_ROWS, buildTable } from "./table";
import { selectFilteredContactRows, parseContactCustomFields } from "../contacts/crud";
import type { ParsedContactListQuery } from "../contacts/query";
import type { ContactRow } from "../contacts/rows";
import { contactLabels } from "../../../domain/contact-labels";

export const CONTACTS_HEADER = ["id", "firstName", "lastName", "email", "company", "title", "labels", "created"] as const;

function rowToCsvRow(r: { id: string; firstName: string; lastName: string; email: string; company: string | null; title: string | null; createdAt: string; customFields: Record<string, string> }): string[] {
  return [
    r.id,
    r.firstName,
    r.lastName,
    r.email,
    r.company ?? "",
    r.title ?? "",
    contactLabels(r.customFields).join(" · "),
    r.createdAt,
  ];
}

/** DEC-671: when `params` is supplied, the export carries the directory's
 * own filter (q/segmentId/rules) via selectFilteredContactRows — the same
 * row-selection predicate the list endpoint uses, minus the page window.
 * Without params (e.g. internal/unfiltered callers), every org contact is
 * exported, as before. */
export async function exportContacts(db: Db, orgId: string, params?: ParsedContactListQuery): Promise<ExportTable> {
  if (params) {
    // DEC-027 amendment (wave 50): bound on the query — cap+1 rows proves
    // overflow before the (lastName, firstName, id) re-sort / labels work
    // below.
    const rows: ContactRow[] = await selectFilteredContactRows(db, orgId, params, EXPORT_MAX_ROWS + 1);
    if (rows.length > EXPORT_MAX_ROWS) {
      return buildTable([...CONTACTS_HEADER], [], true);
    }
    // (lastName, firstName, id) ordering to match the unfiltered path —
    // selectFilteredContactRows's default branch already sorts this way in
    // SQL, but the segment/rules scan branch sorts by the requested
    // params.sort, so re-sort here for a stable export ordering regardless
    // of which branch produced the rows.
    const sorted = [...rows].sort((a, b) => {
      const last = a.lastName.localeCompare(b.lastName);
      if (last !== 0) return last;
      const first = a.firstName.localeCompare(b.firstName);
      if (first !== 0) return first;
      return a.id.localeCompare(b.id);
    });
    const outRows = sorted.map((r) =>
      rowToCsvRow({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        company: r.company,
        title: r.title,
        createdAt: new Date(r.createdAt).toISOString(),
        customFields: parseContactCustomFields(r.customFieldsJson),
      }),
    );
    return buildTable([...CONTACTS_HEADER], outRows);
  }

  const rows = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      title: schema.contact.title,
      createdAt: schema.contact.createdAt,
      customFieldsJson: schema.contact.customFieldsJson,
    })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId))
    .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName), asc(schema.contact.id))
    .limit(EXPORT_MAX_ROWS + 1);

  // DEC-027 amendment (wave 50): bound on the query — cap+1 rows proves
  // overflow.
  if (rows.length > EXPORT_MAX_ROWS) {
    return buildTable([...CONTACTS_HEADER], [], true);
  }

  const outRows = rows.map((r) =>
    rowToCsvRow({
      ...r,
      createdAt: r.createdAt.toISOString(),
      customFields: parseContactCustomFields(r.customFieldsJson),
    }),
  );

  return buildTable([...CONTACTS_HEADER], outRows);
}
