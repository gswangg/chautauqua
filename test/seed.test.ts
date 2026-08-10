import { describe, expect, it } from "vitest";
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
