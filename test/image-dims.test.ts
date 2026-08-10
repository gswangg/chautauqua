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
    expect(() => readImageDims(png, "image/webp")).toThrow();
  });
});
