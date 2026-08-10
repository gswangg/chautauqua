// CRM API (J11), per DEC-026. Route file exports a named Hono<AppEnv>
// sub-app; only src/index.ts mounts it (DEC-012). Every endpoint is
// organizer-only + csrfJson on mutations, org-scoped via auth.orgId, with
// object-level ownership checks on every :id lookup (no IDOR).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/contacts";
import { getEventForOrg } from "../../server/repo/events";
import { createClaimToken, type KVStore } from "../../auth/claim";
import { parseCsv } from "../../lib/csv";
import { mapImportRow, matchesSegment, type ContactRecord, type SegmentRule } from "../../domain/contacts";
import { preflightRender, type RenderTarget } from "../../domain/compose";
import { textToHtml } from "../../mail/render";
import type { Db } from "../../server/context";

export const contactsRoutes = new Hono<AppEnv>();

// NOTE: see events.ts for why a blanket `.use("*", requireOrganizer)` is
// unsafe once mounted under /api/v1 alongside sibling sub-apps — scope to
// this router's own path prefixes instead (DEC-060 w8-d finding).
contactsRoutes.use("/contacts", requireOrganizer);
contactsRoutes.use("/contacts/*", requireOrganizer);
contactsRoutes.use("/segments", requireOrganizer);
contactsRoutes.use("/segments/*", requireOrganizer);

function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function serializeContact(row: repo.ContactRow) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    bio: row.bio,
    headshotUrl: row.headshotUrl,
    notes: row.notes,
    customFields: row.customFieldsJson ? JSON.parse(row.customFieldsJson) : null,
    socialLinks: row.socialLinksJson ? JSON.parse(row.socialLinksJson) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeSegment(row: repo.SegmentRow) {
  return {
    id: row.id,
    name: row.name,
    rules: JSON.parse(row.rulesJson) as SegmentRule[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireOwnedContact(db: Db, id: string, orgId: string): Promise<repo.ContactRow> {
  const contact = await repo.findContactForOrg(db, id, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");
  return contact;
}

async function requireOwnedSegment(db: Db, id: string, orgId: string): Promise<repo.SegmentRow> {
  const segment = await repo.findSegmentForOrg(db, id, orgId);
  if (!segment) throw new ApiError("not_found", "Segment not found");
  return segment;
}

// ---------------------------------------------------------------------------
// Contacts CRUD + list
// ---------------------------------------------------------------------------

contactsRoutes.get("/contacts", async (c) => {
  const orgId = currentOrgId(c);
  const query = c.req.query();
  const params = repo.parseContactListQuery(query as Record<string, string | undefined>);
  const result = await repo.listContactsForOrg(c.var.db, orgId, params);
  return c.json({
    items: result.items.map(serializeContact),
    total: result.total,
    page: params.page,
    perPage: params.perPage,
  });
});

contactsRoutes.post("/contacts", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  if (typeof body.firstName !== "string" || body.firstName.trim() === "") fields.firstName = "required";
  if (typeof body.lastName !== "string" || body.lastName.trim() === "") fields.lastName = "required";
  if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "required";
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const created = await repo.createContact(c.var.db, orgId, {
    firstName: body.firstName as string,
    lastName: body.lastName as string,
    email: body.email as string,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    company: typeof body.company === "string" ? body.company : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    bio: typeof body.bio === "string" ? body.bio : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    customFields: isPlainObject(body.customFields) ? (body.customFields as Record<string, string>) : undefined,
  });
  return c.json(serializeContact(created), 201);
});

contactsRoutes.get("/contacts/duplicates", async (c) => {
  const orgId = currentOrgId(c);
  const groups = await repo.findDuplicateGroupsForOrg(c.var.db, orgId);
  return c.json({ items: groups, total: groups.length, page: 1, perPage: groups.length || 1 });
});

contactsRoutes.get("/contacts/stats", async (c) => {
  const orgId = currentOrgId(c);
  const stats = await repo.getContactStats(c.var.db, orgId);
  return c.json(stats);
});

contactsRoutes.get("/contacts/:id", async (c) => {
  const orgId = currentOrgId(c);
  const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);
  const history = await repo.getContactHistory(c.var.db, contact.id);
  return c.json({ ...serializeContact(contact), history });
});

contactsRoutes.patch("/contacts/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  const patch: repo.ContactPatch = {};
  if (body.firstName !== undefined) {
    if (typeof body.firstName !== "string" || body.firstName.trim() === "") fields.firstName = "must be a non-empty string";
    else patch.firstName = body.firstName;
  }
  if (body.lastName !== undefined) {
    if (typeof body.lastName !== "string" || body.lastName.trim() === "") fields.lastName = "must be a non-empty string";
    else patch.lastName = body.lastName;
  }
  if (body.email !== undefined) {
    if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "must be a non-empty string";
    else patch.email = body.email;
  }
  if (body.phone !== undefined) patch.phone = body.phone === null ? null : String(body.phone);
  if (body.company !== undefined) patch.company = body.company === null ? null : String(body.company);
  if (body.title !== undefined) patch.title = body.title === null ? null : String(body.title);
  if (body.bio !== undefined) patch.bio = body.bio === null ? null : String(body.bio);
  if (body.notes !== undefined) patch.notes = body.notes === null ? null : String(body.notes);
  if (body.customFields !== undefined) {
    if (body.customFields === null) patch.customFields = null;
    else if (isPlainObject(body.customFields)) patch.customFields = body.customFields as Record<string, string>;
    else fields.customFields = "must be an object";
  }
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const updated = await repo.patchContact(c.var.db, contact.id, patch);
  return c.json(serializeContact(updated));
});

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// CSV import (DEC-011/DEC-026)
// ---------------------------------------------------------------------------

contactsRoutes.post("/contacts/import", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.csvText !== "string" || body.csvText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { csvText: "required" });
  }
  if (!isPlainObject(body.mapping)) {
    throw new ApiError("invalid", "Validation failed", { mapping: "required, column -> field" });
  }
  const mapping = body.mapping as Record<string, string>;

  let table: string[][];
  try {
    table = parseCsv(body.csvText);
  } catch (err) {
    throw new ApiError("invalid", err instanceof Error ? err.message : "Failed to parse CSV");
  }
  if (table.length === 0) {
    return c.json({ created: 0, updated: 0, skipped: [] });
  }
  const [header, ...dataRows] = table;
  if (!header) throw new ApiError("invalid", "CSV has no header row");

  const rows = dataRows.map((row, idx) => ({
    line: idx + 2,
    parsed: mapImportRow(mapping, header, row) as Record<string, unknown>,
  }));

  const result = await repo.applyImportRows(c.var.db, orgId, rows);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

