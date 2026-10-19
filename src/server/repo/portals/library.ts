// The item library (Portals frame, flow 2 "Add from the library" / "New
// library item"; Settings · Portals › Libraries): an event's tasks, forms,
// file requests, share kits and resources, and which portals use each.
// Deadlines, required and grace live on the portal item, never here.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { ApiError } from "../../http";
import { isUniqueViolation } from "../constraints";
import { ITEM_SCOPES, LIBRARY_TYPES, SYSTEM_ITEM_HINTS, SYSTEM_ITEM_KINDS, SYSTEM_ITEM_LABELS, SYSTEM_ITEM_SCOPES, type ItemScope, type LibraryType } from "../../../domain/portals/items";
import { MAX_FILE_REQUEST_FILES, MAX_FILE_REQUEST_SIZE_MB, parseAcceptedTypes, type FileTypeGroup } from "../../../domain/portals/file-types";
import { loadEventLibraryTasks, loadEventPortals } from "./store";
import { MAX_LIBRARY_INSTRUCTIONS, MAX_LIBRARY_PAGE, MAX_LIBRARY_TITLE } from "../../../domain/portals/limits";

export { LIBRARY_TYPES, type LibraryType } from "../../../domain/portals/items";


export interface LibraryEntry {
  ref: { taskId: string } | { resourceId: string } | { systemKind: string };
  type: LibraryType | "built_in";
  title: string;
  scope: ItemScope;
  instructions: string | null;
  formId: string | null;
  acceptedTypes: FileTypeGroup[] | null;
  maxSizeMb: number | null;
  maxFiles: number | null;
  usedBy: { id: string; name: string }[];
  // assigned to speakers directly (predates portals, or the Speakers page);
  // for a resource, shown to everyone with a portal
  direct: boolean;
  hint: string;
  // resources only: everyone with a portal, or only portals that list it
  visibility?: "everyone" | "portal";
  // resources only (decision 74): a page participants read or a file they
  // download -- the library is where both are made, edited and deleted
  resource?: { kind: "wiki" | "file"; content: string | null; fileName: string | null };
}

function typeOfTask(kind: string): LibraryType {
  if (kind === "general") return "task";
  if (kind === "form" || kind === "file_request" || kind === "share_kit") return kind;
  return "task";
}

export async function listLibrary(db: Db, eventId: string): Promise<{ entries: LibraryEntry[]; counts: Record<string, number> }> {
  const [tasks, portals, resources] = await Promise.all([
    loadEventLibraryTasks(db, eventId),
    loadEventPortals(db, eventId),
    db
      .select({
        id: schema.resource.id,
        kind: schema.resource.kind,
        title: schema.resource.title,
        content: schema.resource.content,
        visibility: schema.resource.visibility,
        fileName: schema.file.filename,
      })
      .from(schema.resource)
      .leftJoin(schema.file, eq(schema.file.id, schema.resource.fileId))
      .where(eq(schema.resource.eventId, eventId))
      .orderBy(asc(schema.resource.position), asc(schema.resource.title)),
  ]);
  const usage = (pred: (i: { taskId: string | null; resourceId: string | null; systemKind: string | null }) => boolean) =>
    portals.filter((p) => p.items.some(pred)).map((p) => ({ id: p.id, name: p.name }));
  const entries: LibraryEntry[] = [];
  for (const kind of SYSTEM_ITEM_KINDS) {
    const usedBy = usage((i) => i.systemKind === kind);
    entries.push({
      ref: { systemKind: kind },
      type: "built_in",
      title: SYSTEM_ITEM_LABELS[kind],
      scope: SYSTEM_ITEM_SCOPES[kind],
      instructions: null,
      formId: null,
      acceptedTypes: null,
      maxSizeMb: null,
      maxFiles: null,
      usedBy,
      direct: false,
      hint: SYSTEM_ITEM_HINTS[kind],
    });
  }
  for (const t of [...tasks.values()].sort((a, b) => a.title.localeCompare(b.title))) {
    const usedBy = usage((i) => i.taskId === t.id);
    const scopeWord = t.scope === "participation" ? "Participation" : "Person";
    entries.push({
      ref: { taskId: t.id },
      type: typeOfTask(t.kind),
      title: t.title,
      scope: t.scope,
      instructions: t.instructions,
      formId: t.formId,
      acceptedTypes: t.acceptedTypes,
      maxSizeMb: t.maxSizeMb,
      maxFiles: t.maxFiles,
      usedBy,
      direct: t.audience !== "portal",
      hint: usedBy.length > 0 ? `${scopeWord} · used by ${usedBy.map((u) => u.name).join(", ")}` : t.audience !== "portal" ? `${scopeWord} · assigned on Speakers` : `${scopeWord} · not used yet`,
    });
  }
  for (const r of resources) {
    const usedBy = usage((i) => i.resourceId === r.id);
    entries.push({
      ref: { resourceId: r.id },
      type: "resource",
      title: r.title,
      scope: "person",
      instructions: null,
      formId: null,
      acceptedTypes: null,
      maxSizeMb: null,
      maxFiles: null,
      usedBy,
      direct: r.visibility === "everyone",
      visibility: r.visibility === "everyone" ? "everyone" : "portal",
      hint: r.visibility === "everyone" ? "Everyone's resources" : usedBy.length > 0 ? `Only in ${usedBy.map((u) => u.name).join(", ")}` : "Not shown to anyone yet",
      resource: r.kind === "file" ? { kind: "file", content: null, fileName: r.fileName } : { kind: "wiki", content: r.content, fileName: null },
    });
  }
  const counts = {
    task: entries.filter((e) => e.type === "task").length,
    form: entries.filter((e) => e.type === "form").length,
    file_request: entries.filter((e) => e.type === "file_request").length,
    share_kit: entries.filter((e) => e.type === "share_kit").length,
    resource: entries.filter((e) => e.type === "resource").length,
  };
  return { entries, counts };
}

