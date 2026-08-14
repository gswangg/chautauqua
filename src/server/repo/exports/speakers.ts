// speakers export (J12, DEC-027).

import { asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { parseSocialLinks } from "../profile";
import { DEC_258 } from "../../../decisions";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { type ExportTable, EXPORT_MAX_ROWS, buildTable } from "./table";
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
      inviteStatus: schema.participant.inviteStatus,
      status: schema.submission.status,
      contentStatus: schema.submission.contentStatus,
      seq: schema.submission.seq,
      bio: schema.contact.bio,
      headshotUrl: schema.contact.headshotUrl,
      socialLinksJson: schema.contact.socialLinksJson,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(eq(schema.submission.eventId, eventId))
    // DEC-560 amendment: total order (submission.seq asc, then participant id
    // asc) so the per-contact aggregation below — which keeps the
    // lowest-seq accepted participant row's company/title — is reproducible
    // regardless of physical row-return order.
    .orderBy(asc(schema.submission.seq), asc(schema.participant.id))
    .limit(EXPORT_MAX_ROWS + 1);

  // DEC-027 amendment (wave 50): bound on the query — the driving
  // participant/contact/submission join is the row query this kind selects,
  // so cap+1 rows here (before per-contact aggregation) proves overflow.
  if (rows.length > EXPORT_MAX_ROWS) {
    return buildTable(header, [], true);
  }

  interface Agg {
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string | null;
    title: string | null;
    // Lowest submission.seq seen overall (fallback source for company/title)
    // and lowest submission.seq seen among ACCEPTED (inviteStatus) rows
    // (preferred source) — tracked independently of row arrival order so
    // the aggregate is reproducible under any row shuffle, not just the
    // SQL ORDER BY above.
    fallbackSeq: number;
    acceptedSeq: number | null;
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
      fallbackSeq: r.seq,
      acceptedSeq: null,
      acceptedSeqs: [],
      visible: false,
      bio: r.bio,
      headshotUrl: r.headshotUrl,
      socialLinksJson: r.socialLinksJson,
    };
    if (r.status === "accepted") agg.acceptedSeqs.push(r.seq);
    // Fallback (first-row-overall, by lowest submission.seq) — used only
    // when the contact has no accepted participant row at all.
    if (agg.acceptedSeq === null && r.seq < agg.fallbackSeq) {
      agg.fallbackSeq = r.seq;
      agg.company = r.company;
      agg.title = r.title;
    }
    // DEC-560 amendment: company/title come from the contact's ACCEPTED
    // (participant.inviteStatus='accepted') row with the lowest
    // submission.seq, never "whichever row the driver happened to return
    // first" — computed by keeping the minimum seq seen so far, order-
    // independent.
    if (r.inviteStatus === "accepted" && (agg.acceptedSeq === null || r.seq < agg.acceptedSeq)) {
      agg.acceptedSeq = r.seq;
      agg.company = r.company;
      agg.title = r.title;
    }
    // DEC-560 amendment: mirrors src/server/repo/public/gates.ts's
    // visibleSubmissionConditions() — visible iff at least one participant
    // row has visible=1 AND inviteStatus in ACTIVE_INVITE_STATUSES on a
    // submission that is status='accepted' AND contentStatus='approved'.
    // Diff this block against gates.ts if the two ever appear to disagree.
    if (
      r.visible &&
      (ACTIVE_INVITE_STATUSES as readonly string[]).includes(r.inviteStatus) &&
      r.status === "accepted" &&
      r.contentStatus === "approved"
    ) {
      agg.visible = true;
    }
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
