import { describe, expect, it } from "vitest";
import { MAX_HEADSHOT_EDGE_PX, readImageDims } from "../src/lib/image-dims";

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function u16be(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function buildPng(width: number, height: number): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrData = [
    ...u32be(width),
    ...u32be(height),
    8, // bit depth
    2, // color type (truecolor)
    0, // compression
    0, // filter
    0, // interlace
  ];
  const chunk = [...u32be(13), 0x49, 0x48, 0x44, 0x52 /* "IHDR" */, ...ihdrData, 0, 0, 0, 0 /* fake CRC */];
  return new Uint8Array([...signature, ...chunk]);
}

function buildJpeg(width: number, height: number, sofMarker = 0xc0): Uint8Array {
  const soi = [0xff, 0xd8];
  // SOF segment: marker(2) length(2) precision(1) height(2) width(2) numComponents(1) + 1 component(3 bytes)
  const sofData = [8 /* precision */, ...u16be(height), ...u16be(width), 1 /* numComponents */, 1, 0x11, 0];
  const sofLength = sofData.length + 2;
  const sof = [0xff, sofMarker, ...u16be(sofLength), ...sofData];
  const eoi = [0xff, 0xd9];
  return new Uint8Array([...soi, ...sof, ...eoi]);
}

describe("readImageDims", () => {
  it("reads a valid PNG's width/height from IHDR", () => {
    const png = buildPng(640, 480);
    expect(readImageDims(png, "image/png")).toEqual({ width: 640, height: 480 });
  });

  it("reads a valid baseline JPEG's width/height from SOF0", () => {
    const jpeg = buildJpeg(1024, 768, 0xc0);
    expect(readImageDims(jpeg, "image/jpeg")).toEqual({ width: 1024, height: 768 });
  });

  it("reads a valid progressive JPEG's width/height from SOF2", () => {
    const jpeg = buildJpeg(1920, 1080, 0xc2);
    expect(readImageDims(jpeg, "image/jpeg")).toEqual({ width: 1920, height: 1080 });
  });

  it("flags PNG dimensions over the 2048px gate", () => {
    const png = buildPng(3000, 500);
    const dims = readImageDims(png, "image/png");
    expect(dims.width).toBeGreaterThan(MAX_HEADSHOT_EDGE_PX);
  });

  it("flags JPEG dimensions over the 2048px gate", () => {
    const jpeg = buildJpeg(500, 4096, 0xc0);
    const dims = readImageDims(jpeg, "image/jpeg");
    expect(dims.height).toBeGreaterThan(MAX_HEADSHOT_EDGE_PX);
  });

  it("throws on a truncated PNG", () => {
    const png = buildPng(640, 480).slice(0, 10);
    expect(() => readImageDims(png, "image/png")).toThrow();
  });

  it("throws on a PNG with a bad signature", () => {
    const png = buildPng(640, 480);
    png[0] = 0x00;
    expect(() => readImageDims(png, "image/png")).toThrow();
  });

  it("throws on a truncated JPEG (missing SOF)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    expect(() => readImageDims(jpeg, "image/jpeg")).toThrow();
  });

  it("throws on a JPEG missing the SOI marker", () => {
    const jpeg = buildJpeg(640, 480).slice(1);
    expect(() => readImageDims(jpeg, "image/jpeg")).toThrow();
  });

  it("throws on an unsupported contentType", () => {
    const png = buildPng(640, 480);
    expect(() => readImageDims(png, "image/gif")).toThrow();
  });
});

function u16le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}

function u24le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
}

function u32le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function riffWrap(fourCC: string, chunkBytes: number[]): Uint8Array {
  const riffSize = 4 + chunkBytes.length; // "WEBP" + chunk
  const header = [
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    ...u32le(riffSize),
    0x57, 0x45, 0x42, 0x50, // "WEBP"
  ];
  return new Uint8Array([...header, ...chunkBytes]);
}

