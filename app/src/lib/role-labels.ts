// Role display-label vocabulary owner (DEC-613 wave-27 amendment).
//
// SCOPE: DISPLAY COPY ONLY. The role enum stays `organizer` on the wire --
// every API body, DB column, route path, requireOrganizer/viewerIsOrganizer
// identifier, seeded email and test fixture NAME is untouched. This module
// only owns the human-facing LABEL: the v12 pack draws this role in the
// British register only (`Organiser`/`Organisers` -- Chautauqua
// Settings.dc.html's People-and-roles role pill and role select, Chautauqua
// Home.dc.html, Chautauqua Docs.dc.html) and never once in the American
// register, so the product's display copy follows the pack's spelling.
//
// ONE owner: this used to be declared twice (PeopleRolesPanel.tsx's
// ROLE_LABELS, CommentThread.tsx's COMMENT_ROLE_LABELS) -- both now import
// this single map instead of keeping their own copy (DEC-613: a code-side
// second copy of a vocabulary is exactly the failure this decision names).
//
// Deliberately named `role-labels.ts`, not `role-vocabulary.ts` and not
// placed under src/domain as `role-copy.ts` -- test/helpers/
// composed-label-resolve.ts readdirSync-discovers exactly those two shapes
// (`app/src/lib/*-vocabulary.ts`, `src/domain/*-copy.ts`) as a population
// two sibling ledgers are measuring; a new member there would silently move
// their ceilings.
import { capitalizeFirst } from '../../../src/domain/count-copy';
import { DEC_613 } from '../../../src/decisions';

void DEC_613; // this module is the ONE owner of the role display-label vocabulary the wave-27 amendment requires -- PeopleRolesPanel.tsx and CommentThread.tsx both import roleLabel() instead of keeping their own copy, and the British spelling below matches the v12 pack's own register.

export const ROLE_LABELS: Record<string, string> = { organizer: 'Organiser', reviewer: 'Reviewer' };

// DEC-910: a role is reported as itself -- never a hand-written
// complementary predicate that could silently absorb a third role (e.g. a
// speaker with a portal account) into "reviewer".
export function roleLabel(role: string): string {
  const known = ROLE_LABELS[role];
  if (known) return known;
  return capitalizeFirst(role);
}
