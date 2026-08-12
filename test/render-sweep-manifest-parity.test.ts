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
});