contactsRoutes.post("/contacts/merge", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.keepId !== "string" || typeof body.mergeId !== "string") {
    throw new ApiError("invalid", "Validation failed", { keepId: "required", mergeId: "required" });
  }
  if (body.keepId === body.mergeId) {
    throw new ApiError("invalid", "keepId and mergeId must differ", { mergeId: "must differ from keepId" });
  }

  await requireOwnedContact(c.var.db, body.keepId, orgId);
  await requireOwnedContact(c.var.db, body.mergeId, orgId);

  const merged = await repo.mergeContacts(c.var.db, body.keepId, body.mergeId);
  return c.json(serializeContact(merged));
});

// ---------------------------------------------------------------------------
// Segments (migrations/0005_w4_segment.sql, DEC-025/DEC-026)
// ---------------------------------------------------------------------------

function parseRules(body: Record<string, unknown>, fields: Record<string, string>): SegmentRule[] | undefined {
  if (!Array.isArray(body.rules)) {
    fields.rules = "must be an array of {field,op,value}";
    return undefined;
  }
  const rules: SegmentRule[] = [];
  for (const r of body.rules) {
    if (
      typeof r !== "object" ||
      r === null ||
      typeof (r as Record<string, unknown>).field !== "string" ||
      !["eq", "ne", "contains"].includes((r as Record<string, unknown>).op as string) ||
      typeof (r as Record<string, unknown>).value !== "string"
    ) {
      fields.rules = "each rule needs field, op (eq|ne|contains), value";
      return undefined;
    }
    rules.push(r as SegmentRule);
  }
  // Fail loudly at creation time rather than at filter time: a bad field
  // name should reject the segment, not silently break every list query
  // that later applies it.
  try {
    const probe: ContactRecord = { id: "probe", email: "", firstName: "", lastName: "" };
    matchesSegment(rules, probe);
  } catch (err) {
    fields.rules = err instanceof Error ? err.message : "invalid rule";
    return undefined;
  }
  return rules;
}

contactsRoutes.get("/segments", async (c) => {
  const orgId = currentOrgId(c);
  const items = await repo.listSegmentsForOrg(c.var.db, orgId);
  return c.json({ items: items.map(serializeSegment), total: items.length, page: 1, perPage: items.length || 1 });
});

