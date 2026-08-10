import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "../src/lib/zip";

function b(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}
function u32le(bytes: Uint8Array, offset: number): number {
  return (b(bytes, offset) | (b(bytes, offset + 1) << 8) | (b(bytes, offset + 2) << 16) | (b(bytes, offset + 3) << 24)) >>> 0;
}
function u16le(bytes: Uint8Array, offset: number): number {
  return b(bytes, offset) | (b(bytes, offset + 1) << 8);
}

const enc = new TextEncoder();

describe("crc32", () => {
  it("matches known test vectors", () => {
    expect(crc32(enc.encode(""))).toBe(0);
    expect(crc32(enc.encode("a"))).toBe(0xe8b7be43);
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("buildZip", () => {
  it("throws on empty entries", () => {
    expect(() => buildZip([])).toThrow();
  });

  it("throws on duplicate entry names", () => {
    expect(() =>
      buildZip([
        { name: "a.txt", data: enc.encode("one") },
        { name: "a.txt", data: enc.encode("two") },
      ]),
    ).toThrow();
  });

  it("produces a well-formed single-entry archive with correct magics and CRC", () => {
    const data = enc.encode("hello world");
    const zip = buildZip([{ name: "hello.txt", data }]);

    // Local file header magic PK\x03\x04 at offset 0
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const crcInHeader = u32le(zip, 14);
    expect(crcInHeader).toBe(crc32(data));
    const compSizeInHeader = u32le(zip, 18);
    const uncompSizeInHeader = u32le(zip, 22);
    expect(compSizeInHeader).toBe(data.length);
    expect(uncompSizeInHeader).toBe(data.length);
    const nameLen = u16le(zip, 26);
    expect(nameLen).toBe("hello.txt".length);

    // The local header + name + data is immediately followed by the central
    // directory header PK\x01\x02.
    const localHeaderLen = 30 + nameLen;
    const localRecordLen = localHeaderLen + data.length;
    const cdStart = localRecordLen;
    expect([zip[cdStart], zip[cdStart + 1], zip[cdStart + 2], zip[cdStart + 3]]).toEqual([0x50, 0x4b, 0x01, 0x02]);

    // EOCD magic PK\x05\x06 at the very end.
    const eocdStart = zip.length - 22;
    expect([zip[eocdStart], zip[eocdStart + 1], zip[eocdStart + 2], zip[eocdStart + 3]]).toEqual([
      0x50, 0x4b, 0x05, 0x06,
    ]);

    // EOCD reports 1 total entry, and central directory size/offset are
    // consistent with what we computed above.
    const totalEntries = u16le(zip, eocdStart + 10);
    expect(totalEntries).toBe(1);
    const cdSize = u32le(zip, eocdStart + 12);
    const cdOffset = u32le(zip, eocdStart + 16);
    expect(cdOffset).toBe(cdStart);
    expect(cdSize).toBe(eocdStart - cdStart);
  });

  it("lays out multiple entries with consistent offsets and reports the right entry count", () => {
    const entries = [
      { name: "dir/one.txt", data: enc.encode("first") },
      { name: "dir/two.txt", data: enc.encode("second file contents") },
      { name: "three.bin", data: new Uint8Array([1, 2, 3, 4, 5]) },
    ];
    const zip = buildZip(entries);

    // Walk the local records to find where the central directory starts.
    let offset = 0;
    for (const entry of entries) {
      expect([zip[offset], zip[offset + 1], zip[offset + 2], zip[offset + 3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      const crc = u32le(zip, offset + 14);
      expect(crc).toBe(crc32(entry.data));
      const nameLen = u16le(zip, offset + 26);
      const extraLen = u16le(zip, offset + 28);
      offset += 30 + nameLen + extraLen + entry.data.length;
    }

    expect([zip[offset], zip[offset + 1], zip[offset + 2], zip[offset + 3]]).toEqual([0x50, 0x4b, 0x01, 0x02]);

    const eocdStart = zip.length - 22;
    expect([zip[eocdStart], zip[eocdStart + 1], zip[eocdStart + 2], zip[eocdStart + 3]]).toEqual([
      0x50, 0x4b, 0x05, 0x06,
    ]);
    expect(u16le(zip, eocdStart + 10)).toBe(entries.length);
    expect(u32le(zip, eocdStart + 16)).toBe(offset);
  });
});
