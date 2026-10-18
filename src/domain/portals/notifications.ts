// "You have new items" emails (multi-portal): the queued payload and the
// message. Pure core.

import { formatDueDay } from "../../lib/event-time";
import { plural, spellCount } from "../count-copy";

/** Validates portal_notification.task_ids_json: a list of task ids. */
export function parseNotificationTaskIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.some((v) => typeof v !== "string" || v === "")) {
    throw new Error("notification task ids must be a list of ids");
  }
  return input as string[];
}

export function parseNotificationTaskIdsJson(json: string): string[] {
  return parseNotificationTaskIds(JSON.parse(json));
}

export interface NewItemLine {
  title: string;
  dueDay: number | null;
}

export function describeNewItem(item: NewItemLine): string {
  return item.dueDay === null ? item.title : `${item.title} (due ${formatDueDay(item.dueDay)})`;
}

export function buildNewItemsMessage(input: {
  eventName: string;
  firstName: string;
  items: NewItemLine[];
  portalLink: string;
}): { subject: string; text: string; greeting: string; lead: string; list: string } {
  const n = input.items.length;
  const subject = `New in your ${input.eventName} portal`;
  const greeting = `Hi ${input.firstName || "there"},`;
  const lead = `You have ${spellCount(n)} new ${plural(n, "item")} in your portal for ${input.eventName}.`;
  const list = input.items.map((i) => `- ${describeNewItem(i)}`).join("\n");
  const text = [greeting, "", lead, "", list, "", `Open your portal: ${input.portalLink}`].join("\n");
  return { subject, text, greeting, lead, list };
}
