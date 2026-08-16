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

// comms.ts was decomposed (contention-hotspot split, no behavior change)
// into src/routes/comms/*; the send and preview handlers now live in their
// own files instead of sharing one commsSrc string.
const commsSendSrc = readFileSync(join(__dirname, "../src/routes/comms/send.ts"), "utf8");
const commsPreviewSrc = readFileSync(join(__dirname, "../src/routes/comms/preview.ts"), "utf8");
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
  it("comms/send.ts /compose/send does not reference result.rendered in its response", () => {
    const handler = handlerBody(commsSendSrc, '"/api/v1/events/:eventId/compose/send"', []);
    // Isolate just the final return statement of the handler. `result.rendered.length`
    // (a count) is fine here -- only the response carrying the rendered array itself
    // (an `items:` key) would leak bodies/claim tokens.
    const returnMatch = handler.match(/return c\.json\(\{[^}]*\}\);/s);
    expect(returnMatch).not.toBeNull();
    const returnStatement = returnMatch![0];
    expect(returnStatement).not.toContain("items");
    expect(returnStatement).not.toMatch(/result\.rendered(?!\.length)/);
  });

  it("comms/preview.ts /compose/preview still returns items derived from result.rendered", () => {
    const handler = handlerBody(commsPreviewSrc, '"/api/v1/events/:eventId/compose/preview"', []);
    expect(handler).toContain("result.rendered");
    // DEC-238 (wave-60 amendment): preview now runs the same dedupe planner
    // send executes and returns the plan alongside items — the response is
    // exactly { items, plan: { willSend, skipped } }. `plan` carries only
    // counts and the planner's skip records ({email, name, submissionId,
    // reason, retryAtIso}), never rendered bodies or claim tokens; the
    // preview `items` bodies themselves remain legitimate (mintClaimTokens
    // is false on this path, DEC-397).
    expect(handler).toMatch(
      /return c\.json\(\{\s*items,\s*plan:\s*\{\s*willSend:\s*toSend\.length,\s*skipped\s*\}\s*\}\);/,
    );
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

  it("documents the exact send response contract: comms/send.ts is {sent, skipped, failed} (DEC-238 wave-3 amendment); bulk-email.ts is {sent, skipped, failed} too (DEC-238 wave-14 amendment)", () => {
    const commsHandler = handlerBody(commsSendSrc, '"/api/v1/events/:eventId/compose/send"', []);
    const bulkHandler = handlerBody(bulkEmailSrc, '"/contacts/bulk-email"', ['"/contacts/bulk-email/preview"']);

    function keysOf(handler: string): string[] {
      const returnMatch = handler.match(/return c\.json\(\{([^}]*)\}\);/s);
      expect(returnMatch).not.toBeNull();
      const captured = returnMatch![1] ?? "";
      return captured
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part.split(":")[0] ?? "").trim())
        .sort();
    }

    // DEC-238 wave-3 amendment: compose/send is the highest-consequence
    // fan-out and carries a `skipped` dedupe report (a per-recipient ARRAY,
    // because its own step-4 report is per-submission).
    // DEC-238 wave-14 amendment: the CRM bulk-email send is the SAME dedupe
    // class -- it reuses the one window and one key verbatim and additionally
    // collapses to the first contact per lower-cased address within the
    // batch -- so it too answers `skipped`, as a COUNT (matching
    // app/src/lib/sendResult.ts's SendResult contract). Both handlers now
    // share the {sent, skipped, failed} key set; only the `skipped` VALUE
    // shape differs, which is asserted below.
    expect(keysOf(commsHandler)).toEqual(["failed", "sent", "skipped"]);
    expect(keysOf(bulkHandler)).toEqual(["failed", "sent", "skipped"]);

    // The shapes are deliberately different: compose/send maps a per-recipient
    // array; bulk-email sums two integer counters (intra-batch + cross-call).
    expect(bulkHandler).toMatch(/skipped:\s*intraBatchSkipped\s*\+\s*crossCallSkipped/);
  });
});
