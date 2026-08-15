// DEC-601: every file version response must name its uploader server-side
// (uploaderName), resolved via ONE batched contact lookup scoped to the
// page being returned -- never invented client-side, never null-coalesced
// to a made-up string. Covers both GET /api/v1/submissions/:id/files and
// GET /api/v1/events/:eventId/files (mirrors the buildApp() route-mock
// pattern in test/files-list-bounds.test.ts).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const SUBMISSION_ID = "sub-1";
const EVENT_ID = "event-1";
const CONTACT_WITH_NAME = "contact-priya";
const CONTACT_DELETED = "contact-ghost";

const VERSIONS_BY_KIND = {
  slides: [
    {
      id: "file-v2",
      filename: "slides-v2.pdf",
      sizeBytes: 100,
      contentType: "application/pdf",
      previousFileId: "file-v1",
      uploadedByContactId: CONTACT_WITH_NAME,
      createdAt: 2000,
    },
    {
      id: "file-v1",
      filename: "slides-v1.pdf",
      sizeBytes: 90,
      contentType: "application/pdf",
      previousFileId: null,
      // Organizer/admin upload — no linked contact.
      uploadedByContactId: null,
      createdAt: 1000,
    },
    {
      id: "file-v0",
      filename: "handout.pdf",
      sizeBytes: 80,
      contentType: "application/pdf",
      previousFileId: null,
      // Contact id references a row that no longer exists — batchContactNames
      // must not throw, and the route must not invent a name for it either.
      uploadedByContactId: CONTACT_DELETED,
      createdAt: 500,
    },
  ],
};

let batchContactNamesCalls: string[][] = [];

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID
        ? { submissionId, eventId: EVENT_ID, orgId: ORG_A, readParticipantContactIds: [], activeParticipantContactIds: [] }
        : null,
    ),
    listSubmissionFiles: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID ? VERSIONS_BY_KIND : {},
    ),
    getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === EVENT_ID ? { orgId: ORG_A, slug: "evt" } : null,
    ),
    listEventDeliverableFiles: vi.fn(async () => ({
      items: [
        {
          rootFileId: "file-v1",
          latestFileId: "file-v2",
          filename: "slides-v2.pdf",
          kind: "presentation",
          submissionId: SUBMISSION_ID,
          submissionRef: "SES-001",
          submissionTitle: "Talk",
          speakerName: "Priya Raman",
          uploadedAt: 2000,
          versionCount: 2,
          sizeBytes: 100,
          uploaderName: "Priya Raman",
        },
        {
          rootFileId: "file-v0",
          latestFileId: "file-v0",
          filename: "handout.pdf",
          kind: "handout",
          submissionId: SUBMISSION_ID,
          submissionRef: "SES-001",
          submissionTitle: "Talk",
          speakerName: "Priya Raman",
          uploadedAt: 500,
          versionCount: 1,
          sizeBytes: 80,
          uploaderName: null,
        },
      ],
      total: 2,
      page: 1,
      perPage: 50,
    })),
    batchContactNames: vi.fn(async (_db: unknown, contactIds: string[]) => {
      batchContactNamesCalls.push([...contactIds].sort());
      const map = new Map<string, string>();
      if (contactIds.includes(CONTACT_WITH_NAME)) map.set(CONTACT_WITH_NAME, "Priya Raman");
      // CONTACT_DELETED deliberately has no entry — simulates a contact row
      // that no longer exists.
      return map;
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  batchContactNamesCalls = [];
});

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

interface FileItem {
  id: string;
  uploadedByContactId: string | null;
  uploaderName: string | null;
}

describe("DEC-601: GET /api/v1/submissions/:id/files names the uploader", () => {
  it("a version uploaded by a contact reports that contact's name", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: FileItem[] };
    const v2 = body.items.find((i) => i.id === "file-v2");
    expect(v2?.uploaderName).toBe("Priya Raman");
  });

  it("a version with a null contact reports uploaderName null, never an invented string", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files`);
    const body = (await res.json()) as { items: FileItem[] };
    const v1 = body.items.find((i) => i.id === "file-v1");
    expect(v1?.uploadedByContactId).toBeNull();
    expect(v1?.uploaderName).toBeNull();
  });

  it("a contactId with no matching contact row also reports null, never a fabricated name", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files`);
    const body = (await res.json()) as { items: FileItem[] };
    const orphan = body.items.find((i) => i.id === "file-v0");
    expect(orphan?.uploadedByContactId).toBe(CONTACT_DELETED);
    expect(orphan?.uploaderName).toBeNull();
  });

  it("resolves names in ONE batched lookup scoped to the page's uploader ids", async () => {
    const app = await buildApp(organizer);
    await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files`);
    expect(batchContactNamesCalls.length).toBe(1);
    expect(batchContactNamesCalls[0]).toEqual([CONTACT_DELETED, CONTACT_WITH_NAME].sort());
  });
});

describe("DEC-601: GET /api/v1/events/:eventId/files names the uploader", () => {
  it("forwards uploaderName from the repo layer for both a named and a null uploader", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/files`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { rootFileId: string; uploaderName: string | null }[] };
    const named = body.items.find((i) => i.rootFileId === "file-v1");
    const orphan = body.items.find((i) => i.rootFileId === "file-v0");
    expect(named?.uploaderName).toBe("Priya Raman");
    expect(orphan?.uploaderName).toBeNull();
  });
});
