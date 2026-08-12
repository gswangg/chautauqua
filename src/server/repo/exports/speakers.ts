// speakers export (J12, DEC-027).

import { eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { parseSocialLinks } from "../profile";
import { DEC_258 } from "../../../decisions";
import { type ExportTable, buildTable } from "./table";
import { getRecordPrefix } from "./common";

// exportSpeakers below reads participant.title_at_time/org_at_time (DEC-258
// frozen snapshot), never the live contact.
void DEC_258;

export async function exportSpeakers(db: Db, eventId: string): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);
  // DEC-515: bio/headshotUrl/social links appended so the export carries a
  // public-speakers-list-worthy profile, not just contact identity.
  const header = [
    "firstName",
    "lastName",
    "email",
    "company",
    "title",
    "acceptedSessions",
    "visible",
    "bio",
    "headshotUrl",
    "twitter",
    "linkedin",
    "github",
    "website",
  ];

  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.participant.orgAtTime,
      title: schema.participant.titleAtTime,
      visible: schema.participant.visible,
      status: schema.submission.status,
      seq: schema.submission.seq,
      bio: schema.contact.bio,
      headshotUrl: schema.contact.headshotUrl,
      socialLinksJson: schema.contact.socialLinksJson,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(eq(schema.submission.eventId, eventId));

  interface Agg {
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string | null;
    title: string | null;
    acceptedSeqs: number[];
    visible: boolean;
    bio: string | null;
    headshotUrl: string | null;
    socialLinksJson: string | null;
  }
  const byContact = new Map<string, Agg>();
  for (const r of rows) {
    const existing = byContact.get(r.contactId);
    const agg: Agg = existing ?? {
      contactId: r.contactId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      company: r.company,
      title: r.title,
      acceptedSeqs: [],
      visible: false,
      bio: r.bio,
      headshotUrl: r.headshotUrl,
      socialLinksJson: r.socialLinksJson,
    };
    if (r.status === "accepted") agg.acceptedSeqs.push(r.seq);
    if (r.visible) agg.visible = true;
    byContact.set(r.contactId, agg);
  }

  // DEC-560: total order by (lastName, firstName, contactId); each speaker's
  // accepted-session list is a Set-derived cell, so it is sorted (by
  // submission seq, the ref's numeric ordering) before joining.
  const sorted = [...byContact.values()].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0),
  );

  const outRows = sorted.map((a) => {
    const social = parseSocialLinks(a.socialLinksJson);
    const acceptedRefs = [...a.acceptedSeqs].sort((x, y) => x - y).map((seq) => formatRef(recordPrefix, seq));
    return [
      a.firstName,
      a.lastName,
      a.email,
      a.company ?? "",
      a.title ?? "",
      acceptedRefs.join("; "),
      a.visible ? "true" : "false",
      a.bio ?? "",
      a.headshotUrl ?? "",
      social.twitter,
      social.linkedin,
      social.github,
      social.website,
    ];
  });

  return buildTable(header, outRows);
}
