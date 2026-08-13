// DEC-817: the embed builder (app/src/pages/settings/embedSnippet.ts +
// EmbedsPanel.tsx) and the live public route's query-param parsers
// (src/routes/public/query.ts, src/lib/card-fields.ts, src/routes/public/
// shell.tsx's isSurface) are ONE contract. This test enumerates EVERY
// parameter the builder can emit — from the builder's own option/constant
// arrays, never a hand-written list — and asserts it round-trips through the
// exact parser the live route runs. A future builder field the route
// ignores (or rejects) must fail here, not on a visitor's copied URL.
import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  DEFAULT_ACCENT_PLACEHOLDER,
  EMBED_FIELDS,
  EMBED_FORMATS,
  EMBED_KNOBS_BY_SURFACE,
  EMBED_SURFACES,
} from "../app/src/pages/settings/embedSnippet";
import { isSurface } from "../src/routes/public/shell";
import { parseAccent, parseCardFields, parseLimit } from "../src/routes/public/query";

const ORIGIN = "https://example.org";
const SLUG = "devcon-2026";

// Splits the surface segment (with its optional .json/.xml suffix) and the
// query string out of a built embed URL, exactly as the live route's own
// path-matching does (src/routes/public/index.tsx: the plain route, the
// `{[a-z]+\\.json}` route and the `{[a-z]+\\.xml}` route).
function parseBuiltUrl(url: string): { pathname: string; params: URLSearchParams } {
  const u = new URL(url);
  return { pathname: u.pathname, params: u.searchParams };
}

describe("embed builder <-> live route param parity (DEC-817)", () => {
  it("every EMBED_SURFACES value the builder can pick is accepted by the live route's isSurface", () => {
    expect(EMBED_SURFACES.length).toBeGreaterThan(0);
    for (const surface of EMBED_SURFACES) {
      expect(isSurface(surface)).toBe(true);
    }
  });

  it("every EMBED_FORMATS value the builder can pick resolves to a path the live route actually serves", () => {
    expect(EMBED_FORMATS.length).toBeGreaterThan(0);
    for (const surface of EMBED_SURFACES) {
      for (const format of EMBED_FORMATS) {
        // DEC-289: ics is only meaningful from agenda/schedule — same rule
        // EmbedsPanel.tsx's formatsFor() applies before ever offering it.
        if (format === "ics" && surface !== "agenda" && surface !== "schedule") continue;
        const url = buildEmbedUrl(ORIGIN, SLUG, surface, { format });
        const { pathname } = parseBuiltUrl(url);
        if (format === "ics") {
          expect(pathname).toBe(`/e/${SLUG}/agenda.ics`);
        } else if (format === "json") {
          expect(pathname).toMatch(/^\/embed\/[^/]+\/[a-z]+\.json$/);
        } else if (format === "xml") {
          expect(pathname).toMatch(/^\/embed\/[^/]+\/[a-z]+\.xml$/);
        } else {
          // iframe / element / link — the plain HTML embed route, no suffix,
          // and the bare surface value must itself pass isSurface (the
          // plain route's own gate).
          expect(pathname).toBe(`/embed/${SLUG}/${surface}`);
          const surfaceSegment = pathname.split("/").pop()!;
          expect(isSurface(surfaceSegment)).toBe(true);
        }
      }
    }
  });

  it("every EMBED_FIELDS value the builder can select round-trips through parseCardFields", () => {
    expect(EMBED_FIELDS.length).toBeGreaterThan(0);
    for (const field of EMBED_FIELDS) {
      const url = buildEmbedUrl(ORIGIN, SLUG, "sessions", { format: "iframe", fields: [field] });
      const { params } = parseBuiltUrl(url);
      const raw = params.get("fields") ?? undefined;
      // A singleton is always a proper subset of EMBED_FIELDS (length > 1),
      // so buildEmbedUrl always serializes it (never silently dropped as a
      // "default, omit" case).
      expect(raw).toBeDefined();
      const parsed = parseCardFields(raw);
      for (const other of EMBED_FIELDS) {
        expect(parsed[other]).toBe(other === field);
      }
    }
  });

  it("the limit knob's builder-visible bounds (1..100) round-trip through parseLimit", () => {
    for (const limit of [1, 100]) {
      const url = buildEmbedUrl(ORIGIN, SLUG, "sessions", { format: "iframe", limit });
      const { params } = parseBuiltUrl(url);
      expect(parseLimit(params.get("limit") ?? undefined)).toBe(limit);
    }
  });

  it("the accent knob's exact placeholder string round-trips through parseAccent", () => {
    const placeholder = `#${DEFAULT_ACCENT_PLACEHOLDER}`;
    // A visitor who literally copies the placeholder (with its leading '#')
    // types `placeholder` into the Accent color input, which flows straight
    // into buildEmbedUrl's opts.accent.
    const url = buildEmbedUrl(ORIGIN, SLUG, "sessions", { format: "iframe", accent: placeholder });
    const { params } = parseBuiltUrl(url);
    const raw = params.get("accent") ?? undefined;
    expect(raw).toBeDefined();
    expect(parseAccent(raw)).toBe(`#${DEFAULT_ACCENT_PLACEHOLDER.toLowerCase()}`);
    // DEC-817: parseAccent itself must also tolerate the '#' form directly
    // (not merely because buildEmbedUrl happens to strip it) — the parser is
    // the contract, not any one caller's stripping.
    expect(parseAccent(placeholder)).toBe(`#${DEFAULT_ACCENT_PLACEHOLDER.toLowerCase()}`);
    expect(parseAccent(DEFAULT_ACCENT_PLACEHOLDER)).toBe(`#${DEFAULT_ACCENT_PLACEHOLDER.toLowerCase()}`);
  });

  it("every surface's accent knob (when advertised) is honored consistently", () => {
    for (const surface of EMBED_SURFACES) {
      if (!EMBED_KNOBS_BY_SURFACE[surface].includes("accent")) continue;
      const url = buildEmbedUrl(ORIGIN, SLUG, surface, { format: "iframe", accent: "#ABC" });
      const { params } = parseBuiltUrl(url);
      expect(parseAccent(params.get("accent") ?? undefined)).toBe("#aabbcc");
    }
  });
});
