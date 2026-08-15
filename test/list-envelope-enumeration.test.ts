import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findStaleAllowlistEntries, listSourceFiles, relativePath } from "./support/list-envelope-enumeration/scan-utils";
import { findItemsEnvelopeSites, ENVELOPE_ALLOWLIST } from "./support/list-envelope-enumeration/envelope-sites";
import { findStrayPerPageConstantDeclarations } from "./support/list-envelope-enumeration/pagination-const-scan";

/**
 * DEC-480: turns DEC-473's "population = re-runnable artifact" rule into an
 * executable conformance test for the list-envelope shape, and closes the
 * last three per-route copies of the DEFAULT_PER_PAGE=50/MAX_PER_PAGE=200
 * clamp rule (src/routes/tasks.ts's parseOnboardingGridQuery,
 * src/server/repo/contacts/query.ts, src/server/repo/submissions/query.ts --
 * all three now delegate to clampPage/clampPerPage in
 * src/lib/pagination.ts).
 *
 * This test file is the thin assertions module; the scan/detection logic
 * lives in test/support/list-envelope-enumeration/ (extracted for
 * decomposition, no behavior change -- see that directory's files for the
 * verbatim helper implementations).
 *
 * (a) Every `return c.json({ items ...` site under src/routes/**\/*.{ts,tsx}
 *     must carry `total`, `page`, and `perPage` in the same returned object
 *     literal -- the DEC-461(a) list-envelope contract. Four sites are
 *     deliberately not list-GET envelopes and are named exceptions in
 *     ENVELOPE_ALLOWLIST (test/support/list-envelope-enumeration/envelope-
 *     sites.ts), keyed by `${relativePath}#${METHOD} ${routePath}` -- the
 *     nearest preceding route registration, not a line number, since a line
 *     number is not a handler's identity (DEC-480 wave-17 amendment: this
 *     replaced a file:line keying scheme that drifted five times as
 *     unrelated code was added above these sites, each drift breaking
 *     someone else's test run). One further site, src/routes/review/
 *     plans.ts's GET .../assignments/distribute/preview, used to be
 *     allowlisted here under the old `{ items, perReviewer, total,
 *     shortfall }` shape; DEC-840 reordered its envelope to `{ cap,
 *     totalAssigned, items, perReviewer, shortfall }` -- cap echoed first --
 *     so it no longer matches this scanner's `{ items` pattern and needs no
 *     entry:
 *       - POST .../compose/preview (src/routes/comms/preview.ts) returns a
 *         compose-preview render, one row per selected submission, bounded
 *         by the 100-recipient send cap (DEC checked elsewhere in comms/)
 *         -- a preview payload, not a list GET.
 *       - POST /contacts/bulk-email/preview
 *         (src/routes/api/contacts/bulk-email.ts) is the CRM-11/DEC-150
 *         bulk-email preview: it slices to `previewContacts =
 *         contacts.slice(0, BULK_EMAIL_PREVIEW_LIMIT)` (5) before
 *         rendering, so it is bounded by that constant, not by a
 *         page/perPage query param -- a preview payload, not a list GET.
 *       - GET /contacts/duplicates/check
 *         (src/routes/api/contacts/duplicates.ts, DEC-788) is a bounded
 *         (cap 5), deterministically-ordered near-duplicate lookup for a
 *         not-yet-created contact: no page/perPage query param feeds it and
 *         the cap is a constant -- a lookup payload, not a list GET.
 *       - POST /api/v1/plans/:id/reviewers
 *         (src/routes/review/plans-reviewers.ts) answers the set of rows it
 *         just wrote (bounded by the request's own parseBoundedIdArray
 *         cap), never a paginated read -- same shape-exception class as the
 *         compose preview above.
 *
 * (b) src/lib/pagination.ts must be the ONLY file under src/routes/** or
 *     src/server/repo/** that declares a constant named like
 *     DEFAULT*PER_PAGE or MAX*PER_PAGE (the DEC-465/480 clamp-rule pair,
 *     matched case-insensitively). This deliberately does NOT flag a bare
 *     `PER_PAGE` constant with no DEFAULT/MAX prefix -- e.g.
 *     src/routes/public/shell.tsx:20's `export const PER_PAGE = 12` is a
 *     fixed, non-clamped page size for the public embed shell (no
 *     ?perPage= query param feeds it, so there is no clamp rule to
 *     duplicate); it was read at that file:line and is deliberately out of
 *     scope, not allowlisted, because the (b) check's own name pattern
 *     already excludes it.
 *
 * OPEN ITEMS (none found in this run -- recorded here per the task's "leave
 * it and name it" instruction in case a future scan surfaces one):
 *   (none)
 */

