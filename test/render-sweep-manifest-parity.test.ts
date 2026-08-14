// DEC-503: the 390x844 phone sweep (SPEC §9 exam viewport) never rendered
// two of the five public embed surfaces (schedule, gallery) because
// MOBILE_ROUTE_MANIFEST in scripts/render-sweep.ts hand-listed only
// sessions/agenda/speakers under /embed/<slug>. This test enumerates
// SURFACES (src/routes/public/shell.tsx) rather than hand-listing surface
// names, so a new surface added to SURFACES fails this test until BOTH
// app/src/routeManifest.ts's ROUTE_MANIFEST and scripts/render-sweep.ts's
// MOBILE_ROUTE_MANIFEST are updated to cover it.

import { describe, expect, it } from "vitest";

import { SURFACES } from "../src/routes/public/shell";
import { EVENT_SLUG, ROUTE_MANIFEST } from "../app/src/routeManifest";
import { MOBILE_EVENT_SLUG, MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";

function hasPath(manifest: readonly { path: string }[], path: string): boolean {
  return manifest.some((entry) => entry.path === path);
}

// DEC-503 amendment (w69-e): the phone sweep manifest is DERIVED, not
// hand-listed — every ROUTE_MANIFEST role:"public" row must have a
// MOBILE_ROUTE_MANIFEST counterpart (after substituting EVENT_SLUG ->
// MOBILE_EVENT_SLUG, which are the same literal seed slug today) unless its
// path is named here with a one-line reason. Never add a scheduling note
// ("owned by another branch") or a deferred-fix note ("needs a mobile pass")
// here — only a fact about the route itself, same convention as
// KNOWN_CLIP_EXCEPTIONS in scripts/render-sweep.ts.
const MOBILE_SWEEP_EXCLUDED: Readonly<Record<string, string>> = {
  // Chromeless drill-in twin of /e/<slug>/sessions/<id> — same content
  // module, already swept at 390x844 via that /e/ row.
  [`/embed/${EVENT_SLUG}/sessions/seed_submission_0001`]:
    `covered by /e/${MOBILE_EVENT_SLUG}/sessions/seed_submission_0001`,
  // Chromeless drill-in twin of /e/<slug>/speakers/<id> — same content
  // module, already swept at 390x844 via that /e/ row.
  [`/embed/${EVENT_SLUG}/speakers/seed_contact_0001`]:
    `covered by /e/${MOBILE_EVENT_SLUG}/speakers/seed_contact_0001`,
};

describe("render-sweep manifest parity across SURFACES (DEC-503)", () => {
  it("SURFACES is non-empty (sanity: this test would be vacuous otherwise)", () => {
    expect(SURFACES.length).toBeGreaterThan(0);
  });

  it("every SURFACES entry has an /e/<slug>/<surface> row in ROUTE_MANIFEST", () => {
    const missing = SURFACES.filter(
      (surface) => !hasPath(ROUTE_MANIFEST, `/e/${EVENT_SLUG}/${surface}`),
    );
    expect(missing, `missing /e/${EVENT_SLUG}/<surface> rows: ${missing.join(", ")}`).toEqual([]);
  });

  it("every SURFACES entry has an /embed/<slug>/<surface> row in ROUTE_MANIFEST", () => {
    const missing = SURFACES.filter(
      (surface) => !hasPath(ROUTE_MANIFEST, `/embed/${EVENT_SLUG}/${surface}`),
    );
    expect(missing, `missing /embed/${EVENT_SLUG}/<surface> rows: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("every SURFACES entry has an /e/<slug>/<surface> row in MOBILE_ROUTE_MANIFEST", () => {
    const missing = SURFACES.filter(
      (surface) => !hasPath(MOBILE_ROUTE_MANIFEST, `/e/${MOBILE_EVENT_SLUG}/${surface}`),
    );
    expect(
      missing,
      `missing /e/${MOBILE_EVENT_SLUG}/<surface> rows: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every SURFACES entry has an /embed/<slug>/<surface> row in MOBILE_ROUTE_MANIFEST", () => {
    const missing = SURFACES.filter(
      (surface) => !hasPath(MOBILE_ROUTE_MANIFEST, `/embed/${MOBILE_EVENT_SLUG}/${surface}`),
    );
    expect(
      missing,
      `missing /embed/${MOBILE_EVENT_SLUG}/<surface> rows: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("prints and asserts manifest surface coverage counts", () => {
    const embedRouteManifestCount = SURFACES.filter((surface) =>
      hasPath(ROUTE_MANIFEST, `/embed/${EVENT_SLUG}/${surface}`),
    ).length;
    const embedMobileManifestCount = SURFACES.filter((surface) =>
      hasPath(MOBILE_ROUTE_MANIFEST, `/embed/${MOBILE_EVENT_SLUG}/${surface}`),
    ).length;
    const eRouteManifestCount = SURFACES.filter((surface) =>
      hasPath(ROUTE_MANIFEST, `/e/${EVENT_SLUG}/${surface}`),
    ).length;
    const eMobileManifestCount = SURFACES.filter((surface) =>
      hasPath(MOBILE_ROUTE_MANIFEST, `/e/${MOBILE_EVENT_SLUG}/${surface}`),
    ).length;

    // eslint-disable-next-line no-console
    console.log(
      `[DEC-503] SURFACES=${SURFACES.length} ` +
        `ROUTE_MANIFEST(/e)=${eRouteManifestCount} ROUTE_MANIFEST(/embed)=${embedRouteManifestCount} ` +
        `MOBILE_ROUTE_MANIFEST(/e)=${eMobileManifestCount} MOBILE_ROUTE_MANIFEST(/embed)=${embedMobileManifestCount}`,
    );

    expect(eRouteManifestCount).toBe(SURFACES.length);
    expect(embedRouteManifestCount).toBe(SURFACES.length);
    expect(eMobileManifestCount).toBe(SURFACES.length);
    expect(embedMobileManifestCount).toBe(SURFACES.length);
  });

  it("every public ROUTE_MANIFEST row has a MOBILE_ROUTE_MANIFEST counterpart or a named MOBILE_SWEEP_EXCLUDED reason (DEC-503 amendment)", () => {
    const publicRoutes = ROUTE_MANIFEST.filter((entry) => entry.role === "public");
    expect(publicRoutes.length).toBeGreaterThan(0);

    const missing = publicRoutes
      .map((entry) => entry.path)
      .filter((path) => {
        const mobilePath = path.replaceAll(EVENT_SLUG, MOBILE_EVENT_SLUG);
        if (hasPath(MOBILE_ROUTE_MANIFEST, mobilePath)) return false;
        if (path in MOBILE_SWEEP_EXCLUDED) return false;
        return true;
      });

    expect(
      missing,
      `ROUTE_MANIFEST public routes with no MOBILE_ROUTE_MANIFEST counterpart and no MOBILE_SWEEP_EXCLUDED reason: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every MOBILE_SWEEP_EXCLUDED key is an actual public ROUTE_MANIFEST path (no stale exclusions)", () => {
    const publicPaths = new Set(ROUTE_MANIFEST.filter((entry) => entry.role === "public").map((entry) => entry.path));
    const stale = Object.keys(MOBILE_SWEEP_EXCLUDED).filter((path) => !publicPaths.has(path));
    expect(stale, `stale MOBILE_SWEEP_EXCLUDED entries (no longer in ROUTE_MANIFEST): ${stale.join(", ")}`).toEqual([]);
  });
});
