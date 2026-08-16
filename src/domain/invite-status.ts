// Invite-status vocabulary (DEC-789 wave-73 amendment). ONE set and ONE
// label map, shared by every consumer that previously kept its own copy:
//   - src/routes/tasks.ts (onboarding grid filter validation)
//   - src/routes/api/submissions.ts (PATCH participant invite_status write)
//   - src/server/repo/portal/invitations.ts (InviteStatus alias)
//   - src/server/repo/tasks/grid.ts (GridInviteStatus alias)
//   - app/src/pages/speakers/types.ts (re-export)
//   - app/src/pages/submissions/types.ts (re-export)
//   - app/src/pages/submissions/SubmissionDetailPage.tsx (InviteStatusChip)
// Pure core (DEC-002): no node:/cloudflare/drizzle imports.
import { DEC_789 } from '../decisions';

void DEC_789; // wave-73 amendment: one shared invite-status vocabulary + label map, not six copies

export const INVITE_STATUSES = ['none', 'invited', 'accepted', 'declined'] as const;

export type InviteStatus = (typeof INVITE_STATUSES)[number];

export function isInviteStatus(value: string): value is InviteStatus {
  return (INVITE_STATUSES as readonly string[]).includes(value);
}

// DEC-789 wave-73: the roster vocabulary wins over the submission-detail
// page's private 'None'/'Accepted' map -- it has five call sites, and
// 'Accepted' collides with the submission decision word (STATUS_LABELS.accepted)
// on the one page that used it.
export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  none: 'Not invited',
  invited: 'Invited',
  accepted: 'Confirmed',
  declined: 'Declined',
};
