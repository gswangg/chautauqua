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
    firstName: string;
    lastName: string;
    email: string;
    company: string | null;
    title: string | null;
    acceptedRefs: string[];
    visible: boolean;
    bio: string | null;
    headshotUrl: string | null;
    socialLinksJson: string | null;
  }
  const byContact = new Map<string, Agg>();
  for (const r of rows) {
    const existing = byContact.get(r.contactId);
    const agg: Agg = existing ?? {
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      company: r.company,
      title: r.title,
      acceptedRefs: [],
      visible: false,
      bio: r.bio,
      headshotUrl: r.headshotUrl,
      socialLinksJson: r.socialLinksJson,
    };
    if (r.status === "accepted") agg.acceptedRefs.push(formatRef(recordPrefix, r.seq));
    if (r.visible) agg.visible = true;
    byContact.set(r.contactId, agg);
  }

  const outRows = [...byContact.values()].map((a) => {
    const social = parseSocialLinks(a.socialLinksJson);
    return [
      a.firstName,
      a.lastName,
      a.email,
      a.company ?? "",
      a.title ?? "",
      a.acceptedRefs.join("; "),
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
