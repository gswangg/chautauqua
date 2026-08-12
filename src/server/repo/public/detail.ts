// Public/embed repo layer (J10, DEC-151, EMB-05/EMB-08/EMB-13): drill-in
// detail pages for a single speaker or a single session.

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { DEC_258 } from "../../../decisions";
import { safeExternalUrl } from "../../../domain/contacts";
import { parseSocialLinks } from "../profile";
import { visibleSessionConditions, visibleSubmissionConditions, slotWithinEventRange } from "./gates";
import type { PublicEvent, PublicTrack } from "./event";
import { hydrateSessions, type PublicSpeaker } from "./sessions";

// Compile-checked dependency marker: every speaker title/company read below
// comes from participant.title_at_time/org_at_time (DEC-258's frozen
// snapshot), never the live contact — no fallback.
void DEC_258;

/** Schedule placement (day/startMin/endMin/room) for a batch of submission
 * ids, event-scoped. A submission with no row is unscheduled — callers treat
 * that as all-null fields rather than an error. DEC-318: bounded to the
 * event's own date range. */
async function getScheduleInfoForSubmissions(
  db: Db,
  event: Pick<PublicEvent, "id" | "startDate" | "endDate">,
  ids: string[],
): Promise<Map<string, { day: string; startMin: number; endMin: number; roomId: string | null; roomName: string | null }>> {
  const out = new Map<string, { day: string; startMin: number; endMin: number; roomId: string | null; roomName: string | null }>();
  if (ids.length === 0) return out;

  const slotRows: { submissionId: string; day: string; startMin: number; endMin: number; roomId: string | null }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomId: schema.scheduleSlot.roomId,
      })
      .from(schema.scheduleSlot)
      .where(and(inArray(schema.scheduleSlot.submissionId, batch), slotWithinEventRange(event)));
    slotRows.push(...batchRows);
  }

  // bounded by the event's physical room count (~15) — DEC-078 exemption
  const roomIds = [...new Set(slotRows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db
          .select({ id: schema.room.id, name: schema.room.name })
          .from(schema.room)
          .where(and(inArray(schema.room.id, roomIds), eq(schema.room.eventId, event.id)));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  for (const row of slotRows) {
    out.set(row.submissionId, {
      day: row.day,
      startMin: row.startMin,
      endMin: row.endMin,
      roomId: row.roomId,
      roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
    });
  }
  return out;
}

export interface PublicSpeakerDetailSession {
  id: string;
  title: string;
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  room: string | null;
  trackNames: string[];
}

export interface PublicSpeakerDetail {
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  headshotUrl: string | null;
  socialLinks: { label: string; url: string }[];
  sessions: PublicSpeakerDetailSession[];
}

/** Speaker drill-in (DEC-151, EMB-05/EMB-13): reuses visibleSubmissionConditions
 * verbatim, scoped to a single contact within a single event — a contact with
 * zero visible submissions at this event returns null, so the route 404s
 * exactly as an unknown id would (never leaks that a hidden speaker exists). */
export async function getPublicSpeakerDetail(
  db: Db,
  event: PublicEvent,
  contactId: string,
): Promise<PublicSpeakerDetail | null> {
  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      title: schema.participant.titleAtTime,
      company: schema.participant.orgAtTime,
      bio: schema.contact.bio,
      headshotUrl: schema.contact.headshotUrl,
      socialLinksJson: schema.contact.socialLinksJson,
      submissionId: schema.submission.id,
      submissionTitle: schema.submission.title,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, event.id), eq(schema.contact.id, contactId), visibleSubmissionConditions()))
    .orderBy(asc(schema.submission.title), asc(schema.submission.id));

  if (rows.length === 0) return null;

  const submissionIds = [...new Set(rows.map((r) => r.submissionId))];
  const scheduleInfo = await getScheduleInfoForSubmissions(db, event, submissionIds);

  const trackRows: { submissionId: string; name: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, name: schema.track.name })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch))
      .orderBy(asc(schema.track.position), asc(schema.track.id));
    trackRows.push(...batchRows);
  }
  const trackNamesBySubmission = new Map<string, string[]>();
  for (const t of trackRows) {
    const list = trackNamesBySubmission.get(t.submissionId) ?? [];
    list.push(t.name);
    trackNamesBySubmission.set(t.submissionId, list);
  }

  const first = rows[0];
  if (!first) return null;

  // DEC-322: parse the stored social_links_json, then run each non-empty
  // value through safeExternalUrl (external-input boundary), dropping
  // anything unsafe/unparseable. Fixed label order regardless of which
  // fields are populated.
  const parsedSocial = parseSocialLinks(first.socialLinksJson);
  const socialLinks: { label: string; url: string }[] = [];
  const socialFieldOrder: { label: string; key: keyof typeof parsedSocial }[] = [
    { label: "Twitter", key: "twitter" },
    { label: "LinkedIn", key: "linkedin" },
    { label: "GitHub", key: "github" },
    { label: "Website", key: "website" },
  ];
  for (const { label, key } of socialFieldOrder) {
    const safe = safeExternalUrl(parsedSocial[key]);
    if (safe !== null) socialLinks.push({ label, url: safe });
  }

  return {
    contactId: first.contactId,
    firstName: first.firstName,
    lastName: first.lastName,
    title: first.title,
    company: first.company,
    bio: first.bio,
    headshotUrl: first.headshotUrl,
    socialLinks,
    sessions: rows.map((r) => {
      const slot = scheduleInfo.get(r.submissionId);
      return {
        id: r.submissionId,
        title: r.submissionTitle,
        day: slot?.day ?? null,
        startMin: slot?.startMin ?? null,
        endMin: slot?.endMin ?? null,
        room: slot?.roomName ?? null,
        trackNames: trackNamesBySubmission.get(r.submissionId) ?? [],
      };
    }),
  };
}

export interface PublicSessionDetail {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  tracks: PublicTrack[];
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  roomId: string | null;
  roomName: string | null;
  speakers: PublicSpeaker[];
}

/** Session drill-in (DEC-151, EMB-08): visibility-gated exactly like
 * getPublicSessionsByIds, singular; unscheduled sessions get null
 * day/startMin/endMin/room rather than being excluded (a session can be
 * publicly visible before it lands on the agenda). */
export async function getPublicSessionDetail(
  db: Db,
  event: PublicEvent,
  submissionId: string,
): Promise<PublicSessionDetail | null> {
  const visibleRows = await db
    .selectDistinct({ id: schema.submission.id })
    .from(schema.submission)
    .where(
      and(eq(schema.submission.eventId, event.id), eq(schema.submission.id, submissionId), visibleSessionConditions()),
    );
  if (visibleRows.length === 0) return null;

  const [session] = await hydrateSessions(db, [submissionId], event);
  if (!session) return null;

  const scheduleInfo = await getScheduleInfoForSubmissions(db, event, [submissionId]);
  const slot = scheduleInfo.get(submissionId);

  return {
    id: session.id,
    ref: session.ref,
    title: session.title,
    description: session.description,
    tracks: session.tracks,
    day: slot?.day ?? null,
    startMin: slot?.startMin ?? null,
    endMin: slot?.endMin ?? null,
    roomId: slot?.roomId ?? null,
    roomName: slot?.roomName ?? null,
    speakers: session.speakers,
  };
}
