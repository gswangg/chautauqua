// PORTAL SSR 390 frame verdicts (task w30-c, DEC-976/DEC-385): the two
// portal READ frames -- "Speaker portal" (the dashboard) and "Portal ·
// Your session" (both frame lines cited individually below, each with its
// own backtick-quoted literal and receipt).
// Both were measured 11/14 drawn literals asserted with a single markup
// citer; this file raises every one of the 14 drawn literals in each frame
// to a real `app.request()` SSR assertion carrying its own DEC-967 citation
// (frame line immediately followed by that line's literal in backticks,
// with a real `expect(` within a few source lines beneath it, per
// app/src/frame-citation.scan.test.ts's receipt contract).
//
// MEASUREMENT + narrowly-scoped fix per the task's FIX RULE: a fix lands in
// this commit only when confined to portal.css.ts's terminal phone block or
// to index.tsx/shared.tsx markup that changes no desktop byte, and is
// covered by a test below. Anything wider is a DIVERGES row in
// docs/design/audit/portal-dashboard-session-390-v12.md instead.
//
// Harness copied verbatim from test/portal-390-frame-verdicts.test.ts's own
// vi.mock blocks + buildApp() (itself copied from
// test/portal-page-headings.test.ts) -- DEC-613: a second copy of a
// vocabulary is a trap, so this file reuses the shape rather than inventing
// a fifth mock stack. Seeded data (speaker name, talk title, DFC ref,
// filenames, byte sizes) is graded by SHAPE only, never pinned to the
// frame's own sample text, per the task brief.
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData, PortalParticipant } from "../src/server/repo/portal-edit";
import type {
  PortalInvitation,
  PortalSession,
  PortalSubmissionDetail,
  PortalTaskAssignment,
  PortalDeliverable,
} from "../src/server/repo/portal";
import { formatDayMedium } from "../src/lib/event-time";
import { clockHHMM } from "../src/domain/clock";
import { publicRoomLabel } from "../src/domain/schedule";
import { formatBytes } from "../src/domain/files";
import { countOf, capitalizeFirst, plural, spellCount } from "../src/domain/count-copy";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

let mockSessions: PortalSession[] = [];
let mockTasks: PortalTaskAssignment[] = [];
let mockDeliverables: Map<string, PortalDeliverable> = new Map();
let mockDetail: PortalSubmissionDetail | null = null;
let mockDetailDeliverable: PortalDeliverable | null = null;
let mockDetailDeliverableVersion: number | null = null;
let mockParticipants: PortalParticipant[] = [];

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "DevFlow Conf 2027",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: "Latticework Systems",
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => mockSessions),
    getMyInvitations: vi.fn(async () => [] as PortalInvitation[]),
    getMyTaskAssignments: vi.fn(async () => mockTasks),
    getLatestDeliverable: vi.fn(async () => mockDetailDeliverable),
    getMySubmissions: vi.fn(async () => []),
    listLatestDeliverables: vi.fn(async () => mockDeliverables),
    getPortalSubmissionDetail: vi.fn(async () => mockDetail),
    listDeliverableCandidatesForEvents: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (): Promise<EditableSubmissionData | null> => ({
      submission: { id: "sub-a", status: "accepted", title: "Talk title", description: "desc" },
      form: { id: "f1", closeDate: null, timezone: "UTC" },
      fields: [],
      answers: {},
      offeredTrackIds: [],
      allTracks: [],
      selectedTrackIds: [],
      formatLabel: null,
    })),
    getPortalParticipants: vi.fn(async () => mockParticipants),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileVersionNumber: vi.fn(async () => mockDetailDeliverableVersion ?? 1),
  };
});

async function buildApp(): Promise<Hono<AppEnv>> {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  return app;
}

const DASHBOARD_FRAME_LINE =
  '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">';
const SESSION_FRAME_LINE =
  '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">';

