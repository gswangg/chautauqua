/// <reference types="vite/client" />
// Canonical chunking helper (DEC-078) unit tests.
import { describe, expect, it } from "vitest";
import { chunkIds, ID_CHUNK_SIZE } from "../src/lib/chunk";

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