contactsRoutes.post("/segments", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim() === "") fields.name = "required";
  const rules = parseRules(body, fields);
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const created = await repo.createSegment(c.var.db, orgId, body.name as string, rules as SegmentRule[]);
  return c.json(serializeSegment(created), 201);
});

contactsRoutes.patch("/segments/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const segment = await requireOwnedSegment(c.var.db, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  const patch: { name?: string; rules?: SegmentRule[] } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") fields.name = "must be a non-empty string";
    else patch.name = body.name;
  }
  if (body.rules !== undefined) {
    const rules = parseRules(body, fields);
    if (rules) patch.rules = rules;
  }
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const updated = await repo.patchSegment(c.var.db, segment.id, patch);
  return c.json(serializeSegment(updated));
});

contactsRoutes.delete("/segments/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const segment = await requireOwnedSegment(c.var.db, c.req.param("id"), orgId);
  await repo.deleteSegment(c.var.db, segment.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Bulk email (DEC-019 atomic send semantics, DEC-026 restricted whitelist)
// ---------------------------------------------------------------------------

const MAX_BULK_EMAIL_RECIPIENTS = 100;

/** DEC-026: bulk email is contact-scoped, not submission-scoped — only
 * speaker_name/event_name/portal_link resolve; {talk_title}/{feedback} (or
 * any other placeholder) are absent from vars, so preflightRender's
 * MergeFieldError check naturally rejects them as 'invalid'. */
async function resolvePortalLink(db: Db, kv: KVStore, contactId: string, eventId: string, email: string, origin: string): Promise<string> {
  const userId = await repo.findUserIdByEmail(db, email);
  if (userId) return `${origin}/portal`;
  const token = await createClaimToken(kv, { contactId, eventId });
  return `${origin}/claim/${token}`;
}

contactsRoutes.post("/contacts/bulk-email", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0 || !body.contactIds.every((id) => typeof id === "string")) {
    throw new ApiError("invalid", "Validation failed", { contactIds: "must be a non-empty array of contact ids" });
  }
  if (body.contactIds.length > MAX_BULK_EMAIL_RECIPIENTS) {
    throw new ApiError("invalid", `${body.contactIds.length} recipients exceeds the ${MAX_BULK_EMAIL_RECIPIENTS}-recipient cap; narrow the batch.`);
  }
  if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { eventId: "required" });
  }
  if (typeof body.subject !== "string" || body.subject.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { subject: "required" });
  }
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { bodyText: "required" });
  }

  const event = await getEventForOrg(c.var.db, body.eventId, orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const contactIds = body.contactIds as string[];
  const contacts = await repo.findContactsForOrg(c.var.db, contactIds, orgId);
  if (contacts.length !== contactIds.length) {
    throw new ApiError("not_found", "One or more contacts not found");
  }

  const kv = c.env.KV as unknown as KVStore;
  const origin = new URL(c.req.url).origin;
  const targets: RenderTarget[] = [];
  for (const contact of contacts) {
    const portalLink = await resolvePortalLink(c.var.db, kv, contact.id, event.id, contact.email, origin);
    targets.push({
      contactId: contact.id,
      submissionId: "",
      email: contact.email,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      vars: {
        speaker_name: `${contact.firstName} ${contact.lastName}`.trim(),
        event_name: event.name,
        portal_link: portalLink,
      },
    });
  }

  // Atomic preflight (DEC-019): every recipient must render before the
  // first send is attempted; any failure (including a submission-scoped
  // placeholder like {talk_title}/{feedback}, absent from the whitelist
  // above) rejects the whole batch — zero sends.
  const result = preflightRender(targets, body.subject, body.bodyText);
  if (!result.ok) {
    const fields: Record<string, string> = {};
    for (const m of result.missing) fields[m.contactId] = `missing merge field '${m.field}'`;
    throw new ApiError("invalid", "One or more recipients are missing merge fields (only speaker_name/event_name/portal_link are allowed)", fields);
  }

  const { makeMailer } = await import("../../server/context");
  const mailer = makeMailer(c.var.db);
  for (const rendered of result.rendered) {
    await mailer.send({
      to: { email: rendered.email, name: rendered.name },
      subject: rendered.subject,
      text: rendered.text,
      html: textToHtml(rendered.text),
      eventId: event.id,
      contactId: rendered.contactId,
    });
  }

  return c.json({ sent: result.rendered.length, items: result.rendered });
});
