// DEC-777 (wave 4 amendment): the speaker's own submission-detail read view
// names who else is on the session, sourced from the SAME getPortalParticipants
// read edit.tsx uses (one call, never a per-participant query), with the
// viewer's own row excluded and a parenthesised role only when it isn't the
// plain "speaker" role. Absent entirely when there's nobody else.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { formatEventDate } from "../src/lib/event-time";
import type { EditableSubmissionData, PortalParticipant } from "../src/server/repo/portal-edit";

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
        showResources: true,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async (_db: unknown, id: string) =>
      id === "sub-mine"
        ? {
            id: "sub-mine",
            eventId: "evt-1",
            ref: "SES-004",
            title: "Mine",
            description: "desc",
            status: "pending",
            statusLabel: "Under review",
            submittedAt: 4,
            timezone: "UTC",
            answers: [],
            trackName: null,
            format: null,
            day: null,
            startMin: null,
            endMin: null,
            roomName: null,
          }
        : null,
    ),
  };
});

const getPortalParticipantsMock = vi.fn(async () => [] as unknown[]);

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>("../src/server/repo/portal-edit");
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async () => null),
    getPortalParticipants: getPortalParticipantsMock,
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

// Loaded dynamically (top-level await), AFTER getPortalParticipantsMock is
// initialized -- edit.tsx statically imports "../src/server/repo/portal-
// edit" (mocked above), and a static top-level import of EditPage here
// would pull that mocked module in during this file's own module
// instantiation, before getPortalParticipantsMock's const binding exists
// (TDZ). Everything else in this file already used a dynamic import for
// exactly this reason.
const { EditPage } = await import("../src/routes/portal/edit");
const { CO_PRESENTER_DUPLICATE_MESSAGE } = await import("../src/server/repo/portal-edit");

async function buildApp(auth: AuthInfo | undefined) {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  return app;
}

describe("EditPage co-presenter frame (DEC-604 wave-56 amendment)", () => {
  const DATA: EditableSubmissionData = {
    submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
    form: { id: "f1", closeDate: Date.UTC(2026, 7, 16), timezone: "America/Los_Angeles" },
    fields: [],
    answers: {},
    offeredTrackIds: [],
    allTracks: [],
    selectedTrackIds: [],
  };
  const branding = { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null };
  const participants: PortalParticipant[] = [
    { id: "p-1", contactId: "ct-2", name: "Dana Ito", email: "dana@example.com", role: "speaker", roleLabel: "Speaker", visible: false },
  ];

  function render(overrides: Partial<Parameters<typeof EditPage>[0]> = {}) {
    return EditPage({
      branding,
      submissionId: "s1",
      data: DATA,
      answers: {},
      selectedTrackIds: [],
      csrfToken: "tok",
      editable: true,
      tracksEditable: true,
      participants,
      speakerName: "Priya Raman",
      ...overrides,
    }).toString();
  }

  it("states the no-email fact verbatim, dropping the old passive wording", () => {
    const html = render();
    expect(html).toContain("No email goes to them — tell them yourself.");
    expect(html).not.toContain("They will not receive an email or invitation.");
  });

  it("keeps the per-row muted unpublished line unchanged", () => {
    const html = render();
    expect(html).toContain("Not yet on the public site. Your organiser publishes co-presenters.");
  });

  it("renders the window sub-line under the h1 when the form has a close date", () => {
    const html = render();
    expect(html).toContain("You can change this until the form closes on");
    expect(html).toContain(formatEventDate(DATA.form.closeDate!, DATA.form.timezone));
    expect(html).not.toContain("Edits are live on the public pages straight away");
  });

  it("omits the window sub-line entirely when the form has no close date, never synthesizing one", () => {
    const html = render({ data: { ...DATA, form: { ...DATA.form, closeDate: null } } });
    expect(html).not.toContain("You can change this until the form closes on");
  });

  it("renders the duplicate-rejection standard error shape: a banner, the field message, and the survives-reload sentence", () => {
    const html = render({
      participantErrors: { email: CO_PRESENTER_DUPLICATE_MESSAGE },
      participantValues: { firstName: "Dana", lastName: "Ito", email: "dana@example.com", role: "moderator" },
    });
    expect(html).toContain(CO_PRESENTER_DUPLICATE_MESSAGE);
    expect(html).toContain("Everything you typed is still below.");
    // participantValues round-trip through the re-rendered add-form.
    expect(html).toContain('value="Dana"');
    expect(html).toContain('value="Ito"');
    expect(html).toContain('value="dana@example.com"');
  });

  it("does not render the duplicate banner for an ordinary field-validation error", () => {
    const html = render({ participantErrors: { firstName: "First name is required" } });
    expect(html).not.toContain("Everything you typed is still below.");
  });
});

