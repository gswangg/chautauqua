// Docs group vocabulary (v12 intake section B, DEC-613 amendment wave 2).
// DOCS_GROUP_META is the ONE owner of the docs index's role-group display
// labels and blurbs — every renderer (the /docs shell, any future nav, the
// phone article header) must import from here rather than re-spelling the
// six labels, or the DEC-613 duplicate-vocabulary guard in
// test/docs-group-vocabulary.test.ts fails loudly.

import type { DocsGroupId } from "./types";

export interface DocsGroupMeta {
  label: string;
  blurb: string;
}

export const DOCS_GROUP_META: Record<DocsGroupId, DocsGroupMeta> = {
  "getting-started": {
    label: "Getting started",
    blurb: "For anyone new to Chautauqua who needs the lay of the land first.",
  },
  "running-an-event": {
    label: "Running an event",
    blurb: "For organizers setting up and steering an event day to day.",
  },
  "your-contacts": {
    label: "Your contacts",
    blurb: "For organizers managing the people connected to their events.",
  },
  "for-reviewers": {
    label: "For reviewers",
    blurb: "For reviewers scoring and discussing submissions on a plan.",
  },
  "for-speakers": {
    label: "For speakers",
    blurb: "For speakers navigating their portal, tasks, and profile.",
  },
  "running-the-software": {
    label: "Running the software",
    blurb: "For operators keeping the deployment itself running.",
  },
};

// The API reference is TOOLS_CSS chrome (DEC-382) — this design does not
// revise that, so the seam from the docs index to /docs/api is named rather
// than hidden. The LABEL names the destination ("API reference", same as
// the design reference's own row name, Chautauqua Docs.dc.html:436) and the
// ↗ leaving mark plus the row's blurb (src/routes/docs-site.tsx) carry the
// seam — a reader scanning the link text should learn what opens, not read
// a warning with no noun in it. User-filed: '"Leave the docs an operator
// surface" is weird. please make the link more plainly descriptive.'
export const DOCS_API_LEAVING_LINK = {
  href: "/docs/api",
  label: "API reference",
} as const;
