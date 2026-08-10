import { describe, expect, it } from "vitest";
import { toCsv } from "../src/lib/csv";
import {
  isExportKind,
  EXPORT_KINDS,
  SUBMISSIONS_HEADER,
  AGENDA_HEADER,
  shapeSubmissionsExport,
  shapeAgendaExport,
  minutesToClock,
  type SubmissionExportInput,
  type AgendaExportInput,
} from "../src/server/repo/exports";

describe("isExportKind", () => {
  it("accepts the 5 DEC-027 kinds", () => {
    for (const k of EXPORT_KINDS) expect(isExportKind(k)).toBe(true);
  });

  it("rejects unknown kinds", () => {
    expect(isExportKind("sponsors")).toBe(false);
    expect(isExportKind("")).toBe(false);
    expect(isExportKind(undefined)).toBe(false);
  });
});

describe("minutesToClock", () => {
  it("formats minutes-from-midnight as zero-padded HH:MM", () => {
    expect(minutesToClock(0)).toBe("00:00");
    expect(minutesToClock(9 * 60)).toBe("09:00");
    expect(minutesToClock(9 * 60 + 5)).toBe("09:05");
    expect(minutesToClock(23 * 60 + 59)).toBe("23:59");
  });
});

describe("shapeSubmissionsExport — CSV column snapshot", () => {
  const inputs: SubmissionExportInput[] = [
    {
      ref: "SES-001",
      title: "Intro to Chautauqua",
      status: "accepted",
      contentStatus: "approved",
      tracks: ["Keynote", "Platform"],
      speakers: ["Ada Lovelace", "Alan Turing"],
      speakerEmails: ["ada@example.com", "alan@example.com"],
      createdAt: "2026-01-15T10:00:00.000Z",
    },
    {
      ref: "SES-002",
      title: 'A talk, with "quotes" and, a comma',
      status: "pending",
      contentStatus: "pending",
      tracks: [],
      speakers: [],
      speakerEmails: [],
      createdAt: "2026-01-16T10:00:00.000Z",
    },
  ];

  it("has the DEC-027 fixed header", () => {
    expect(SUBMISSIONS_HEADER).toEqual([
      "ref",
      "title",
      "status",
      "contentStatus",
      "tracks",
      "speakers",
      "speakerEmails",
      "createdAt",
    ]);
  });

  it("produces matching header/rows/records and a stable CSV snapshot", () => {
    const table = shapeSubmissionsExport(inputs);
    expect(table.header).toEqual([...SUBMISSIONS_HEADER]);
    expect(table.rows).toEqual([
      [
        "SES-001",
        "Intro to Chautauqua",
        "accepted",
        "approved",
        "Keynote; Platform",
        "Ada Lovelace; Alan Turing",
        "ada@example.com; alan@example.com",
        "2026-01-15T10:00:00.000Z",
      ],
      ["SES-002", 'A talk, with "quotes" and, a comma', "pending", "pending", "", "", "", "2026-01-16T10:00:00.000Z"],
    ]);
    expect(table.records[0]).toEqual({
      ref: "SES-001",
      title: "Intro to Chautauqua",
      status: "accepted",
      contentStatus: "approved",
      tracks: "Keynote; Platform",
      speakers: "Ada Lovelace; Alan Turing",
      speakerEmails: "ada@example.com; alan@example.com",
      createdAt: "2026-01-15T10:00:00.000Z",
    });

    const csv = toCsv([table.header, ...table.rows]);
    expect(csv).toBe(
      [
        "ref,title,status,contentStatus,tracks,speakers,speakerEmails,createdAt",
        'SES-001,Intro to Chautauqua,accepted,approved,Keynote; Platform,Ada Lovelace; Alan Turing,ada@example.com; alan@example.com,2026-01-15T10:00:00.000Z',
        'SES-002,"A talk, with ""quotes"" and, a comma",pending,pending,,,,2026-01-16T10:00:00.000Z',
      ].join("\r\n"),
    );
  });

  it("handles zero rows", () => {
    const table = shapeSubmissionsExport([]);
    expect(table.header).toEqual([...SUBMISSIONS_HEADER]);
    expect(table.rows).toEqual([]);
    expect(table.records).toEqual([]);
  });
});

describe("shapeAgendaExport — CSV column snapshot", () => {
  const inputs: AgendaExportInput[] = [
    {
      day: "2026-06-02",
      startMin: 570,
      endMin: 600,
      room: "Ballroom A",
      ref: "SES-010",
      title: "Afternoon talk",
      speakers: ["Grace Hopper"],
      tracks: ["Platform"],
    },
    {
      day: "2026-06-01",
      startMin: 540,
      endMin: 570,
      room: null,
      ref: "SES-005",
      title: "Morning talk",
      speakers: [],
      tracks: [],
    },
  ];

  it("has the DEC-027 fixed header", () => {
    expect(AGENDA_HEADER).toEqual(["day", "start", "end", "room", "ref", "title", "speakers", "tracks"]);
  });

  it("sorts by day then start time and formats HH:MM, with a stable CSV snapshot", () => {
    const table = shapeAgendaExport(inputs);
    expect(table.header).toEqual([...AGENDA_HEADER]);
    expect(table.rows).toEqual([
      ["2026-06-01", "09:00", "09:30", "", "SES-005", "Morning talk", "", ""],
      ["2026-06-02", "09:30", "10:00", "Ballroom A", "SES-010", "Afternoon talk", "Grace Hopper", "Platform"],
    ]);

    const csv = toCsv([table.header, ...table.rows]);
    expect(csv).toBe(
      [
        "day,start,end,room,ref,title,speakers,tracks",
        "2026-06-01,09:00,09:30,,SES-005,Morning talk,,",
        "2026-06-02,09:30,10:00,Ballroom A,SES-010,Afternoon talk,Grace Hopper,Platform",
      ].join("\r\n"),
    );
  });

  it("handles zero rows (unscheduled event)", () => {
    const table = shapeAgendaExport([]);
    expect(table.rows).toEqual([]);
  });
});
