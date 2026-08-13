// DEC-830: "Participation status is a MENU of named states, each stating its
// consequence; the portal invite is an ACTION in that menu, not a state it
// writes" -- replaces OnboardingGrid's old cycle-on-click invite-status
// control (docs/design/README.md:287-291, 313-315, frame
// 04-speakers--05-participation-open). A real <button> with a caret opens a
// menu of the four named InviteStatus states plus one action item; selecting
// a state hands the choice back to OnboardingGrid, which owns the optimistic
// PATCH + rollback (the file's established pattern -- see toggleInviteStatus
// callers). The action item never patches a status; it only triggers the
// existing sendPortalInvite send.
import { useState } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { DEC_830 } from '../../../../src/decisions';
import { INVITE_STATUS_LABELS, INVITE_STATUSES, type InviteStatus } from './types';

// Compile-checked dependency marker (DEC-830).
void DEC_830;

// DEC-789/DEC-730: one control family, four modifiers -- filled olive =
// Confirmed, outlined = Invited, ink-outlined caps = Declined, dashed = Not
// invited (the new "no state chosen yet" mark; the other three already
// existed in speakers.css for the task cells).
export function participationStatusClass(status: InviteStatus): string {
  const modifier =
    status === 'accepted' ? 'complete' : status === 'declined' ? 'overdue' : status === 'invited' ? 'pending' : 'none';
  return `chq-speakers-status chq-speakers-status-${modifier}`;
}

export const PARTICIPATION_CONSEQUENCE_CAPTION =
  'Invited and Declined hide this speaker from the public pages and pause their uploads';

export const PARTICIPATION_FOOTER_CAPTION =
  'Only Send portal invite sends anything — the other three record what you already know';

interface ParticipationMenuProps {
  contactName: string;
  status: InviteStatus;
  onSelectStatus: (status: InviteStatus) => void;
  onSendInvite: () => void;
  sendInviteDisabled?: boolean;
}

export function ParticipationMenu({ contactName, status, onSelectStatus, onSendInvite, sendInviteDisabled }: ParticipationMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEscapeKey(open, close);

  return (
    <div className="chq-participation-menu">
      <button
        type="button"
        className={`${participationStatusClass(status)} chq-participation-menu-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Participation status for ${contactName}: ${INVITE_STATUS_LABELS[status]}`}
        onClick={() => setOpen((v) => !v)}
      >
        {INVITE_STATUS_LABELS[status]} <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="chq-participation-menu-panel" role="menu" aria-label={`Participation status for ${contactName}`}>
          <p className="chq-participation-menu-caption">{PARTICIPATION_CONSEQUENCE_CAPTION}</p>
          {INVITE_STATUSES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="menuitem"
              className={`chq-participation-menu-item${candidate === status ? ' is-current' : ''}`}
              onClick={() => {
                close();
                onSelectStatus(candidate);
              }}
            >
              {INVITE_STATUS_LABELS[candidate]}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="chq-participation-menu-item chq-participation-menu-action"
            onClick={() => {
              close();
              onSendInvite();
            }}
            disabled={sendInviteDisabled}
          >
            Send portal invite
          </button>
          <p className="chq-participation-menu-footer">{PARTICIPATION_FOOTER_CAPTION}</p>
        </div>
      )}
    </div>
  );
}
