// contacts export (J11/J12, DEC-597): unlike every other kind in this
// directory, contacts are an org-scoped entity, not an event-scoped one —
// the route stays event-scoped (DEC-027's `/events/:eventId/export/:kind`,
// inherited verbatim per DEC-597) but the row query filters by the calling
// event's orgId, not its eventId, so the export is "every contact in this
// org" regardless of which event the URL names.
//
// Column order is fixed: id, firstName, lastName, email, company, title,
// tags, created. There is no tags concept anywhere in the contact data
// model (no column, no join table) as of DEC-597 — the column is declared
// per the decision's exact wording but every cell is "" until a tags
// feature exists to populate it. Flagged as a gap, not silently dropped.
//
// DEC-560: total order ends in a unique column. Contacts have no natural
// event-adjacent ordering (agenda's day/start, submissions' seq), so this
// sorts the same way the directory's default "name" sort and the speakers
// export do — (lastName, firstName) — tiebroken by id asc.

import { asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { type ExportTable, buildTable } from "./table";

export const CONTACTS_HEADER = ["id", "firstName", "lastName", "email", "company", "title", "tags", "created"] as const;

export async function exportContacts(db: Db, orgId: string): Promise<ExportTable> {
  const rows = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      title: schema.contact.title,
      createdAt: schema.contact.createdAt,
    })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId))
    .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName), asc(schema.contact.id));

  const outRows = rows.map((r) => [
    r.id,
    r.firstName,
    r.lastName,
    r.email,
    r.company ?? "",
    r.title ?? "",
    "", // tags: no data-model support yet (see module note)
    r.createdAt.toISOString(),
  ]);

  return buildTable([...CONTACTS_HEADER], outRows);
}
