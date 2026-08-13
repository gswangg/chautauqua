// DEC-949 amendment (w38-a): /compose/send and /contacts/bulk-email must
// never return rendered message bodies in their JSON response, because
// buildRenderTargets/renderBulkEmailTargets are called with
// mintClaimTokens=true on the send path, so `result.rendered[i].text`
// contains a live, unredacted `${origin}/claim/<token>` for every recipient
// without an account. The preview handlers (mintClaimTokens=false, DEC-397)
// legitimately still return bodies for organizer review.
//
// This is a source-level assertion: it reads the two route files directly
// and inspects the final `return c.json(...)` of each send handler (rather
// than exercising the full Hono app + D1 + KV stack), since the only thing
// under test is "does this response object literal reference
// result.rendered".

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const commsSrc = readFileSync(join(__dirname, "../src/routes/comms.ts"), "utf8");
const bulkEmailSrc = readFileSync(join(__dirname, "../src/routes/api/contacts/bulk-email.ts"), "utf8");

/**
 * Extracts the substring of `source` between the route registration line
 * matching `routeMarker` and the next route registration (or end of file),
 * so we can inspect a single handler's body in isolation.
 */
function handlerBody(source: string, routeMarker: string, nextMarkers: string[]): string {
  const start = source.indexOf(routeMarker);
  if (start === -1) throw new Error(`route marker not found: ${routeMarker}`);
  let end = source.length;
  for (const marker of nextMarkers) {
    const idx = source.indexOf(marker, start + routeMarker.length);
    if (idx !== -1 && idx < end) end = idx;
  }
  return source.slice(start, end);
}

describe("send responses never carry rendered bodies or claim tokens", () => {
  it("comms.ts /compose/send does not reference result.rendered in its response", () => {
    const handler = handlerBody(
      commsSrc,
      '"/api/v1/events/:eventId/compose/send"',
      ['"/api/v1/events/:eventId/portal-invite', "commsRoutes.post", "commsRoutes.get"].filter(
        (m) => m !== '"/api/v1/events/:eventId/compose/send"',
      ),
    );
    // Isolate just the final return statement of the handler. `result.rendered.length`
    // (a count) is fine here -- only the response carrying the rendered array itself
    // (an `items:` key) would leak bodies/claim tokens.
    const returnMatch = handler.match(/return c\.json\(\{[^}]*\}\);/s);
    expect(returnMatch).not.toBeNull();
    const returnStatement = returnMatch![0];
    expect(returnStatement).not.toContain("items");
    expect(returnStatement).not.toMatch(/result\.rendered(?!\.length)/);
  });

  it("comms.ts /compose/preview still returns items derived from result.rendered", () => {
    const handler = handlerBody(commsSrc, '"/api/v1/events/:eventId/compose/preview"', [
      '"/api/v1/events/:eventId/compose/send"',
    ]);
    expect(handler).toContain("result.rendered");
    expect(handler).toMatch(/return c\.json\(\{\s*items\s*\}\);/);
  });

  it("bulk-email.ts /contacts/bulk-email send handler does not reference result.rendered in its response", () => {
    const handler = handlerBody(bulkEmailSrc, '"/contacts/bulk-email"', ['"/contacts/bulk-email/preview"']);
    const returnMatch = handler.match(/return c\.json\(\{[^}]*\}\);/s);
    expect(returnMatch).not.toBeNull();
    const returnStatement = returnMatch![0];
    expect(returnStatement).not.toContain("items");
    expect(returnStatement).not.toMatch(/result\.rendered(?!\.length)/);
  });

  it("bulk-email.ts /contacts/bulk-email/preview still returns bodies from result.rendered", () => {
    const handler = handlerBody(bulkEmailSrc, '"/contacts/bulk-email/preview"', []);
    expect(handler).toContain("result.rendered");
    expect(handler).toContain("bodyText: r.text");
  });

  it("documents the exact send response contract: {sent, failed}", () => {
    const commsHandler = handlerBody(
      commsSrc,
      '"/api/v1/events/:eventId/compose/send"',
      ['"/api/v1/events/:eventId/portal-invite', "commsRoutes.post", "commsRoutes.get"].filter(
        (m) => m !== '"/api/v1/events/:eventId/compose/send"',
      ),
    );
    const bulkHandler = handlerBody(bulkEmailSrc, '"/contacts/bulk-email"', ['"/contacts/bulk-email/preview"']);

    for (const handler of [commsHandler, bulkHandler]) {
      const returnMatch = handler.match(/return c\.json\(\{([^}]*)\}\);/s);
      expect(returnMatch).not.toBeNull();
      const captured = returnMatch![1] ?? "";
      const keys = captured
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part.split(":")[0] ?? "").trim());
      expect(keys.sort()).toEqual(["failed", "sent"]);
    }
  });
});
