import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";
import {
  additionalSubmissionStatuses,
  deleteAllStmt,
  insertStmt,
  minimalPdfBytes,
  onePixelPngBytes,
  seedId,
  sqlQuote,
} from "../scripts/seed-lib";

describe("sqlQuote", () => {
  it("quotes plain strings", () => {
    expect(sqlQuote("hello")).toBe("'hello'");
  });

  it("escapes single quotes by doubling", () => {
    expect(sqlQuote("O'Brien's talk")).toBe("'O''Brien''s talk'");
  });

  it("passes numbers through unquoted", () => {
    expect(sqlQuote(42)).toBe("42");
    expect(sqlQuote(0)).toBe("0");
  });

  it("rejects non-finite numbers", () => {
    expect(() => sqlQuote(Number.NaN)).toThrow();
    expect(() => sqlQuote(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("renders booleans as 0/1 integers", () => {
    expect(sqlQuote(true)).toBe("1");
    expect(sqlQuote(false)).toBe("0");
  });

  it("renders null/undefined as SQL NULL", () => {
    expect(sqlQuote(null)).toBe("NULL");
    expect(sqlQuote(undefined)).toBe("NULL");
  });
});

describe("insertStmt", () => {
  it("builds an INSERT with columns in row-key order", () => {
    const stmt = insertStmt("track", { id: "t1", event_id: "e1", name: "AI", position: 0 });
    expect(stmt).toBe('INSERT INTO track ("id", "event_id", "name", "position") VALUES (\'t1\', \'e1\', \'AI\', 0);');
  });

  it("throws on an empty row", () => {
    expect(() => insertStmt("track", {})).toThrow();
  });
});

describe("deleteAllStmt", () => {
  it("builds a DELETE FROM statement", () => {
    expect(deleteAllStmt("submission")).toBe("DELETE FROM submission;");
  });
});

describe("seedId", () => {
  it("zero-pads deterministic ids", () => {
    expect(seedId("submission", 4)).toBe("seed_submission_0004");
    expect(seedId("org", 1)).toBe("seed_org_0001");
  });

  it("rejects negative or non-integer n", () => {
    expect(() => seedId("x", -1)).toThrow();
    expect(() => seedId("x", 1.5)).toThrow();
  });
});

describe("additionalSubmissionStatuses", () => {
  it("returns 27 statuses matching the ~18/4/5/1/2 distribution (incl. 3 fixture pending)", () => {
    const statuses = additionalSubmissionStatuses(27);
    expect(statuses).toHaveLength(27);
    const counts: Record<string, number> = {};
    for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
    expect(counts["pending"]).toBe(15);
    expect(counts["accept_queue"]).toBe(4);
    expect(counts["accepted"]).toBe(5);
    expect(counts["decline_queue"]).toBe(1);
    expect(counts["declined"]).toBe(2);
    // Plus the 3 fixture submissions (all pending) totals 18 pending / 30 overall.
    expect((counts["pending"] ?? 0) + 3).toBe(18);
  });

  it("only uses DEC-003 submission status literals", () => {
    const allowed = new Set(["pending", "accept_queue", "decline_queue", "accepted", "declined"]);
    for (const s of additionalSubmissionStatuses(27)) {
      expect(allowed.has(s)).toBe(true);
    }
  });

  it("throws if count does not match the fixed distribution total", () => {
    expect(() => additionalSubmissionStatuses(10)).toThrow();
  });
});

describe("minimalPdfBytes", () => {
  it("produces a well-formed single-page PDF", () => {
    const bytes = minimalPdfBytes();
    const text = Buffer.from(bytes).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("/Type /Page");
    expect(text).toContain("/Count 1");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("is deterministic across calls", () => {
    expect(minimalPdfBytes()).toEqual(minimalPdfBytes());
  });
});

describe("onePixelPngBytes", () => {
  it("has a valid PNG signature", () => {
    const bytes = onePixelPngBytes();
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("declares a 1x1 image in IHDR", () => {
    const buf = Buffer.from(onePixelPngBytes());
    // IHDR data starts at byte 16 (8 sig + 4 length + 4 type).
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(1);
    expect(height).toBe(1);
  });

  it("has an IDAT chunk whose zlib 'stored' block unwraps to a valid 1-pixel raw scanline", () => {
    const buf = Buffer.from(onePixelPngBytes());
    const idatTypeOffset = buf.indexOf("IDAT");
    const idatLen = buf.readUInt32BE(idatTypeOffset - 4);
    const idatData = buf.subarray(idatTypeOffset + 4, idatTypeOffset + 4 + idatLen);
    // zlib header (2 bytes) + stored-block header (1 byte, BFINAL=1/BTYPE=00)
    // + LEN/NLEN (4 bytes) + raw data + Adler-32 (4 bytes).
    expect(idatData[0]).toBe(0x78); // zlib CMF
    expect(idatData[2]).toBe(0x01); // BFINAL=1, BTYPE=00 (stored, uncompressed)
    const len = idatData.readUInt16LE(3);
    const nlen = idatData.readUInt16LE(5);
    expect(nlen).toBe(len ^ 0xffff);
    const raw = idatData.subarray(7, 7 + len);
    // 1 filter-type byte + 3 RGB bytes for the single black pixel.
    expect(Array.from(raw)).toEqual([0, 0, 0, 0]);
  });

  it("is deterministic across calls", () => {
    expect(onePixelPngBytes()).toEqual(onePixelPngBytes());
  });
});

// ---------------------------------------------------------------------------
// Task w1-d / DEC-145: seed enrichment so every grader/eval flow is
// exercisable at 'now'. Runs the actual seed.ts script (tsx subprocess,
// same as `npm run seed`'s first step) and inspects the generated .seed.sql
// output, rather than re-deriving expectations independently — this way the
// test fails if the real script output ever regresses.
// ---------------------------------------------------------------------------
describe("seed.ts output (task w1-d, DEC-145)", () => {
  const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(SCRIPT_DIR, "..");
  const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

  let sql: string;

  beforeAll(() => {
    execFileSync("npx", ["tsx", "scripts/seed.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
    expect(existsSync(OUTPUT_PATH)).toBe(true);
    sql = readFileSync(OUTPUT_PATH, "utf-8");
  }, 60_000);

  it("opens the evaluation plan window at 2026-01-01T00:00:00Z (spans 2026-08-10) without touching close_date", () => {
    const match = sql.match(/INSERT INTO evaluation_plan \([^)]*\) VALUES \(([^;]*)\);/);
    expect(match).toBeTruthy();
    const values = match![1]!;
    // open_date is the 5th value (id, event_id, name, instructions, open_date, ...).
    expect(values).toContain(`${Date.UTC(2026, 0, 1)}`);
    // close_date must remain the pre-existing 2027-05-20 23:59 UTC value.
    expect(values).toContain(`${Date.UTC(2027, 4, 20, 23, 59, 0)}`);
    expect(Date.UTC(2026, 0, 1)).toBeLessThanOrEqual(Date.now());
  });

  it("gives the demo speaker (sbek-speaker@example.com, seed_contact_0001) an accepted submission with a visible participant row", () => {
    expect(sql).toContain(
      "INSERT INTO contact (\"id\", \"org_id\", \"first_name\", \"last_name\", \"email\"",
    );
    expect(sql).toMatch(
      /INSERT INTO submission \([^)]*\) VALUES \('seed_submission_0001', [^;]*'accepted'/,
    );
    expect(sql).toMatch(
      /INSERT INTO participant \([^)]*\) VALUES \('seed_participant_0001', 'seed_submission_0001', 'seed_contact_0001', 'speaker', 0, 1, 'accepted'/,
    );
  });

  it("assigns the demo speaker's contact at least 2 task_assignment rows, including a 'form'-kind and a 'file_request'-kind task, due in 2026-2027", () => {
    const taskAssignmentRows = [
      ...sql.matchAll(
        /INSERT INTO task_assignment \([^)]*\) VALUES \('[^']*', '([^']*)', 'seed_contact_0001', '[^']*', ([^,]*), [^,]*, (\d+), \d+\);/g,
      ),
    ];
    expect(taskAssignmentRows.length).toBeGreaterThanOrEqual(2);

    const taskIds = new Set(taskAssignmentRows.map((r) => r[1]));
    const taskRows = [...sql.matchAll(/INSERT INTO task \([^)]*\) VALUES \(('seed_task_\d+'), '[^']*', '([^']*)', '[^']*', [^,]*, (\d+),/g)];
    const kindByTaskId = new Map(taskRows.map((r) => [r[1]!.replace(/'/g, ""), r[2]!]));
    const dueDateByTaskId = new Map(taskRows.map((r) => [r[1]!.replace(/'/g, ""), Number(r[3])]));

    const kindsAssigned = new Set([...taskIds].map((id) => kindByTaskId.get(id!)));
    expect(kindsAssigned.has("form")).toBe(true);
    expect(kindsAssigned.has("file_request")).toBe(true);

    for (const id of taskIds) {
      const due = dueDateByTaskId.get(id!)!;
      const year = new Date(due).getUTCFullYear();
      expect(year).toBeGreaterThanOrEqual(2026);
      expect(year).toBeLessThanOrEqual(2027);
    }
  });

  it("chains a second deliverable version via previous_file_id and threads a file_comment (organizer note + speaker reply)", () => {
    const v1 = sql.match(/INSERT INTO file \([^)]*\) VALUES \('(seed_file_\d+)', 'seed_submission_0001', 'presentation', 'slides-v1\.pdf'[^;]*NULL, 'seed_contact_0001'/);
    expect(v1).toBeTruthy();
    const v1Id = v1![1]!;
    const v2 = sql.match(new RegExp(`INSERT INTO file \\([^)]*\\) VALUES \\('(seed_file_\\d+)', 'seed_submission_0001', 'presentation', 'slides-v2\\.pdf'[^;]*'${v1Id}', 'seed_contact_0001'`));
    expect(v2).toBeTruthy();
    const v2Id = v2![1]!;

    const comments = [...sql.matchAll(new RegExp(`INSERT INTO file_comment \\([^)]*\\) VALUES \\('[^']*', '${v2Id}', ([^,]*), ([^,]*),`, "g"))];
    expect(comments.length).toBeGreaterThanOrEqual(2);
    const organizerComment = comments.find((c) => c[1] === "NULL" && c[2] !== "NULL");
    const speakerComment = comments.find((c) => c[1] !== "NULL" && c[2] === "NULL");
    expect(organizerComment).toBeTruthy();
    expect(speakerComment).toBeTruthy();
  });

  it("registers the deliverable's two R2 assets against the real docs/fixtures/slides.pdf fixture", () => {
    const manifestPath = join(REPO_ROOT, ".seed-assets", "manifest.json");
    const manifest: Array<{ r2Key: string; path: string; contentType: string }> = JSON.parse(
      readFileSync(manifestPath, "utf-8"),
    );
    const slidesEntries = manifest.filter((m) => m.r2Key.includes("slides-v"));
    expect(slidesEntries.length).toBe(2);
    for (const entry of slidesEntries) {
      expect(entry.path).toBe(join(REPO_ROOT, "docs", "fixtures", "slides.pdf"));
      expect(existsSync(entry.path)).toBe(true);
    }
  });

  it("sets headshot_url on at least 3 contacts, backed by the real docs/fixtures/headshot.png fixture", () => {
    const updates = [...sql.matchAll(/UPDATE contact SET "headshot_url" = '([^']*)' WHERE "id" = '([^']*)';/g)];
    expect(updates.length).toBeGreaterThanOrEqual(3);

    const manifestPath = join(REPO_ROOT, ".seed-assets", "manifest.json");
    const manifest: Array<{ r2Key: string; path: string; contentType: string }> = JSON.parse(
      readFileSync(manifestPath, "utf-8"),
    );
    const headshotEntries = manifest.filter((m) => m.r2Key.startsWith("headshot/"));
    expect(headshotEntries.length).toBeGreaterThanOrEqual(3);
    for (const entry of headshotEntries) {
      expect(entry.path).toBe(join(REPO_ROOT, "docs", "fixtures", "headshot.png"));
    }
  });

  it("preserves the near-duplicate contacts: two Priya Raman + two Marcus Okafor rows, same name+company, different emails", () => {
    const priyaRows = [
      ...sql.matchAll(/INSERT INTO contact \([^)]*\) VALUES \('([^']*)', 'seed_org_0001', 'Priya', 'Raman', '([^']*)', NULL, 'Latticework Systems'/g),
    ];
    expect(priyaRows.length).toBeGreaterThanOrEqual(2);
    const priyaEmails = new Set(priyaRows.map((r) => r[2]));
    expect(priyaEmails.size).toBeGreaterThanOrEqual(2);

    const marcusRows = [
      ...sql.matchAll(/INSERT INTO contact \([^)]*\) VALUES \('([^']*)', 'seed_org_0001', 'Marcus', 'Okafor', '([^']*)', NULL, 'Cloudreach Labs'/g),
    ];
    expect(marcusRows.length).toBeGreaterThanOrEqual(2);
    const marcusEmails = new Set(marcusRows.map((r) => r[2]));
    expect(marcusEmails.size).toBeGreaterThanOrEqual(2);
  });
});