function buildWebpLossy(width: number, height: number): Uint8Array {
  // VP8 chunk: fourCC(4) + chunkSize(4) + 3-byte frame tag + 3-byte start
  // code (0x9D 0x01 0x2A) + 2-byte width(14 bits) + 2-byte height(14 bits).
  const payload = [
    0, 0, 0, // frame tag (unused by our reader)
    0x9d, 0x01, 0x2a,
    ...u16le(width & 0x3fff),
    ...u16le(height & 0x3fff),
  ];
  const chunk = [0x56, 0x50, 0x38, 0x20 /* "VP8 " */, ...u32le(payload.length), ...payload];
  return riffWrap("WEBP", chunk);
}

function buildWebpLossless(width: number, height: number): Uint8Array {
  // VP8L chunk: fourCC(4) + chunkSize(4) + signature(1, 0x2F) + 4-byte
  // bitfield: 14 bits width-1, 14 bits height-1, 4 bits alpha/version.
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const payload = [0x2f, ...u32le(bits >>> 0)];
  const chunk = [0x56, 0x50, 0x38, 0x4c /* "VP8L" */, ...u32le(payload.length), ...payload];
  return riffWrap("WEBP", chunk);
}

function buildWebpExtended(width: number, height: number): Uint8Array {
  // VP8X chunk: fourCC(4) + chunkSize(4) + flags(1) + reserved(3) +
  // 24-bit LE canvas width-1 + 24-bit LE canvas height-1.
  const payload = [0, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)];
  const chunk = [0x56, 0x50, 0x38, 0x58 /* "VP8X" */, ...u32le(payload.length), ...payload];
  return riffWrap("WEBP", chunk);
}

describe("readImageDims (WEBP)", () => {
  it("reads a valid lossy WEBP (VP8 )'s width/height", () => {
    const webp = buildWebpLossy(640, 480);
    expect(readImageDims(webp, "image/webp")).toEqual({ width: 640, height: 480 });
  });

  it("reads a valid lossless WEBP (VP8L)'s width/height", () => {
    const webp = buildWebpLossless(800, 600);
    expect(readImageDims(webp, "image/webp")).toEqual({ width: 800, height: 600 });
  });

  it("reads a valid extended WEBP (VP8X)'s width/height", () => {
    const webp = buildWebpExtended(3000, 500);
    expect(readImageDims(webp, "image/webp")).toEqual({ width: 3000, height: 500 });
  });

  it("flags an extended WEBP over the 2048px gate", () => {
    const webp = buildWebpExtended(3000, 500);
    const dims = readImageDims(webp, "image/webp");
    expect(dims.width).toBeGreaterThan(MAX_HEADSHOT_EDGE_PX);
  });

  it("throws on a truncated WEBP (missing RIFF header)", () => {
    const webp = buildWebpLossy(640, 480).slice(0, 10);
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });

  it("throws on a WEBP with a bad RIFF signature", () => {
    const webp = buildWebpLossy(640, 480);
    webp[0] = 0x00;
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });

  it("throws on a WEBP missing the WEBP form type", () => {
    const webp = buildWebpLossy(640, 480);
    webp[8] = 0x00;
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });

  it("throws on a VP8 chunk with a truncated start code", () => {
    const webp = buildWebpLossy(640, 480).slice(0, 24);
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });

  it("throws on a VP8 chunk with a malformed start code", () => {
    const webp = buildWebpLossy(640, 480);
    webp[23] = 0x00; // corrupt the 0x9D byte of the start code
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });

  it("throws on a VP8L chunk with a bad signature byte", () => {
    const webp = buildWebpLossless(800, 600);
    webp[20] = 0x00; // corrupt the 0x2F signature byte
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });

  it("throws on an unrecognized WEBP chunk fourCC", () => {
    const webp = buildWebpLossy(640, 480);
    webp[12] = 0x58; // "X" -- corrupt "VP8 " into a nonsense fourCC
    webp[13] = 0x58;
    webp[14] = 0x58;
    webp[15] = 0x58;
    expect(() => readImageDims(webp, "image/webp")).toThrow();
  });
});
