// w6-g: docs/design/audit/speakers-v12.md finding 2 -- the filtered empty
// state must name the ONE facet responsible for excluding the roster, and
// offer to clear exactly that facet, but ONLY when exactly one facet is
// active. DESIGN-RULINGS B7 ("why in one clause when the reason is
// actionable") is satisfied by a single-facet clause; with zero or two-plus
// active facets the state cannot know which one is responsible, so it must
// fall back to the generic multi-facet caption (OnboardingGrid.tsx keeps
// that fallback -- this module only ever answers "exactly one" or null).
//
// The frame's person-name clause (Chautauqua Speakers.dc.html:442) comes
// from the SEARCH term the organiser typed, never a name synthesised from
// the roster -- so a reason with a name in it renders only for the 'q'
// facet, and echoes the typed string verbatim.
import { DEFAULT_GRID_FILTERS, INVITE_STATUS_LABELS, type GridFilterState } from './types';

type FacetKey = keyof GridFilterState;

interface FacetDef {
  /** Human label for the facet, used only for internal bookkeeping/tests. */
  label: string;
  isActive: (filters: GridFilterState) => boolean;
  /** `filters` is the full state (so a facet like inviteStatus can read its
   *  own value back off it); `typed` is the verbatim search string for the
   *  'q' facet and null for every other facet -- no facet but 'q' is ever
   *  handed free text. */
  reason: (filters: GridFilterState, typed: string | null) => string;
  escapeLabel: string;
  clear: (filters: GridFilterState) => GridFilterState;
}

// Record<keyof GridFilterState, FacetDef> is the exhaustiveness check: if
// GridFilterState (types.ts) ever grows a field, this object literal fails
// to compile until the new facet is given a definition here too -- no
// facet can silently sit outside the population this module enumerates.
const FACET_DEFS: Record<FacetKey, FacetDef> = {
  q: {
    label: 'search',
    isActive: (filters) => filters.q.trim().length > 0,
    reason: (_filters, typed) => `No speakers match "${typed}".`,
    escapeLabel: 'Clear the search ›',
    clear: (filters) => ({ ...filters, q: '' }),
  },
  taskId: {
    label: 'task',
    isActive: (filters) => filters.taskId !== null,
    reason: () => 'No speakers are assigned the selected task.',
    escapeLabel: 'Clear the task filter ›',
    clear: (filters) => ({ ...filters, taskId: null }),
  },
  status: {
    label: 'status',
    isActive: (filters) => filters.status !== null,
    reason: () => 'No speakers have a task in the selected status.',
    escapeLabel: 'Clear the status filter ›',
    clear: (filters) => ({ ...filters, status: null }),
  },
  overdueOnly: {
    label: 'overdue',
    isActive: (filters) => filters.overdueOnly,
    reason: () => 'No speakers have anything overdue. Clearing "Overdue only" finds the rest.',
    escapeLabel: 'Clear the overdue filter ›',
    clear: (filters) => ({ ...filters, overdueOnly: false }),
  },
  inviteStatus: {
    label: 'participation',
    // inviteStatus is non-null whenever this runs (isActive gated it) --
    // INVITE_STATUS_LABELS is the one shared vocabulary (DEC-789), never a
    // literal string per site.
    isActive: (filters) => filters.inviteStatus !== null,
    reason: (filters) =>
      `No speakers have participation marked ${INVITE_STATUS_LABELS[filters.inviteStatus as NonNullable<GridFilterState['inviteStatus']>].toLowerCase()}.`,
    escapeLabel: 'Clear the participation filter ›',
    clear: (filters) => ({ ...filters, inviteStatus: null }),
  },
};

// Enumerated from GridFilterState's own shape (via its default value)
// rather than hand-listed a second time here.
const FACET_KEYS = Object.keys(DEFAULT_GRID_FILTERS) as FacetKey[];

export interface ActiveFacet {
  key: string;
  label: string;
  reason: (typed: string | null) => string;
  escapeLabel: string;
  clear: (filters: GridFilterState) => GridFilterState;
}

/** Returns the single active facet, or null when zero or two-plus facets
 *  are active -- the caller must fall back to the generic multi-facet
 *  reason/escape in either of those cases, never guess. */
export function activeFacet(filters: GridFilterState): ActiveFacet | null {
  const activeKeys = FACET_KEYS.filter((key) => FACET_DEFS[key].isActive(filters));
  if (activeKeys.length !== 1) return null;
  const [key] = activeKeys as [FacetKey];
  const def = FACET_DEFS[key];
  return {
    key,
    label: def.label,
    reason: (typed) => def.reason(filters, typed),
    escapeLabel: def.escapeLabel,
    clear: def.clear,
  };
}
