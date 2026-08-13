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
import { useMenu } from '../../lib/useMenu';
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

// DEC-869: the participation menu names each state's consequence -- a Record
// keyed by every InviteStatus so a fifth state cannot ship caption-less.
export const PARTICIPATION_STATE_CAPTIONS: Record<InviteStatus, string> = {
  none: 'Nothing has been sent. They still appear on the public pages.',
  invited: 'Records that the invite went out. Hidden from the public pages until they confirm.',
  accepted: 'Public pages and uploads are open.',
  declined: 'Hidden from the public pages, uploads paused.',
};

export const PARTICIPATION_FOOTER_CAPTION =
  'Only Send portal invite sends anything — the other three record what you already know';

interface ParticipationMenuProps {
  contactName: string;
  status: InviteStatus;
  onSelectStatus: (status: InviteStatus) => void;
  onSendInvite: () => void;
  sendInviteDisabled?: boolean;
  // DEC-936: when a contact carries more than one participation on this
  // roster row, OnboardingGrid renders one menu per session, each labelled
  // with THAT session's ref -- never a single menu ambiguous about which
  // participation it writes.
  label?: string;
  // Amendment (wave 48)/DEC-694: the v6 frame's panel header identity is
  // more than the bare name -- it names the contact's company and whether
  // they already hold a portal account, so the menu's four state choices
  // (esp. the account-dependent ones) are read against that context instead
  // of a blank name. Threaded from the roster row the caller already has --
  // this component never fetches.
  company?: string | null;
  hasAccount: boolean;
}

export function ParticipationMenu({
  contactName,
  status,
  onSelectStatus,
  onSendInvite,
  sendInviteDisabled,
  label,
  company,
  hasAccount,
}: ParticipationMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { containerRef, onPanelKeyDown } = useMenu(open, close);
  const identity = label ? `${contactName} — ${label}` : contactName;

  return (
    <div className="chq-participation-menu" ref={containerRef}>
      {label && <span className="chq-participation-menu-ref">{label}</span>}
      <button
        type="button"
        className={`${participationStatusClass(status)} chq-participation-menu-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Participation status for ${identity}: ${INVITE_STATUS_LABELS[status]}`}
        onClick={() => setOpen((v) => !v)}
      >
        {INVITE_STATUS_LABELS[status]} <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          className="chq-participation-menu-panel"
          role="menu"
          aria-label={`Participation status for ${identity}`}
          onKeyDown={onPanelKeyDown}
        >
          <p className="chq-participation-menu-identity">{identity}</p>
          <p className="chq-participation-menu-identity-sub">
            {company ?? '—'} &middot; {hasAccount ? 'has account' : 'no portal account'}
          </p>
          {INVITE_STATUSES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="menuitemradio"
              aria-checked={candidate === status}
              className={`chq-participation-menu-item${candidate === status ? ' is-current' : ''}`}
              onClick={() => {
                close();
                onSelectStatus(candidate);
              }}
            >
              <span className="chq-participation-menu-item-label">
                {INVITE_STATUS_LABELS[candidate]}
                {candidate === status && <span className="chq-participation-menu-now">NOW</span>}
              </span>
              <span className="chq-participation-menu-item-caption">{PARTICIPATION_STATE_CAPTIONS[candidate]}</span>
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