export interface LibraryItemInput {
  type: LibraryType;
  title: string;
  scope: ItemScope;
  instructions: string | null;
  acceptedTypes: FileTypeGroup[] | null;
  maxSizeMb: number | null;
  maxFiles: number | null;
  // resource only
  content: string | null;
}

export function parseLibraryItemInput(body: Record<string, unknown>, partial = false): Partial<LibraryItemInput> {
  const out: Partial<LibraryItemInput> = {};
  if (!partial || body.type !== undefined) {
    if (typeof body.type !== "string" || !(LIBRARY_TYPES as readonly string[]).includes(body.type)) {
      throw new ApiError("invalid", `Type must be one of ${LIBRARY_TYPES.join(", ")}.`, { type: "Invalid value" });
    }
    out.type = body.type as LibraryType;
  }
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim() === "") throw new ApiError("invalid", "An item needs a name.", { title: "Required" });
    if (body.title.length > MAX_LIBRARY_TITLE) throw new ApiError("invalid", `A name is at most ${MAX_LIBRARY_TITLE} characters.`, { title: "Too long" });
    out.title = body.title.trim();
  }
  if (!partial || body.scope !== undefined) {
    const scope = body.scope ?? "person";
    if (typeof scope !== "string" || !(ITEM_SCOPES as readonly string[]).includes(scope)) {
      throw new ApiError("invalid", "About must be the person or the session or company.", { scope: "Invalid value" });
    }
    out.scope = scope as ItemScope;
  }
  if (body.instructions !== undefined) {
    if (body.instructions !== null && (typeof body.instructions !== "string" || body.instructions.length > MAX_LIBRARY_INSTRUCTIONS)) {
      throw new ApiError("invalid", `Instructions are at most ${MAX_LIBRARY_INSTRUCTIONS} characters.`, { instructions: "Too long" });
    }
    out.instructions = typeof body.instructions === "string" && body.instructions.trim() ? body.instructions.trim() : null;
  }
  if (body.acceptedTypes !== undefined) {
    try {
      out.acceptedTypes = body.acceptedTypes === null ? null : parseAcceptedTypes(body.acceptedTypes);
    } catch (err) {
      throw new ApiError("invalid", (err as Error).message, { acceptedTypes: "Invalid value" });
    }
  }
  if (body.maxSizeMb !== undefined) {
    const n = body.maxSizeMb;
    if (n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_FILE_REQUEST_SIZE_MB)) {
      throw new ApiError("invalid", `Max size must be 1 to ${MAX_FILE_REQUEST_SIZE_MB} MB.`, { maxSizeMb: "Out of range" });
    }
    out.maxSizeMb = n as number | null;
  }
  if (body.maxFiles !== undefined) {
    const n = body.maxFiles;
    if (n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_FILE_REQUEST_FILES)) {
      throw new ApiError("invalid", `Files must be 1 to ${MAX_FILE_REQUEST_FILES}.`, { maxFiles: "Out of range" });
    }
    out.maxFiles = n as number | null;
  }
  if (body.content !== undefined) {
    if (body.content !== null && (typeof body.content !== "string" || body.content.length > MAX_LIBRARY_PAGE)) {
      throw new ApiError("invalid", "That page is too long.", { content: "Too long" });
    }
    out.content = typeof body.content === "string" ? body.content : null;
  }
  return out;
}