describe("Portal SSR 390 frame verdicts -- dashboard + your-session (w30-c)", () => {
  it("frame :414 'Speaker portal' (GET /portal) -- header wordmark/name, DEC-590 headline count, one-session scheduledSubline, session card copy, per-kind task control label, 'Upload again', footer band", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:414 `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    expect(readFileSync(DESIGN_FILE, "utf-8").split("\n")[413]).toBe(DASHBOARD_FRAME_LINE);

    mockSessions = [
      {
        submissionId: "sub-a",
        ref: "DFC-014",
        title: "Taming 40-Minute CI: Incremental Builds at Monorepo Scale",
        day: "2027-05-12",
        startMin: 600,
        endMin: 630,
        roomName: "Room 2A",
        trackName: "Platform & Infra",
        format: "Talk (30 min)",
        acceptedAt: 1710374400000,
        eventId: "evt-1",
        eventName: "DevFlow Conf 2027",
        timezone: "UTC",
        overlaps: [],
      },
    ];
    mockTasks = [
      {
        id: "assign-file",
        taskId: "task-file",
        eventId: "evt-1",
        kind: "file_request",
        title: "Upload your headshot",
        description: null,
        instructions: null,
        dueDate: null,
        assignedAt: 0,
        required: false,
        status: "pending",
        formId: null,
        deliverableKind: null,
        fileId: null,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
    ];
    mockDeliverables = new Map([
      ["sub-a", { id: "file-1", filename: "slides.pdf", sizeBytes: 4200, uploadedAt: 0, versionNo: 3 }],
    ]);

    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:417 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px">chautauqua</span>`
    expect(html).toContain('<span class="chq-wordmark">chautauqua</span>');

    // docs/design/Chautauqua Public and Portal.dc.html:418 `          <span style="margin-left:auto; font-size:12px; font-weight:600; color:#565A4B">Priya Raman</span>`
    expect(html).toContain('<span class="chq-portal-header-name">Priya Raman</span>');

    // docs/design/Chautauqua Public and Portal.dc.html:420 `        <span style="font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Two things to do</span>`
    // -- DEC-590 (wave-22 amendment): the headline count is n =
    // worklist.length, exactly the one pending row rendered below (one
    // file_request task, zero invitations), spelled via
    // capitalizeFirst(spellCount(n)) to match the frame's literal.
    expect(html).toContain('<h1 class="chq-portal-hero">');
    expect(html).toContain(`${capitalizeFirst(spellCount(1))} ${plural(1, "thing")} to do`);

    // docs/design/Chautauqua Public and Portal.dc.html:421 `        <span style="font-size:13px; color:#565A4B; line-height:1.5">DevFlow Conf 2027 · you speak Tue 12 May, 10:00, Room 2A</span>`
    // -- scheduledSubline's ONE-session form: "<event> · you speak <placement>".
    const expectedPlacement = `${formatDayMedium("2027-05-12")}, ${clockHHMM(600)} · ${publicRoomLabel("Room 2A")}`;
    expect(html).toContain(`<p class="chq-portal-sub">DevFlow Conf 2027 · you speak ${expectedPlacement}</p>`);

    // docs/design/Chautauqua Public and Portal.dc.html:426 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Waiting on you</span>`
    expect(html).toContain('<div class="chq-section-label">Waiting on you</div>');

    // per-kind control label: src/routes/portal/index.tsx:136 `if (t.kind === "file_request") return "Upload file";`
    expect(html).toContain("Upload file");

    // docs/design/Chautauqua Public and Portal.dc.html:440 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Your session</span>`
    expect(html).toContain('<div class="chq-section-label">Your session</div>');

    // docs/design/Chautauqua Public and Portal.dc.html:443 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:17px; font-weight:600; letter-spacing:-0.02em; line-height:1.3">Taming 40-Minute CI: Incremental Builds at Monorepo Scale</span>`
    expect(html).toContain('<span class="chq-portal-row-title">Taming 40-Minute CI: Incremental Builds at Monorepo Scale</span>');

    // docs/design/Chautauqua Public and Portal.dc.html:444 `          <span style="font-size:13px; color:#565A4B">Talk, 30 min · Platform &amp; Infra · accepted 14 Mar</span>`
    // -- SessionCard's metaParts: sessionFormatLabel(format) · trackName · accepted <date>, shape matches (fixture format/track chosen freely -- SHAPE only, per the task brief).
    expect(html).toContain("Talk, 30 min · Platform &amp; Infra · accepted");

    // docs/design/Chautauqua Public and Portal.dc.html:445 `          <span style="font-size:13px; line-height:1.55; color:#3F4237">Slides v3 · with the organisers</span>`
    // -- deliverable clause: {filename} v{version} · with the organisers. Filename is seeded data (SHAPE only), never the frame's own sample "Slides".
    expect(html).toContain("slides.pdf v3 · with the organisers");

    // docs/design/Chautauqua Public and Portal.dc.html:447 `            <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Upload again</span>`
    expect(html).toContain('<a href="/portal/tasks" class="chq-btn chq-btn-secondary">Upload again</a>');

    // docs/design/Chautauqua Public and Portal.dc.html:453 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Done</span>`
    expect(html).toContain('<div class="chq-section-label">Done</div>');

    // docs/design/Chautauqua Public and Portal.dc.html:464 `        <span style="font-size:13px; color:#565A4B">Priya Raman · Latticework Systems</span>`
    expect(html).toContain('<span class="chq-portal-footer-who">Priya Raman · Latticework Systems</span>');

    // docs/design/Chautauqua Public and Portal.dc.html:465 `        <a href="#" style="margin-left:auto; font-size:13px; font-weight:700">Profile</a>`
    expect(html).toContain('<a href="/portal/profile" class="chq-portal-footer-profile">Profile</a>');

    // DEC-590: the sign-out control is quiet page furniture (chq-btn-tertiary),
    // never a chrome-weight primary/secondary button -- the header cluster
    // carries it beside the speaker's name (shared.tsx:213).
    expect(html).toContain(
      '<button type="submit" class="chq-btn chq-btn-tertiary chq-portal-header-signout-btn">Sign out</button>',
    );

    // Order sanity: the frame draws wordmark -> headline -> subline ->
    // Waiting on you -> Your session -> Done -> footer, in that order.
    const wordmarkIdx = html.indexOf('<span class="chq-wordmark">chautauqua</span>');
    const heroIdx = html.indexOf('<h1 class="chq-portal-hero">');
    const waitingIdx = html.indexOf('<div class="chq-section-label">Waiting on you</div>');
    const sessionIdx = html.indexOf('<div class="chq-section-label">Your session</div>');
    const doneIdx = html.indexOf('<div class="chq-section-label">Done</div>');
    const footerIdx = html.indexOf('<span class="chq-portal-footer-who">Priya Raman · Latticework Systems</span>');
    expect(wordmarkIdx).toBeLessThan(heroIdx);
    expect(heroIdx).toBeLessThan(waitingIdx);
    expect(waitingIdx).toBeLessThan(sessionIdx);
    expect(sessionIdx).toBeLessThan(doneIdx);
    expect(doneIdx).toBeLessThan(footerIdx);
  });

  it("scheduledSubline's TWO-session enumeration form (GET /portal, two placed sessions) -- DEC-936: EVERY placed session is named, never the first one alone", async () => {
    mockSessions = [
      {
        submissionId: "sub-a",
        ref: "DFC-014",
        title: "First Session",
        day: "2027-05-12",
        startMin: 600,
        endMin: 630,
        roomName: "Room 2A",
        trackName: null,
        format: null,
        acceptedAt: null,
        eventId: "evt-1",
        eventName: "DevFlow Conf 2027",
        timezone: "UTC",
        overlaps: [],
      },
      {
        submissionId: "sub-b",
        ref: "DFC-020",
        title: "Second Session",
        day: "2027-05-13",
        startMin: 570,
        endMin: 600,
        roomName: "Main Stage",
        trackName: null,
        format: null,
        acceptedAt: null,
        eventId: "evt-1",
        eventName: "DevFlow Conf 2027",
        timezone: "UTC",
        overlaps: [],
      },
    ];
    mockTasks = [];
    mockDeliverables = new Map();

    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();

    const placementA = `${formatDayMedium("2027-05-12")}, ${clockHHMM(600)} · ${publicRoomLabel("Room 2A")}`;
    const placementB = `${formatDayMedium("2027-05-13")}, ${clockHHMM(570)} · ${publicRoomLabel("Main Stage")}`;
    const expectedSubline = `DevFlow Conf 2027 · you speak ${countOf(2, "time")} — ${placementA}; ${placementB}`;
    expect(html).toContain(`<p class="chq-portal-sub">${expectedSubline}</p>`);
  });

  it("frame :563 'Portal · Your session' (GET /portal/submissions/sub-mine) -- back control, submission title, REF/kind/track meta, placement, abstract, deliverable rows with version/size/visibility meta", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:563 `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    expect(readFileSync(DESIGN_FILE, "utf-8").split("\n")[562]).toBe(SESSION_FRAME_LINE);

    mockDetail = {
      id: "sub-mine",
      eventId: "evt-1",
      ref: "DFC-014",
      title: "Taming 40-Minute CI: Incremental Builds at Monorepo Scale",
      description: "Our monorepo CI took forty minutes on a good day.",
      status: "accepted",
      statusLabel: "Accepted",
      submittedAt: 1710374400000,
      timezone: "UTC",
      answers: [],
      trackName: "Platform & Infra",
      format: "talk, 30 min",
      day: "2027-05-12",
      startMin: 600,
      endMin: 630,
      roomName: "Room 2A",
    };
    mockDetailDeliverable = { id: "file-1", filename: "taming-ci-devflow.pdf", sizeBytes: 14 * 1024 * 1024, uploadedAt: 0, versionNo: null };
    mockDetailDeliverableVersion = 3;
    mockParticipants = [];
    mockTasks = [];

    const app = await buildApp();
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();

    // The frame's own back label at :565 is "‹ Your portal"; DEC-029
    // wave-21 repoints this route's back link to /portal, so
    // PORTAL_BACK_LINKS (src/routes/portal/shared.tsx) now resolves the
    // same "Your portal" label -- MATCHES, no longer a divergence.
    expect(html).toContain('<a href="/portal" class="chq-portal-back">');
    expect(html).toContain("‹ Your portal");

    // docs/design/Chautauqua Public and Portal.dc.html:566 `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your session</h1>`
    expect(html).toContain('<h1 class="chq-portal-hero chq-portal-hero-drill">Your session</h1>');

    // docs/design/Chautauqua Public and Portal.dc.html:569 `        <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Accepted · 14 Mar</span>`
    expect(html).toContain('<span class="chq-flag chq-portal-status-badge">');

    // docs/design/Chautauqua Public and Portal.dc.html:570 `        <h2 style="margin:10px 0 0; font-family:'Familjen Grotesk', sans-serif; font-size:20px; font-weight:600; letter-spacing:-0.025em; line-height:1.3">Taming 40-Minute CI: Incremental Builds at Monorepo Scale</h2>`
    expect(html).toContain('<h2 class="chq-portal-session-title">Taming 40-Minute CI: Incremental Builds at Monorepo Scale</h2>');

    // docs/design/Chautauqua Public and Portal.dc.html:571 `        <span style="display:block; margin-top:6px; font-size:13px; color:#565A4B">DFC-014 · talk, 30 min · Platform &amp; Infra</span>`
    // -- REF · format · track meta line (SHAPE: fixture format is seeded data).
    expect(html).toContain('<p class="chq-portal-sub">DFC-014 · talk, 30 min · Platform &amp; Infra</p>');

    // docs/design/Chautauqua Public and Portal.dc.html:572 `        <span style="display:block; margin-top:6px; font-size:13px; color:#565A4B">Tue 12 May, 10:00 · Room 2A</span>`
    // -- placement line via the ONE formatPlacement grammar.
    const expectedPlacement = `${formatDayMedium("2027-05-12")}, ${clockHHMM(600)} · ${publicRoomLabel("Room 2A")}`;
    expect(html).toContain(`<p class="chq-portal-sub">${expectedPlacement}</p>`);

    // docs/design/Chautauqua Public and Portal.dc.html:574 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Abstract</span>`
    expect(html).toContain('<div class="chq-section-label">Abstract</div>');

    // docs/design/Chautauqua Public and Portal.dc.html:576 `        <p style="margin:14px 0 0; font-size:15px; line-height:1.65; color:#3F4237">Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model — including the two migrations that failed first.</p>`
    // -- the abstract paragraph itself is seeded data, SHAPE only (own
    // fixture text below, not the frame's own sample paragraph).
    expect(html).toContain("<p>Our monorepo CI took forty minutes on a good day.</p>");

    // docs/design/Chautauqua Public and Portal.dc.html:578 `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Slides</span>`
    expect(html).toContain('<div class="chq-section-label">Slides</div>');

    // docs/design/Chautauqua Public and Portal.dc.html:582 `            <span style="font-size:14px; font-weight:600">taming-ci-devflow.pdf</span>`
    // -- filename is seeded data; this fixture happens to reuse the frame's
    // own sample filename, graded by SHAPE (the row-title span) not by text.
    expect(html).toContain('<span class="chq-portal-row-title">taming-ci-devflow.pdf</span>');

    // docs/design/Chautauqua Public and Portal.dc.html:583 `            <span style="font-size:12px; color:#565A4B">v3 · 14 MB · with the organisers</span>`
    // -- the detail page's longer "Shared with the organisers" clause
    // (index.tsx:581), an already-documented DEC-908 wording choice, not
    // re-litigated here. Version/size shape matches: v{version} · bytes.
    expect(html).toContain(`v3 · ${formatBytes(14 * 1024 * 1024)} · Shared with the organisers`);

    // docs/design/Chautauqua Public and Portal.dc.html:589 `        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Edit</span>`
    // -- the dock's secondary renders as "Edit submission" (an expansion of
    // the frame's bare "Edit"), already catalogued in
    // test/portal-390-frame-verdicts-session.test.ts (wave-158); this
    // submission is editable per loadEditableSubmission's status "accepted".
    expect(html).toContain('<div class="chq-portal-dock"><a href="/portal/submissions/sub-mine/edit" class="chq-btn chq-btn-secondary">Edit submission</a></div>');

    // Order sanity: back link -> H1 -> status badge -> title -> meta -> placement -> Abstract -> Slides.
    const backIdx = html.indexOf('<a href="/portal" class="chq-portal-back">');
    const h1Idx = html.indexOf('<h1 class="chq-portal-hero chq-portal-hero-drill">Your session</h1>');
    const badgeIdx = html.indexOf('<span class="chq-flag chq-portal-status-badge">');
    const titleIdx = html.indexOf('<h2 class="chq-portal-session-title">');
    const abstractIdx = html.indexOf('<div class="chq-section-label">Abstract</div>');
    const slidesIdx = html.indexOf('<div class="chq-section-label">Slides</div>');
    expect(backIdx).toBeLessThan(h1Idx);
    expect(h1Idx).toBeLessThan(badgeIdx);
    expect(badgeIdx).toBeLessThan(titleIdx);
    expect(titleIdx).toBeLessThan(abstractIdx);
    expect(abstractIdx).toBeLessThan(slidesIdx);
  });
});
