// v12m-w35-g (DEC-393/DEC-996 wave-35): covers the two portal-side receipts
// this task adds.
//
// SITE 1 -- GET /portal/tasks: the completed file_request card's inline
// file-download link (tasks/views.tsx) now carries its own
// `chq-portal-file-link` class token (DEC-996) and is GROUNDED (DEC-393
// wave-35 ladder rung 2) on `.chq-portal-version-link`'s current-version
// row, rendered on the same page immediately below it.
//
// SITE 2 -- GET /portal/submissions/:id/edit: the Tracks fieldset's bare
// `<input type=checkbox>` rows render inside `label.chq-cfp-option`, which
// already carries the 44px floor (min-height:46px, centred flex, non-zero
// horizontal padding) -- this test proves the markup shape the CSS
// receipt's premise depends on.
//
// Real `app.request()` dispatches against a real Hono app (mocks + buildApp
// idiom copied from test/portal-file-versions.test.ts and
// test/portal-edit-390-frames.test.ts, DEC-613: never a private copy) --
// never a source scan.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

// ---------------------------------------------------------------------
// SITE 1 fixture: one completed file_request assignment with a two-entry
// version chain, so both the inline download link and the VersionHistory
// section (with its floored `.chq-portal-version-link`) render on the same
// page.
// ---------------------------------------------------------------------

const ASSIGNMENT_ID = "assign-1";
const FILE_V1 = "file-v1";
const FILE_V2_LATEST = "file-v2-latest";
const T0 = Date.parse("2026-01-01T00:00:00Z");

const CHAIN_LATEST = {
  id: FILE_V2_LATEST,
  filename: "slides-v2.pdf",
  contentType: "application/pdf",
  r2Key: "task/assign-1/slides-v2.pdf",
  createdAt: T0 + 86_400_000,
};

const CHAIN_VERSIONS = [
  { id: FILE_V1, filename: "slides-v1.pdf", contentType: "application/pdf", r2Key: "task/assign-1/slides-v1.pdf", createdAt: T0, versionNo: 1 },
  { ...CHAIN_LATEST, versionNo: 2 },
];

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { eventId: "evt-1", eventName: "Arbitrary Con", welcomeMessage: null, accentColor: null, logoUrl: null },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => [
      {
        id: ASSIGNMENT_ID,
        taskId: "task-1",
        eventId: "evt-1",
        kind: "file_request",
        title: "Upload slides",
        description: null,
        instructions: null,
        dueDate: null,
        assignedAt: 0,
        required: true,
        status: "complete",
        formId: null,
        deliverableKind: null,
        fileId: FILE_V1,
        responseJson: null,
        timezone: "UTC",
        completedAt: T0 + 86_400_000,
      },
    ]),
    getAssignmentScope: vi.fn(async () => null),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async () => null),
    getMyResources: vi.fn(async () => []),
    listDeliverableCandidatesForEvents: vi.fn(async () => new Map()),
    listLatestDeliverables: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    resolveTaskFileChainLatest: vi.fn(async () => CHAIN_LATEST),
    resolveTaskFileChainLatestMany: vi.fn(async () => new Map([[FILE_V1, CHAIN_LATEST]])),
    listFileChainVersions: vi.fn(async () => CHAIN_VERSIONS),
    listFileChainVersionsMany: vi.fn(async () => new Map([[FILE_V1, CHAIN_VERSIONS]])),
    listFileCommentsForFiles: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return { ...actual, listFields: vi.fn(async () => []) };
});

// ---------------------------------------------------------------------
// SITE 2 fixture: an editable session with three offered tracks, all
// selected -- exercises the `.chq-cfp-option` checkbox rows.
// ---------------------------------------------------------------------

const TRACK_1 = { id: "track-1", name: "Platform & Infra" };
const TRACK_2 = { id: "track-2", name: "Product" };
const TRACK_3 = { id: "track-3", name: "Design" };