const KIND_FOR_TYPE: Record<Exclude<LibraryType, "resource">, string> = {
  task: "general",
  form: "form",
  file_request: "file_request",
  share_kit: "share_kit",
};

/** Saves a new library item. A form gets an empty form for the builder to
 * fill; a resource is a page shown only through the portals that list it. */
export async function createLibraryItem(
  db: Db,
  eventId: string,
  input: LibraryItemInput,
  now: Date,
): Promise<{ taskId: string | null; resourceId: string | null; formId: string | null }> {
  if (input.type === "resource") {
    const id = newId();
    const pos = await db.select({ n: sql<number>`count(*)` }).from(schema.resource).where(eq(schema.resource.eventId, eventId));
    await db.insert(schema.resource).values({
      id,
      eventId,
      kind: "wiki",
      title: input.title,
      content: input.content ?? input.instructions ?? "",
      position: Number(pos[0]?.n ?? 0),
      visibility: "portal",
      createdAt: now,
      updatedAt: now,
    });
    return { taskId: null, resourceId: id, formId: null };
  }
  let formId: string | null = null;
  if (input.type === "form") {
    formId = newId();
    await db.insert(schema.form).values({ id: formId, eventId, title: input.title, isDefault: false, createdAt: now, updatedAt: now });
  }
  const id = newId();
  try {
    await db.insert(schema.task).values({
      id,
      eventId,
      kind: KIND_FOR_TYPE[input.type],
      title: input.title,
      instructions: input.instructions,
      required: false,
      formId,
      audience: "portal",
      scope: input.scope,
      deliverableKind: input.type === "file_request" ? "presentation" : null,
      acceptedTypesJson: input.type === "file_request" && input.acceptedTypes ? JSON.stringify(input.acceptedTypes) : null,
      maxSizeMb: input.type === "file_request" ? input.maxSizeMb : null,
      maxFiles: input.type === "file_request" ? input.maxFiles : null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isUniqueViolation(err, "task.event_id")) {
      if (formId) await db.delete(schema.form).where(eq(schema.form.id, formId));
      throw new ApiError("conflict", "The library already has an item with that name.", { title: "Already in the library" });
    }
    throw err;
  }
  return { taskId: id, resourceId: null, formId };
}

export async function updateLibraryTask(db: Db, eventId: string, taskId: string, input: Partial<LibraryItemInput>, now: Date): Promise<void> {
  const rows = await db.select({ id: schema.task.id, kind: schema.task.kind }).from(schema.task).where(and(eq(schema.task.id, taskId), eq(schema.task.eventId, eventId))).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not_found", "Library item not found");
  const set: Partial<typeof schema.task.$inferInsert> = { updatedAt: now };
  if (input.title !== undefined) set.title = input.title;
  if (input.scope !== undefined) set.scope = input.scope;
  if (input.instructions !== undefined) set.instructions = input.instructions;
  if (row.kind === "file_request") {
    if (input.acceptedTypes !== undefined) set.acceptedTypesJson = input.acceptedTypes ? JSON.stringify(input.acceptedTypes) : null;
    if (input.maxSizeMb !== undefined) set.maxSizeMb = input.maxSizeMb;
    if (input.maxFiles !== undefined) set.maxFiles = input.maxFiles;
  }
  try {
    await db.update(schema.task).set(set).where(eq(schema.task.id, taskId));
  } catch (err) {
    if (isUniqueViolation(err, "task.event_id")) throw new ApiError("conflict", "The library already has an item with that name.", { title: "Already in the library" });
    throw err;
  }
}

/** A resource is shown to everyone (today's behaviour) or only through the
 * portals that list it. */
export async function setResourceVisibility(db: Db, eventId: string, resourceId: string, visibility: unknown, now: Date): Promise<void> {
  if (visibility !== "everyone" && visibility !== "portal") {
    throw new ApiError("invalid", "Visibility must be everyone or portal.", { visibility: "Invalid value" });
  }
  const updated = await db
    .update(schema.resource)
    .set({ visibility, updatedAt: now })
    .where(and(eq(schema.resource.id, resourceId), eq(schema.resource.eventId, eventId)))
    .returning({ id: schema.resource.id });
  if (updated.length === 0) throw new ApiError("not_found", "Resource not found");
}
