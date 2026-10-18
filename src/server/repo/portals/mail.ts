// Multi-portal emails: invite to speak, sponsor-session decisions, new
// sponsor speakers' welcome, and sponsor teammate invitations. Each resolves
// portal links through the one batched helper (resolvePortalLinks), so a
// person without an account gets a claim link to set a password.

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import type { Mailer } from "../../../mail/types";
import type { KVStore } from "../../../auth/claim";
import { renderEmailHtml } from "../../../mail/shell";
import { invitationToSpeakReason, sponsorReason } from "../../../mail/reasons";
import { eventDatesLine } from "../../../domain/event-meta";
import { formatDueDay } from "../../../lib/event-time";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../../lib/fanout";
import { newId } from "../../../domain/ids";
import { resolvePortalLinks } from "../portal-link";
import { findAccountUserIds } from "../comms";

async function loadEvent(db: Db, eventId: string) {
  const rows = await db
    .select({ name: schema.event.name, startDate: schema.event.startDate, endDate: schema.event.endDate, location: schema.event.location })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const e = rows[0];
  if (!e) throw new Error(`event ${eventId} not found`);
  return e;
}

interface Recipient {
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
}

async function loadRecipients(db: Db, contactIds: string[]): Promise<Recipient[]> {
  if (contactIds.length === 0) return [];
  return db
    .select({ contactId: schema.contact.id, email: schema.contact.email, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
    .from(schema.contact)
    .where(inArray(schema.contact.id, [...new Set(contactIds)]));
}

/** Sends one message to each recipient with their own portal link. Returns
 * how many went out; a failed send is logged by the mailer and counted. */
async function sendWithPortalLinks(
  db: Db,
  mailer: Mailer,
  kv: KVStore,
  input: {
    eventId: string;
    origin: string;
    recipients: Recipient[];
    subject: string;
    body: (r: Recipient, link: string) => string;
    cta: string;
    // every sender here writes to a sponsor's contacts or speakers
    companyName: string;
    fact?: { label: string; value: string } | null;
  },
): Promise<{ sent: number; failed: number }> {
  const recipients = input.recipients.filter((r) => r.email);
  if (recipients.length === 0) return { sent: 0, failed: 0 };
  const event = await loadEvent(db, input.eventId);
  const accounts = await findAccountUserIds(db, recipients.map((r) => ({ contactId: r.contactId, email: r.email })));
  const links = await resolvePortalLinks(
    kv,
    recipients.map((r) => ({ contactId: r.contactId, userId: accounts.get(r.contactId) ?? null })),
    input.eventId,
    input.origin,
    true,
  );
  const batchId = newId();
  const results = await mapWithConcurrency(recipients, MAIL_FANOUT_CONCURRENCY, async (r) => {
    const link = links.get(r.contactId)!;
    const text = input.body(r, link);
    await mailer.send({
      to: { email: r.email, name: `${r.firstName} ${r.lastName}`.trim() },
      subject: input.subject,
      text,
      html: renderEmailHtml(text, {
        eventName: event.name,
        reason: sponsorReason(event.name, input.companyName),
        eventMeta: eventDatesLine(event),
        cta: { label: input.cta, href: link },
        fact: input.fact ?? null,
      }),
      eventId: input.eventId,
      contactId: r.contactId,
      batchId,
    });
  });
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, failed: results.length - sent };
}

/** The invitation email (Portals frame, flow 8 "Invitation email"). */
export async function sendInvitationToSpeak(
  db: Db,
  mailer: Mailer,
  input: {
    eventId: string;
    contactId: string;
    origin: string;
    token: string;
    sessionTitle: string;
    sessionLine: string | null;
    // "give a talk", "join a panel"
    pitch: string;
    replyBy: number | null;
    message: string | null;
    organizerName: string;
  },
): Promise<void> {
  const [r] = await loadRecipients(db, [input.contactId]);
  if (!r?.email) throw new Error("The invitee has no email address on file.");
  const event = await loadEvent(db, input.eventId);
  const link = `${input.origin}/portal/invitations/${input.token}`;
  const lines = [
    `Hi ${r.firstName},`,
    "",
    `We'd love you to ${input.pitch} at ${event.name}.`,
    ...(input.message ? ["", `"${input.message}"`] : []),
    "",
    input.sessionTitle,
    ...(input.sessionLine ? [input.sessionLine] : []),
    ...(input.replyBy ? ["", `Please reply by ${formatDueDay(input.replyBy)}.`] : []),
    "",
    `See the invitation: ${link}`,
    "",
    `— ${input.organizerName}, ${event.name}`,
  ];
  const text = lines.join("\n");
  await mailer.send({
    to: { email: r.email, name: `${r.firstName} ${r.lastName}`.trim() },
    subject: `You're invited to speak at ${event.name}`,
    text,
    html: renderEmailHtml(text, {
      eventName: event.name,
      reason: invitationToSpeakReason(event.name),
      eventMeta: eventDatesLine(event),
      cta: { label: "See the invitation", href: link },
    }),
    eventId: input.eventId,
    contactId: r.contactId,
  });
}

/** A decision on a sponsor session, to every joined contact of the sponsor. */
export async function sendSponsorSessionNotice(
  db: Db,
  mailer: Mailer,
  kv: KVStore,
  input: {
    eventId: string;
    origin: string;
    contactIds: string[];
    companyName: string;
    sessionTitle: string;
    decision: "approved" | "changes_requested" | "declined";
    note: string | null;
    organizerName: string;
  },
): Promise<{ sent: number; failed: number }> {
  const event = await loadEvent(db, input.eventId);
  const subject =
    input.decision === "approved"
      ? `Approved: ${input.sessionTitle}`
      : input.decision === "changes_requested"
        ? `Changes requested: ${input.sessionTitle}`
        : `Not accepted: ${input.sessionTitle}`;
  const lead =
    input.decision === "approved"
      ? `"${input.sessionTitle}" is approved and in the ${event.name} program. The organizers will confirm the time and room.`
      : input.decision === "changes_requested"
        ? `The organizers asked for changes to "${input.sessionTitle}". Edit it in your portal and resubmit.`
        : `"${input.sessionTitle}" wasn't accepted. Your slot is free again, so you can design a different session.`;
  return sendWithPortalLinks(db, mailer, kv, {
    eventId: input.eventId,
    origin: input.origin,
    recipients: await loadRecipients(db, input.contactIds),
    subject,
    body: (r, link) =>
      [`Hi ${r.firstName},`, "", lead, ...(input.note ? ["", `"${input.note}" — ${input.organizerName}`] : []), "", `Open your portal: ${link}`].join("\n"),
    cta: "Open your portal",
    companyName: input.companyName,
  });
}

/** Welcome for sponsor-added speakers once their session is approved. */
export async function sendSponsorSpeakerWelcome(
  db: Db,
  mailer: Mailer,
  kv: KVStore,
  input: { eventId: string; origin: string; contactIds: string[]; companyName: string; sessionTitle: string },
): Promise<{ sent: number; failed: number }> {
  const event = await loadEvent(db, input.eventId);
  return sendWithPortalLinks(db, mailer, kv, {
    eventId: input.eventId,
    origin: input.origin,
    recipients: await loadRecipients(db, input.contactIds),
    subject: `You're speaking at ${event.name}`,
    body: (r, link) =>
      [
        `Hi ${r.firstName},`,
        "",
        `${input.companyName} added you as a speaker on "${input.sessionTitle}", and it's now in the ${event.name} program.`,
        "",
        `Set up your speaker portal to see what's needed from you: ${link}`,
      ].join("\n"),
    cta: "Set up your portal",
    companyName: input.companyName,
  });
}

/** A sponsor contact invited a teammate into the company's section. */
export async function sendTeammateInvitation(
  db: Db,
  mailer: Mailer,
  kv: KVStore,
  input: { eventId: string; origin: string; contactId: string; companyName: string; inviterName: string },
): Promise<{ sent: number; failed: number }> {
  const event = await loadEvent(db, input.eventId);
  return sendWithPortalLinks(db, mailer, kv, {
    eventId: input.eventId,
    origin: input.origin,
    recipients: await loadRecipients(db, [input.contactId]),
    subject: `Join ${input.companyName}'s team for ${event.name}`,
    body: (r, link) =>
      [
        `Hi ${r.firstName},`,
        "",
        `${input.inviterName} invited you to help with ${input.companyName}'s sponsorship of ${event.name}. You'll see ${input.companyName}'s items in the portal.`,
        "",
        `Join the team: ${link}`,
      ].join("\n"),
    cta: "Join the team",
    companyName: input.companyName,
  });
}
