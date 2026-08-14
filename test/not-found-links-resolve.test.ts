import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_NOT_FOUND_LINKS,
  ORGANIZER_NOT_FOUND_LINKS,
} from "../src/server/not-found";
import { matchesAdminRoute } from "../src/lib/admin-routes";

// w14-b: every 404-card footer link must point somewhere a real route
// serves. "/" and "/login" are Worker-level pages outside the /admin SPA
// mount; any "/admin/*" href must have its post-basename suffix match the
// SPA's own route manifest (src/lib/admin-routes.ts), the same table
// app/src/App.tsx renders <Route> elements from -- so a link added to
// either constant without a matching route fails this test instead of
// silently 404ing once a signed-in organiser clicks it.
const ALL_LINK_ARRAYS: ReadonlyArray<
  ReadonlyArray<{ href: string; label: string }>
> = [ANONYMOUS_NOT_FOUND_LINKS, ORGANIZER_NOT_FOUND_LINKS];

describe("404 card footer links resolve to a real route", () => {
  it("tripwire: both link arrays are non-empty", () => {
    for (const links of ALL_LINK_ARRAYS) {
      expect(links.length).toBeGreaterThan(0);
    }
  });

  for (const links of ALL_LINK_ARRAYS) {
    for (const link of links) {
      it(`"${link.label}" (${link.href}) resolves`, () => {
        if (link.href === "/" || link.href === "/login") {
          return;
        }
        expect(link.href.startsWith("/admin")).toBe(true);
        const suffix = link.href.slice("/admin".length);
        const normalised = suffix === "" ? "/" : suffix;
        expect(matchesAdminRoute(normalised)).toBe(true);
      });
    }
  }
});