const EDIT_DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  // Far future so canEditTracks(closeDate, Date.now(), timezone) is true.
  form: { id: "f1", closeDate: Date.UTC(2099, 0, 1), timezone: "America/Los_Angeles" },
  fields: [
    { id: "first_name", section: "speaker", kind: "text", label: "First name", required: true, position: 0 },
  ] as FormFieldDef[],
  answers: { first_name: "Jane" },
  offeredTrackIds: [TRACK_1.id, TRACK_2.id, TRACK_3.id],
  allTracks: [TRACK_1, TRACK_2, TRACK_3],
  selectedTrackIds: [TRACK_1.id, TRACK_2.id, TRACK_3.id],
  formatLabel: null,
};

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (): Promise<EditableSubmissionData | null> => EDIT_DATA),
    getPortalParticipants: vi.fn(async () => []),
    getAllSubmissionParticipants: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  const profile: ContactProfile = {
    id: "ct-1",
    firstName: "Priya",
    lastName: "Raman",
    title: null,
    company: null,
    bio: null,
    headshotUrl: null,
    socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
  };
  return { ...actual, getContactProfile: vi.fn(async () => profile) };
});

async function buildApp(): Promise<Hono<AppEnv>> {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const { portalProfileRoutes } = await import("../src/routes/portal/profile");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  app.route("/portal", portalTasksRoutes);
  app.route("/portal", portalEditRoutes);
  app.route("/portal", portalProfileRoutes);
  return app;
}

describe("GET /portal/tasks -- inline file-download link is grounded (DEC-393 wave-35)", () => {
  it("carries its own chq-portal-file-link class token and a floored same-surface twin reaching the identical chain-latest content", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // DEC-996: the anchor is no longer classless -- reachable by an
    // instrument keyed on the element's own class.
    expect(html).toContain(
      `<a class="chq-portal-file-link" href="/portal/tasks/${ASSIGNMENT_ID}/file">slides-v2.pdf</a>`,
    );

    // The grounding twin: VersionHistory's current-version row renders on
    // the SAME page, after the inline link, with .chq-portal-version-link
    // pointing at the exact fileId resolveTaskFileChainLatest resolved
    // above -- i.e. the identical chain-latest content this inline link's
    // own /file route serves.
    const inlineIdx = html.indexOf("chq-portal-file-link");
    expect(inlineIdx).toBeGreaterThanOrEqual(0);
    const twinHref = `href="/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_V2_LATEST}"`;
    const twinIdx = html.indexOf(twinHref);
    expect(twinIdx, "expected the current-version .chq-portal-version-link row after the inline link").toBeGreaterThan(inlineIdx);
    expect(html).toContain(`class="chq-portal-version-link" ${twinHref}`);

    // The current-version row is flagged Current, next to the twin link --
    // confirms this IS the row grounding the inline link's content, not an
    // older version.
    const versionRowIdx = html.indexOf(twinHref);
    const afterVersionRow = html.slice(versionRowIdx, versionRowIdx + 400);
    expect(afterVersionRow).toContain("Current");
  });
});

describe("GET /portal/submissions/:id/edit -- Tracks checkboxes render inside the floored .chq-cfp-option wrapper (DEC-996 wave-35)", () => {
  it("renders every trackIds checkbox as the sole child of a label.chq-cfp-option", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();

    for (const track of [TRACK_1, TRACK_2, TRACK_3]) {
      const needle = `<label class="chq-cfp-option"><input type="checkbox" name="trackIds" value="${track.id}"`;
      expect(html, `expected ${track.name}'s checkbox wrapped in label.chq-cfp-option`).toContain(needle);
    }

    // Exactly 3 checkbox inputs, all inside a chq-cfp-option label -- and no
    // bare (unwrapped) trackIds checkbox anywhere in the response.
    const checkboxCount = (html.match(/<input type="checkbox" name="trackIds"/g) ?? []).length;
    expect(checkboxCount).toBe(3);
    const wrappedCount = (html.match(/<label class="chq-cfp-option"><input type="checkbox" name="trackIds"/g) ?? []).length;
    expect(wrappedCount).toBe(3);
  });
});
