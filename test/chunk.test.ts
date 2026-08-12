/// <reference types="vite/client" />
// Canonical chunking helper (DEC-078) unit tests.
import { describe, expect, it } from "vitest";
import { chunkIds, ID_CHUNK_SIZE, chunkRowsForInsert, MAX_D1_BOUND_PARAMS } from "../src/lib/chunk";

describe("ID_CHUNK_SIZE (DEC-078)", () => {
  it("is 90", () => {
    expect(ID_CHUNK_SIZE).toBe(90);
  });
});

describe("chunkIds", () => {
  it("returns an empty array for 0 ids", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("returns a single batch of exactly the chunk size for 90 ids", () => {
    const ids = Array.from({ length: 90 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.length).toBe(1);
    expect(batches[0]!.length).toBe(90);
    expect(batches.flat()).toEqual(ids);
  });

  it("splits into two batches for 91 ids, preserving order and every id", () => {
    const ids = Array.from({ length: 91 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.length).toBe(2);
    expect(batches[0]!.length).toBe(90);
    expect(batches[1]!.length).toBe(1);
    expect(batches.flat()).toEqual(ids);
  });

  it("splits 250 ids into three batches (90/90/70) preserving order and every id", () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.length).toBe(3);
    expect(batches[0]!.length).toBe(90);
    expect(batches[1]!.length).toBe(90);
    expect(batches[2]!.length).toBe(70);
    expect(batches.flat()).toEqual(ids);
  });
});

describe("chunkRowsForInsert (DEC-528)", () => {
  it("returns an empty array for 0 rows", () => {
    expect(chunkRowsForInsert([])).toEqual([]);
  });

  it("derives columns-per-row and never exceeds the bound-parameter budget per chunk", () => {
    // 8-column rows (mirrors agenda.ts's scheduleSlot insert).
    const rows = Array.from({ length: 250 }, (_, i) => ({
      id: `id-${i}`,
      submissionId: `sub-${i}`,
      roomId: `room-${i}`,
      day: "2026-01-01",
      startMin: 0,
      endMin: 30,
      createdAt: 1,
      updatedAt: 1,
    }));
    const chunks = chunkRowsForInsert(rows);
    expect(chunks.flat()).toEqual(rows);
    for (const chunk of chunks) {
      expect(chunk.length * 8).toBeLessThanOrEqual(MAX_D1_BOUND_PARAMS);
    }
    // Sanity: more than one chunk was actually produced.
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("derives a different (larger) rows-per-chunk for narrower rows", () => {
    // 2-column rows should pack many more per chunk than 8-column rows.
    const rows = Array.from({ length: 250 }, (_, i) => ({ a: i, b: i }));
    const chunks = chunkRowsForInsert(rows);
    expect(chunks.flat()).toEqual(rows);
    for (const chunk of chunks) {
      expect(chunk.length * 2).toBeLessThanOrEqual(MAX_D1_BOUND_PARAMS);
    }
    // 8-column rows pack floor(90/8)=11 per chunk; 2-column rows pack
    // floor(90/2)=45 per chunk — narrower rows fit more per chunk.
    expect(chunks[0]!.length).toBe(45);
    expect(chunks[0]!.length).toBeGreaterThan(11);
  });

  it("throws on a ragged batch instead of silently mis-sizing the chunk", () => {
    const rows = [{ a: 1, b: 2 }, { a: 1 } as unknown as { a: number; b: number }];
    expect(() => chunkRowsForInsert(rows)).toThrow(/ragged/);
  });

  it("emits a single batch when rows fit within one chunk", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ a: i, b: i, c: i }));
    const chunks = chunkRowsForInsert(rows);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toEqual(rows);
  });
});
