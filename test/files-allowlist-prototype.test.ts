// Wave-38 (DEC-020 amendment): validateUpload/validateHeadshotUpload tested
// `ext in SOME_CONTENT_TYPE_MAP` against plain object literals, so `in`
// walked Object.prototype — a filename like `deck.constructor` or
// `x.__proto__` cleared the allowlist and yielded a function/object as the
// "content type". That value is persisted as file.content_type and echoed
// as a raw Content-Type header by fileServeRoutes.get("/files/:fileId")
// (src/routes/files.ts). Reachable with NO account, through the public CFP
// upload flow (src/routes/public/submit.tsx) — validateUpload is the only
// guard between an anonymous filename and that stored value. This file
// proves the prototype-chain hole is closed and stays closed.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FILE_KINDS,
  allowedUploadExtensions,
  assertServedContentTypeHeader,
  uploadHintText,
  validateHeadshotUpload,
  validateUpload,
  type FileKind,
} from "../src/domain/files";

// Every own-and-inherited property name on a plain object literal that could
// plausibly be reached via `ext in someMap` for a crafted extension.
const PROTO_KEYS = [
  "constructor",
  "__proto__",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
] as const;

describe("upload allowlist: prototype-chain hole (DEC-020 amendment, wave 38)", () => {
  it.each(PROTO_KEYS)("validateUpload rejects deck.%s for every FILE_KIND", (key) => {
    for (const kind of FILE_KINDS) {
      const result = validateUpload({ filename: `deck.${key}`, sizeBytes: 1024, kind });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("isn't allowed");
      }
    }
  });

  it.each(PROTO_KEYS)("validateHeadshotUpload rejects headshot.%s", (key) => {
    const result = validateHeadshotUpload({ filename: `headshot.${key}`, sizeBytes: 1024 });
    expect(result.ok).toBe(false);
  });

  it("allowedUploadExtensions() never lists a prototype key, for any kind (incl. undefined)", () => {
    const kinds: (FileKind | undefined)[] = [undefined, ...FILE_KINDS];
    for (const kind of kinds) {
      const exts = allowedUploadExtensions(kind);
      for (const key of PROTO_KEYS) {
        expect(exts).not.toContain(key);
      }
    }
  });

  it("uploadHintText() never mentions a prototype key", () => {
    for (const kind of [undefined, ...FILE_KINDS] as (FileKind | undefined)[]) {
      const hint = uploadHintText(kind);
      for (const key of PROTO_KEYS) {
        expect(hint).not.toContain(key);
      }
    }
  });

  it("two-directional ledger: every extension allowedUploadExtensions('recording') reports round-trips through validateUpload, and every ok result's servedContentType is a safe string", () => {
    const extensions = allowedUploadExtensions("recording");
    expect(extensions.length).toBeGreaterThan(0);

    for (const ext of extensions) {
      // Find at least one kind for which this extension validates ok — video
      // extensions are recording-only, everything else is admitted broadly.
      let sawOk = false;
      for (const kind of FILE_KINDS) {
        const result = validateUpload({ filename: `file.${ext}`, sizeBytes: 1024, kind });
        if (result.ok) {
          sawOk = true;
          expect(typeof result.servedContentType).toBe("string");
          expect(result.servedContentType.toLowerCase().startsWith("text/html")).toBe(false);
        }
      }
      expect(sawOk).toBe(true);
    }
  });

  describe("assertServedContentTypeHeader", () => {
    it("throws for text/html", () => {
      expect(() => assertServedContentTypeHeader("text/html")).toThrow();
      expect(() => assertServedContentTypeHeader("Text/HTML; charset=utf-8")).toThrow();
    });

    it("throws for a value carrying header injection (CRLF)", () => {
      expect(() => assertServedContentTypeHeader("application/pdf\r\nX-Injected: 1")).toThrow();
    });

    it("throws for a non-string value forced through the type system", () => {
      expect(() => assertServedContentTypeHeader(42 as unknown as string)).toThrow();
      expect(() => assertServedContentTypeHeader({} as unknown as string)).toThrow();
      expect(() => assertServedContentTypeHeader(undefined as never)).toThrow();
    });

    it("returns every real allowlist value unchanged", () => {
      const values = [
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/octet-stream",
        "application/vnd.oasis.opendocument.presentation",
        "application/zip",
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "text/plain",
        "video/mp4",
        "video/quicktime",
        "video/webm",
      ];
      for (const value of values) {
        expect(assertServedContentTypeHeader(value)).toBe(value);
      }
    });
  });

  it("source guard: files.ts no longer tests membership with `in` against a *_CONTENT_TYPE map, and uses hasOwnProperty", () => {
    const source = readFileSync(new URL("../src/domain/files.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\bin\s+[A-Z][A-Z0-9_]*_CONTENT_TYPE\b/);
    expect(source).toContain("hasOwnProperty");
  });
});
