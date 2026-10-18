// Sends the queued "you have new items" emails (portal_notification rows,
// queued by reconcile.ts): one email per person per pass, merging every row
// queued for them, then marks the rows sent.

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import type { Mailer } from "../../../mail/types";
import type { KVStore } from "../../../auth/claim";
import { renderEmailHtml } from "../../../mail/shell";
import { portalNewItemsReason } from "../../../mail/reasons";
import { resolvePortalLinks } from "../portal-link";
import { findAccountUserIds } from "../comms";
import { buildNewItemsMessage, parseNotificationTaskIdsJson, describeNewItem } from "../../../domain/portals/notifications";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../../lib/fanout";
import { buildPersonView } from "./view";
import { MAX_PORTAL_NOTIFICATIONS_PER_PASS } from "../../../domain/portals/limits";


export async function sendQueuedPortalNotifications(
  db: Db,
  mailer: Mailer,
  eventId: string,
  now: Date,
  kv: KVStore,
  origin: string,
): Promise<{ sent: number; failed: number }> {
  const queued = await db
    .select()
    .from(schema.portalNotification)
    .where(and(eq(schema.portalNotification.eventId, eventId), isNull(schema.portalNotification.sentAt)));
  if (queued.length === 0) return { sent: 0, failed: 0 };

  const byContact = new Map<string, { rowIds: string[]; taskIds: Set<string> }>();
  for (const row of queued) {
    const entry = byContact.get(row.contactId) ?? { rowIds: [], taskIds: new Set<string>() };
    entry.rowIds.push(row.id);
    for (const t of parseNotificationTaskIdsJson(row.taskIdsJson)) entry.taskIds.add(t);
    byContact.set(row.contactId, entry);
  }
  const contactIds = [...byContact.keys()].slice(0, MAX_PORTAL_NOTIFICATIONS_PER_PASS);

  const eventRows = await db.select({ name: schema.event.name }).from(schema.event).where(eq(schema.event.id, eventId)).limit(1);
  const event = eventRows[0];
  if (!event) throw new Error(`event ${eventId} not found`);

  const contacts = new Map<string, { email: string; firstName: string; lastName: string }>();
  for (const chunk of chunkIds(contactIds)) {
    const rows = await db
      .select({ id: schema.contact.id, email: schema.contact.email, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, chunk));
    for (const r of rows) contacts.set(r.id, r);
  }

  const accountMap = await findAccountUserIds(
    db,
    contactIds.map((id) => ({ contactId: id, email: contacts.get(id)?.email ?? "" })),
  );
  const links = await resolvePortalLinks(
    kv,
    contactIds.map((id) => ({ contactId: id, userId: accountMap.get(id) ?? null })),
    eventId,
    origin,
    true,
  );

  const results = await mapWithConcurrency(contactIds, MAIL_FANOUT_CONCURRENCY, async (contactId) => {
    const contact = contacts.get(contactId);
    const entry = byContact.get(contactId)!;
    const link = links.get(contactId);
    if (!contact || !link) return { contactId, ok: false };
    // describe the items as the person's home shows them now: an item they
    // already finished, or that left again, isn't news
    const view = await buildPersonView(db, { eventId, contactId, now: now.getTime() });
    const items = [...view.profileItems, ...view.sections.flatMap((s) => s.items)]
      .filter((i) => i.taskId !== null && entry.taskIds.has(i.taskId) && i.state !== "done")
      .map((i) => ({ title: i.title, dueDay: i.dueDay }));
    if (items.length === 0) return { contactId, ok: true };
    const message = buildNewItemsMessage({ eventName: event.name, firstName: contact.firstName, items, portalLink: link });
    try {
      await mailer.send({
        to: { email: contact.email, name: `${contact.firstName} ${contact.lastName}`.trim() },
        subject: message.subject,
        text: message.text,
        html: renderEmailHtml([message.greeting, "", message.lead].join("\n"), {
          eventName: event.name,
          reason: portalNewItemsReason(event.name),
          cta: { label: "Open your portal", href: link },
          fact: { label: "New", value: items.map(describeNewItem).join(". ") + "." },
        }),
        eventId,
        contactId,
      });
      return { contactId, ok: true };
    } catch (err) {
      console.error("portal notification failed", contactId, err);
      return { contactId, ok: false };
    }
  });

  let sent = 0;
  let failed = 0;
  const sentRowIds: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      sent += 1;
      sentRowIds.push(...byContact.get(r.value.contactId)!.rowIds);
    } else failed += 1;
  }
  for (const chunk of chunkIds(sentRowIds)) {
    await db.update(schema.portalNotification).set({ sentAt: now }).where(inArray(schema.portalNotification.id, chunk));
  }
  return { sent, failed };
}
