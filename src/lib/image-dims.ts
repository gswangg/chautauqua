// DEC-084: server-side headshot dimension gate, amending DEC-059's
// client-only downscale (a client can always be bypassed). Pure PNG/JPEG/
// WEBP (DEC-894) header sniffing — no node:/cloudflare imports (DEC-002).

export interface ImageDims {
  width: number;
  height: number;
}

export const MAX_HEADSHOT_EDGE_PX = 2048;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readUint32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) {
    throw new Error("Truncated image: not enough bytes to read a 32-bit value");
  }
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) {
    throw new Error("Truncated image: not enough bytes to read a 16-bit value");
  }
  return ((bytes[offset]! << 8) | bytes[offset + 1]!) >>> 0;
}

function readPngDims(bytes: Uint8Array): ImageDims {
  if (bytes.length < 24) {
    throw new Error("Truncated PNG: file is too short to contain an IHDR chunk");
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Malformed PNG: signature bytes do not match the PNG spec");
    }
  }
  // IHDR chunk type must immediately follow the 8-byte signature + 4-byte
  // chunk length at offset 12..15 ("IHDR" ASCII).
  const chunkType = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (chunkType !== "IHDR") {
    throw new Error("Malformed PNG: first chunk is not IHDR");
  }
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  return { width, height };
}

// JPEG markers that carry a Start Of Frame (SOF0..SOF15), excluding DHT
// (0xC4), JPG extension (0xC8), and DAC (0xCC) which share the 0xC0-0xCF
// range but are not frame headers.
const SOF_MARKERS = new Set<number>([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
// Standalone markers (no length field follows): TEM and RST0-RST7, plus
// SOI/EOI.
const STANDALONE_MARKERS = new Set<number>([
  0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9,
]);

function readJpegDims(bytes: Uint8Array): ImageDims {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Malformed JPEG: missing SOI marker");
  }
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error("Malformed JPEG: expected marker prefix 0xFF");
    }
    // Skip fill bytes (0xFF padding between markers).
    let markerOffset = offset + 1;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) {
      markerOffset++;
    }
    if (markerOffset >= bytes.length) {
      throw new Error("Truncated JPEG: marker byte missing");
    }
    const marker = bytes[markerOffset]!;
    offset = markerOffset + 1;

    if (STANDALONE_MARKERS.has(marker)) {
      continue;
    }

    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2) {
      throw new Error("Malformed JPEG: segment length too short");
    }

    if (SOF_MARKERS.has(marker)) {
      // Frame header: [length(2)][precision(1)][height(2)][width(2)]...
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      return { width, height };
    }

    offset += segmentLength;
  }
  throw new Error("Malformed JPEG: no SOF marker found before end of file");
}

// DEC-894: WEBP is a RIFF container ("RIFF"[size:4]"WEBP" followed by
// exactly one image chunk whose fourCC selects the sub-format). We only
// need that one chunk's dimensions, not full RIFF chunk walking.
function readUint24LE(bytes: Uint8Array, offset: number): number {
  if (offset + 3 > bytes.length) {
    throw new Error("Truncated WEBP: not enough bytes to read a 24-bit value");
  }
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)) >>> 0;
}

function readWebpDims(bytes: Uint8Array): ImageDims {
  if (bytes.length < 20) {
    throw new Error("Truncated WEBP: file is too short to contain a RIFF header and chunk fourCC");
  }
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (riff !== "RIFF") {
    throw new Error("Malformed WEBP: missing RIFF signature");
  }
  const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (webp !== "WEBP") {
    throw new Error("Malformed WEBP: missing WEBP form type");
  }
  const fourCC = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  const chunkStart = 20;

  if (fourCC === "VP8 ") {
    // Lossy: bitstream starts with a 3-byte frame tag, then the 3-byte
    // start code 0x9D 0x01 0x2A, then two 14-bit little-endian values
    // (width in the low 14 bits, top 2 bits are a scale factor; same for
    // height) packed into 2 bytes each.
    if (chunkStart + 10 > bytes.length) {
      throw new Error("Truncated WEBP: VP8 chunk too short");
    }
    const startCodeOffset = chunkStart + 3;
    if (bytes[startCodeOffset] !== 0x9d || bytes[startCodeOffset + 1] !== 0x01 || bytes[startCodeOffset + 2] !== 0x2a) {
      throw new Error("Malformed WEBP: VP8 start code not found");
    }
    const widthField = readUint16LE(bytes, startCodeOffset + 3);
    const heightField = readUint16LE(bytes, startCodeOffset + 5);
    return { width: widthField & 0x3fff, height: heightField & 0x3fff };
  }

  if (fourCC === "VP8L") {
    // Lossless: 1-byte 0x2F signature, then a 32-bit little-endian bitfield:
    // 14 bits width-1, 14 bits height-1, then 4 more bits (alpha/version).
    if (chunkStart + 5 > bytes.length) {
      throw new Error("Truncated WEBP: VP8L chunk too short");
    }
    if (bytes[chunkStart] !== 0x2f) {
      throw new Error("Malformed WEBP: VP8L signature byte not found");
    }
    const b1 = bytes[chunkStart + 1]!;
    const b2 = bytes[chunkStart + 2]!;
    const b3 = bytes[chunkStart + 3]!;
    const b4 = bytes[chunkStart + 4]!;
    const bits = (b1 | (b2 << 8) | (b3 << 16) | (b4 << 24)) >>> 0;
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (fourCC === "VP8X") {
    // Extended: 1 byte flags, 3 reserved bytes, then 24-bit LE canvas
    // width-1 and 24-bit LE canvas height-1.
    if (chunkStart + 10 > bytes.length) {
      throw new Error("Truncated WEBP: VP8X chunk too short");
    }
    const width = readUint24LE(bytes, chunkStart + 4) + 1;
    const height = readUint24LE(bytes, chunkStart + 7) + 1;
    return { width, height };
  }

  throw new Error(`Malformed WEBP: unrecognized chunk fourCC '${fourCC}'`);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) {
    throw new Error("Truncated image: not enough bytes to read a 16-bit little-endian value");
  }
  return (bytes[offset]! | (bytes[offset + 1]! << 8)) >>> 0;
}

/**
 * Reads pixel dimensions from raw PNG, JPEG, or WEBP bytes without any
 * external decoding library. Throws loudly on malformed/truncated input or
 * an unsupported contentType — never returns a fallback guess.
 */
export function readImageDims(bytes: Uint8Array, contentType: string): ImageDims {
  if (contentType === "image/png") {
    return readPngDims(bytes);
  }
  if (contentType === "image/jpeg") {
    return readJpegDims(bytes);
  }
  if (contentType === "image/webp") {
    return readWebpDims(bytes);
  }
  throw new Error(`Unsupported contentType for dimension sniffing: '${contentType}'`);
}