const REPO_ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(REPO_ROOT, "src", "routes");
const REPO_LIB_ROOTS = [join(REPO_ROOT, "src", "routes"), join(REPO_ROOT, "src", "server", "repo")];

describe("DEC-480: list-envelope enumeration (executable, not prose)", () => {
  const routeFiles = listSourceFiles(ROUTES_ROOT, /\.(ts|tsx)$/);

  it("finds at least 15 c.json({ items ... sites (scanner sanity check)", () => {
    let count = 0;
    for (const file of routeFiles) {
      count += findItemsEnvelopeSites(readFileSync(file, "utf8"), file).length;
    }
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it("(a) every c.json({ items ... site carries total, page, and perPage, or is named-allowlisted", () => {
    const offenders: string[] = [];
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      for (const site of findItemsEnvelopeSites(source, file)) {
        const key = `${relativePath(REPO_ROOT, site.file)}#${site.route}`;
        if (ENVELOPE_ALLOWLIST.has(key)) continue;
        const hasAll = /\btotal\b/.test(site.body) && /\bpage\b/.test(site.body) && /\bperPage\b/.test(site.body);
        if (!hasAll) {
          offenders.push(
            `  ${key}: c.json({ items ... }) is missing total/page/perPage -- body: ${site.body.slice(0, 160)}`,
          );
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} list-shaped response(s) missing the DEC-461(a) envelope:\n${offenders.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("(a) every allowlist entry is still a real, still-non-conforming site (no stale entries)", () => {
    const seen = new Set<string>();
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      for (const site of findItemsEnvelopeSites(source, file)) {
        seen.add(`${relativePath(REPO_ROOT, site.file)}#${site.route}`);
      }
    }
    const stale = findStaleAllowlistEntries(ENVELOPE_ALLOWLIST, seen);
    if (stale.length > 0) {
      throw new Error(
        `Found ${stale.length} stale ENVELOPE_ALLOWLIST entry(s) that match no site in the current scan -- ` +
          `remove them from test/support/list-envelope-enumeration/envelope-sites.ts:\n${stale
            .map((e) => `  ${e}`)
            .join("\n")}`,
      );
    }
    expect(stale).toEqual([]);
  });

  it("(a) unit case: an orphaned allowlist key is detected as stale (proves the mechanism, not just today's inputs)", () => {
    const seen = new Set<string>(["src/routes/comms/preview.ts#POST /api/v1/events/:eventId/compose/preview"]);
    const fakeAllowlist = new Set<string>([
      "src/routes/comms/preview.ts#POST /api/v1/events/:eventId/compose/preview",
      "src/routes/nonexistent/gone.ts#GET /api/v1/never/registered",
    ]);
    expect(findStaleAllowlistEntries(fakeAllowlist, seen)).toEqual([
      "src/routes/nonexistent/gone.ts#GET /api/v1/never/registered",
    ]);
  });

  it("(b) src/lib/pagination.ts is the only file declaring the per-page clamp constant pair", () => {
    const PAGINATION_FILE = join(REPO_ROOT, "src", "lib", "pagination.ts");
    const offenders = findStrayPerPageConstantDeclarations(REPO_ROOT, PAGINATION_FILE, REPO_LIB_ROOTS);
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} per-page clamp constant declaration(s) outside src/lib/pagination.ts:\n${offenders.join(
          "\n",
        )}\nDelegate to clampPage/clampPerPage/listPerPage in src/lib/pagination.ts instead.`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
