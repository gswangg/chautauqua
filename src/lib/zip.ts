// Pure-core STORE-only ZIP builder (DEC-002: no node:/cloudflare imports,
// Uint8Array in/out; DEC-160). Implements just enough of the ZIP format to
// produce a valid, uncompressed archive: local file headers, a CRC-32 per
// entry, a central directory, and an end-of-central-directory record.
//
// Fail loudly: throws on empty input or duplicate entry names rather than
// silently deduping or producing an empty/ambiguous archive.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// CRC-32 (table-based, standard polynomial 0xEDB88320)
// ---------------------------------------------------------------------------

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

export function crc32(data: Uint8Array): number {
  const table = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    const entry = table[(crc ^ byte) & 0xff] ?? 0;
    crc = entry ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Little-endian byte writers
// ---------------------------------------------------------------------------

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;

  push(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  u16(value: number): void {
    const b = new Uint8Array(2);
    b[0] = value & 0xff;
    b[1] = (value >>> 8) & 0xff;
    this.push(b);
  }

  u32(value: number): void {
    const b = new Uint8Array(4);
    b[0] = value & 0xff;
    b[1] = (value >>> 8) & 0xff;
    b[2] = (value >>> 16) & 0xff;
    b[3] = (value >>> 24) & 0xff;
    this.push(b);
  }

  bytes(value: Uint8Array): void {
    this.push(value);
  }

  currentLength(): number {
    return this.length;
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

const utf8 = new TextEncoder();

// DOS date/time fixed at the epoch of the DOS format (1980-01-01 00:00:00)
// — STORE-only archives don't need real per-entry timestamps for this
// stage-1 use case (bulk download), and a fixed value keeps buildZip pure
// (no Date.now() nondeterminism to test against).
const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01

/**
 * Builds an uncompressed (STORE method) ZIP archive from `entries`.
 * Throws if `entries` is empty or contains duplicate `name`s (fail loudly —
 * no silent dedup, no empty/ambiguous archive).
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length === 0) {
    throw new Error("buildZip: entries must not be empty");
  }
  const seenNames = new Set<string>();
  for (const entry of entries) {
    if (seenNames.has(entry.name)) {
      throw new Error(`buildZip: duplicate entry name '${entry.name}'`);
    }
    seenNames.add(entry.name);
  }

  const body = new ByteWriter();
  const central = new ByteWriter();

  interface LocalRecord {
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }
  const records: LocalRecord[] = [];

  for (const entry of entries) {
    const nameBytes = utf8.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const offset = body.currentLength();

    // Local file header
    body.u32(0x04034b50);
    body.u16(20); // version needed to extract
    body.u16(0); // general purpose bit flag
    body.u16(0); // compression method: 0 = STORE
    body.u16(DOS_TIME);
    body.u16(DOS_DATE);
    body.u32(crc);
    body.u32(size); // compressed size == uncompressed size (STORE)
    body.u32(size);
    body.u16(nameBytes.length);
    body.u16(0); // extra field length
    body.bytes(nameBytes);
    body.bytes(entry.data);

    records.push({ nameBytes, crc, size, offset });
  }

  for (const record of records) {
    central.u32(0x02014b50);
    central.u16(20); // version made by
    central.u16(20); // version needed to extract
    central.u16(0); // general purpose bit flag
    central.u16(0); // compression method: 0 = STORE
    central.u16(DOS_TIME);
    central.u16(DOS_DATE);
    central.u32(record.crc);
    central.u32(record.size);
    central.u32(record.size);
    central.u16(record.nameBytes.length);
    central.u16(0); // extra field length
    central.u16(0); // file comment length
    central.u16(0); // disk number start
    central.u16(0); // internal file attributes
    central.u32(0); // external file attributes
    central.u32(record.offset);
    central.bytes(record.nameBytes);
  }

  const centralOffset = body.currentLength();
  const centralSize = central.currentLength();

  const eocd = new ByteWriter();
  eocd.u32(0x06054b50);
  eocd.u16(0); // number of this disk
  eocd.u16(0); // disk where central directory starts
  eocd.u16(entries.length); // entries on this disk
  eocd.u16(entries.length); // total entries
  eocd.u32(centralSize);
  eocd.u32(centralOffset);
  eocd.u16(0); // comment length

  const out = new ByteWriter();
  out.bytes(body.toUint8Array());
  out.bytes(central.toUint8Array());
  out.bytes(eocd.toUint8Array());
  return out.toUint8Array();
}
