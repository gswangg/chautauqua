import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { ApiError } from "../src/server/http";
import {
  isWikiResource,
  mergePortalSettingsInput,
  resourceBelongsToEvent,
  updateResource,
  type PortalSettingsRecord,
} from "../src/server/repo/portal-config";

describe("mergePortalSettingsInput (portal-settings upsert)", () => {
  it("insert path: defaults showResources true, other fields null when omitted", () => {
    expect(mergePortalSettingsInput(null, {})).toEqual({
      logoUrl: null,
      accentColor: null,
      welcomeMessage: null,
      showResources: true,
    });
  });

  it("insert path: uses provided values, including an explicit false showResources", () => {
    expect(
      mergePortalSettingsInput(null, {
        logoUrl: "https://example.com/logo.png",
        accentColor: "#336699",
        welcomeMessage: "hi",
        showResources: false,
      }),
    ).toEqual({
      logoUrl: "https://example.com/logo.png",
      accentColor: "#336699",
      welcomeMessage: "hi",
      showResources: false,
    });
  });

  const existing: PortalSettingsRecord = {
    id: "ps1",
    eventId: "e1",
    logoUrl: "https://old.example.com/logo.png",
    accentColor: "#111111",
    welcomeMessage: "old welcome",
    showResources: true,
    createdAt: 1,
    updatedAt: 1,
  };

  it("update path: leaves undefined fields unchanged (partial-merge upsert, not a full replace)", () => {
    expect(mergePortalSettingsInput(existing, { accentColor: "#222222" })).toEqual({
      logoUrl: "https://old.example.com/logo.png",
      accentColor: "#222222",
      welcomeMessage: "old welcome",
      showResources: true,
    });
  });

  it("update path: an explicit null clears a field (distinct from undefined = unchanged)", () => {
    expect(mergePortalSettingsInput(existing, { logoUrl: null })).toEqual({
      logoUrl: null,
      accentColor: "#111111",
      welcomeMessage: "old welcome",
      showResources: true,
    });
  });

  it("update path: an explicit false is applied, not treated as omitted", () => {
    expect(mergePortalSettingsInput(existing, { showResources: false }).showResources).toBe(false);
  });
});

describe("resourceBelongsToEvent (IDOR guard)", () => {
  it("is true only when the resource's own event_id matches exactly", () => {
    expect(resourceBelongsToEvent("e1", "e1")).toBe(true);
  });

  it("is false for a mismatched event_id — no cross-tenant leakage", () => {
    expect(resourceBelongsToEvent("e1", "e2")).toBe(false);
  });

  it("is false when the resource doesn't exist (null event_id)", () => {
    expect(resourceBelongsToEvent(null, "e1")).toBe(false);
  });
});

describe("isWikiResource", () => {
  it("accepts kind='wiki'", () => {
    expect(isWikiResource("wiki")).toBe(true);
  });

  it("rejects kind='file' — the gate now applies only to the content field (DEC-029 amendment)", () => {
    expect(isWikiResource("file")).toBe(false);
  });
});

// updateResource (DEC-029 amendment): title and position are writable for
// any resource kind; only `content` is gated on isWikiResource. Runs
// against a real in-memory SQLite engine (same technique as
// test/portal-config-resource-delete-order.test.ts) so the actual repo
// queries are exercised.
const RESOURCE_DDL = `
create table resource (
  id text primary key,
  event_id text,
  kind text,
  title text,
  content text,
  file_id text,
  position integer,
  created_at integer,
  updated_at integer
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(RESOURCE_DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

const eventId = "event-1";

function seedResource(sqlite: DatabaseSync, id: string, kind: string): void {
  const now = Date.now();
  sqlite.exec(`insert into resource (id, event_id, kind, title, content, file_id, position, created_at, updated_at)
    values ('${id}', '${eventId}', '${kind}', 'Original Title', ${kind === "wiki" ? "'Original body'" : "null"}, ${kind === "file" ? "'file-1'" : "null"}, 0, ${now}, ${now})`);
}

describe("updateResource", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("renames a wiki resource's title and content", async () => {
    seedResource(sqlite, "wiki-1", "wiki");
    const updated = await updateResource(db, "wiki-1", eventId, { title: "New Title", content: "New body" });
    expect(updated.title).toBe("New Title");
    expect(updated.content).toBe("New body");
  });

  it("renames a file resource's title (no content sent)", async () => {
    seedResource(sqlite, "file-1", "file");
    const updated = await updateResource(db, "file-1", eventId, { title: "New Handout Title" });
    expect(updated.title).toBe("New Handout Title");
    expect(updated.kind).toBe("file");
  });

  it("updates a file resource's position", async () => {
    seedResource(sqlite, "file-2", "file");
    const updated = await updateResource(db, "file-2", eventId, { position: 3 });
    expect(updated.position).toBe(3);
  });

  it("refuses a content value on a file resource with an 'invalid' ApiError naming the content field", async () => {
    seedResource(sqlite, "file-3", "file");
    await expect(updateResource(db, "file-3", eventId, { content: "sneaky body" })).rejects.toMatchObject({
      code: "invalid",
      fields: { content: "A file resource has no page body" },
    });
  });

  it("rejects.toMatchObject uses a real ApiError instance", async () => {
    seedResource(sqlite, "file-4", "file");
    try {
      await updateResource(db, "file-4", eventId, { content: "x" });
      throw new Error("expected updateResource to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});
