import { describe, expect, it } from "vitest";
import { toCsv } from "../src/domain/csv";
import {
  isExportKind,
  EXPORT_KINDS,
  SUBMISSIONS_HEADER,
  AGENDA_HEADER,
  SHOWFLOW_HEADER,
  shapeSubmissionsExport,
  shapeAgendaExport,
  shapeShowflowExport,
  type SubmissionExportInput,
  type AgendaExportInput,
  type ShowflowExportInput,
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
      description: "An intro to the platform.",
      answers: {},
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
      description: "",
      answers: {},
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
    expect(table.header).toEqual([...SUBMISSIONS_HEADER, "description"]);
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
        "An intro to the platform.",
      ],
      [
        "SES-002",
        'A talk, with "quotes" and, a comma',
        "pending",
        "pending",
        "",
        "",
        "",
        "2026-01-16T10:00:00.000Z",
        "",
      ],
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
      description: "An intro to the platform.",
    });

    const csv = toCsv([table.header, ...table.rows]);
    expect(csv).toBe(
      [
        "ref,title,status,contentStatus,tracks,speakers,speakerEmails,createdAt,description",
        'SES-001,Intro to Chautauqua,accepted,approved,Keynote; Platform,Ada Lovelace; Alan Turing,ada@example.com; alan@example.com,2026-01-15T10:00:00.000Z,An intro to the platform.',
        'SES-002,"A talk, with ""quotes"" and, a comma",pending,pending,,,,2026-01-16T10:00:00.000Z,',
      ].join("\r\n"),
    );
  });

  it("handles zero rows", () => {
    const table = shapeSubmissionsExport([]);
    expect(table.header).toEqual([...SUBMISSIONS_HEADER, "description"]);
    expect(table.rows).toEqual([]);
    expect(table.records).toEqual([]);
  });

  it("appends dynamic custom-field columns, named by label, after the fixed prefix", () => {
    const withCustom = [
      {
        ...inputs[0]!,
        answers: { "field-abstract": "Abstract text here.", "field-level": "Advanced" },
      },
    ];
    const table = shapeSubmissionsExport(withCustom, [
      { fieldId: "field-abstract", label: "Abstract" },
      { fieldId: "field-level", label: "Level" },
    ]);
    expect(table.header).toEqual([...SUBMISSIONS_HEADER, "description", "Abstract", "Level"]);
    expect(table.rows[0]!.slice(-2)).toEqual(["Abstract text here.", "Advanced"]);
    expect(table.records[0]).toMatchObject({ Abstract: "Abstract text here.", Level: "Advanced" });
  });

  it("disambiguates a custom column whose label is empty, duplicated, or a fixed column name", () => {
    const table = shapeSubmissionsExport([{ ...inputs[0]!, answers: {} }], [
      { fieldId: "f1", label: "" },
      { fieldId: "f2", label: "Dup" },
      { fieldId: "f3", label: "Dup" },
      { fieldId: "f4", label: "title" },
    ]);
    expect(table.header).toEqual([
      ...SUBMISSIONS_HEADER,
      "description",
      " (f1)",
      "Dup (f2)",
      "Dup (f3)",
      "title (f4)",
    ]);
  });

  it("renders boolean and array custom-field answers like every other list column", () => {
    const table = shapeSubmissionsExport(
      [{ ...inputs[0]!, answers: { bool: true, boolFalse: false, arr: ["A", "B"], missing: undefined } }],
      [
        { fieldId: "bool", label: "Recorded" },
        { fieldId: "boolFalse", label: "Streamed" },
        { fieldId: "arr", label: "Topics" },
        { fieldId: "missing", label: "Unanswered" },
      ],
    );
    expect(table.rows[0]!.slice(-4)).toEqual(["true", "false", "A; B", ""]);
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
      seq: 10,
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
      seq: 5,
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

describe("shapeShowflowExport (DEC-055)", () => {
  it("has the DEC-055 fixed header", () => {
    expect(SHOWFLOW_HEADER).toEqual([
      "ref",
      "title",
      "description",
      "day",
      "start",
      "end",
      "room",
      "tracks",
      "speakers",
      "deck_file",
      "deck_url",
      "kind",
    ]);
  });

  it("orders scheduled rows by day, start, room and appends unscheduled accepted rows last (never dropped)", () => {
    const inputs: ShowflowExportInput[] = [
      {
        ref: "SES-003",
        title: "Unscheduled talk",
        description: "No slot yet",
        day: null,
        startMin: null,
        endMin: null,
        room: null,
        tracks: [],
        speakers: [],
        deckFile: "",
        deckUrl: "",
        seq: 3,
      },
      {
        ref: "SES-002",
        title: "Afternoon, room B",
        description: "Second day two",
        day: "2026-06-02",
        startMin: 570,
        endMin: 600,
        room: "Room B",
        tracks: ["Platform"],
        speakers: ["Ada Lovelace"],
        deckFile: "slides.pptx (v2)",
        deckUrl: "/files/f2",
        seq: 2,
      },
      {
        ref: "SES-001",
        title: "Morning, room A",
        description: "Day one",
        day: "2026-06-01",
        startMin: 540,
        endMin: 570,
        room: "Room A",
        tracks: ["Keynote"],
        speakers: ["Grace Hopper", "Alan Turing"],
        deckFile: "",
        deckUrl: "",
        seq: 1,
      },
      {
        ref: "SES-004",
        title: "Afternoon, room A",
        description: "Second day one, room A sorts before B",
        day: "2026-06-02",
        startMin: 570,
        endMin: 600,
        room: "Room A",
        tracks: [],
        speakers: [],
        deckFile: "",
        deckUrl: "",
        seq: 4,
      },
    ];

    const table = shapeShowflowExport(inputs);
    expect(table.header).toEqual([...SHOWFLOW_HEADER]);
    expect(table.rows.map((r) => r[0])).toEqual(["SES-001", "SES-004", "SES-002", "SES-003"]);

    // Speaker order preserved ('; '-joined in participant order).
    expect(table.rows[0]).toEqual([
      "SES-001",
      "Morning, room A",
      "Day one",
      "2026-06-01",
      "09:00",
      "09:30",
      "Room A",
      "Keynote",
      "Grace Hopper; Alan Turing",
      "",
      "",
      "session",
    ]);

    // Deck columns joined when present.
    expect(table.rows[2]).toEqual([
      "SES-002",
      "Afternoon, room B",
      "Second day two",
      "2026-06-02",
      "09:30",
      "10:00",
      "Room B",
      "Platform",
      "Ada Lovelace",
      "slides.pptx (v2)",
      "/files/f2",
      "session",
    ]);

    // Unscheduled row last, with empty schedule columns and empty deck columns.
    expect(table.rows[3]).toEqual([
      "SES-003",
      "Unscheduled talk",
      "No slot yet",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "session",
    ]);
  });

  it("handles zero rows", () => {
    const table = shapeShowflowExport([]);
    expect(table.header).toEqual([...SHOWFLOW_HEADER]);
    expect(table.rows).toEqual([]);
  });

  it("multiple unscheduled rows keep their given relative order (never dropped)", () => {
    const mk = (ref: string, seq: number): ShowflowExportInput => ({
      ref,
      title: ref,
      description: "",
      day: null,
      startMin: null,
      endMin: null,
      room: null,
      tracks: [],
      speakers: [],
      deckFile: "",
      deckUrl: "",
      seq,
    });
    const table = shapeShowflowExport([mk("SES-A", 1), mk("SES-B", 2)]);
    expect(table.rows.map((r) => r[0])).toEqual(["SES-A", "SES-B"]);
  });
});
