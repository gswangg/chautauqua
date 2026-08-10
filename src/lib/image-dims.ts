// DEC-084: server-side headshot dimension gate, amending DEC-059's
// client-only downscale (a client can always be bypassed). Pure PNG/JPEG
// header sniffing — no node:/cloudflare imports (DEC-002).

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

/**
 * Reads pixel dimensions from raw PNG or JPEG bytes without any external
 * decoding library. Throws loudly on malformed/truncated input or an
 * unsupported contentType — never returns a fallback guess.
 */
export function readImageDims(bytes: Uint8Array, contentType: string): ImageDims {
  if (contentType === "image/png") {
    return readPngDims(bytes);
  }
  if (contentType === "image/jpeg") {
    return readJpegDims(bytes);
  }
  throw new Error(`Unsupported contentType for dimension sniffing: '${contentType}'`);
}