describe("EditPage co-presenter field-fill contract (DEC-604 wave-60 amendment)", () => {
  const DATA: EditableSubmissionData = {
    submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
    form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
    fields: [],
    answers: {},
    offeredTrackIds: [],
    allTracks: [],
    selectedTrackIds: [],
  };
  const branding = { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null };

  function render() {
    return EditPage({
      branding,
      submissionId: "s1",
      data: DATA,
      answers: {},
      selectedTrackIds: [],
      csrfToken: "tok",
      editable: true,
      tracksEditable: true,
      participants: [],
      speakerName: "Priya Raman",
    }).toString();
  }

  function findInputTag(html: string, id: string): string {
    const match = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    expect(match).not.toBeNull();
    return match![0];
  }

  it("puts the first name, last name and email co-presenter inputs on the shared .chq-input field-fill contract", () => {
    const html = render();
    expect(findInputTag(html, "cp-first-name")).toContain('class="chq-input"');
    expect(findInputTag(html, "cp-last-name")).toContain('class="chq-input"');
    expect(findInputTag(html, "cp-email")).toContain('class="chq-input"');
  });

  it("wraps each of those three inputs in a .chq-field div so they match the shared width rule's selector", () => {
    const html = render();
    // The wrapping div immediately preceding each labelled input must carry chq-field.
    expect(html).toMatch(/<div class="chq-field">\s*<label class="chq-portal-field-label" for="cp-first-name">/);
    expect(html).toMatch(/<div class="chq-field">\s*<label class="chq-portal-field-label" for="cp-last-name">/);
    expect(html).toMatch(/<div class="chq-field">\s*<label class="chq-portal-field-label" for="cp-email">/);
  });
});

describe("Co-presenter field-fill stylesheet rule (DEC-604 wave-60 amendment)", () => {
  it("the rule matching .chq-field .chq-input sets width, not merely max-width, so the co-presenter pair fills its 220px column", () => {
    const css = readFileSync(join(__dirname, "..", "src", "routes", "portal", "portal.css.ts"), "utf8");
    const match = css.match(/\.chq-field \.chq-input,[\s\S]*?\{([\s\S]*?)\}/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/(?<!max-)width:\s*100%/);
  });
});

describe("GET /portal/submissions/:id — co-presenter 'With' line (DEC-777 wave 4 amendment)", () => {
  it("renders a With line naming other participants, excluding the viewer's own row", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([
      { id: "p-1", contactId: "ct-1", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
      { id: "p-2", contactId: "ct-2", name: "Dana Ito", email: "dana@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
      { id: "p-3", contactId: "ct-3", name: "Sam Whitfield", email: "sam@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
    ]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("With Dana Ito, Sam Whitfield");
    expect(html).not.toContain("With Priya Raman");
  });

  it("suffixes a parenthesised role when it isn't the plain speaker role", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([
      { id: "p-1", contactId: "ct-1", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
      { id: "p-2", contactId: "ct-2", name: "Dana Ito", email: "dana@example.com", role: "moderator", roleLabel: "Moderator", visible: true },
    ]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).toContain("With Dana Ito (moderator)");
  });

  it("renders no line at all when the viewer is the only participant", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([
      { id: "p-1", contactId: "ct-1", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
    ]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).not.toContain("With ");
  });

  it("renders no line at all when getPortalParticipants returns nothing", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).not.toContain("With ");
  });
});
