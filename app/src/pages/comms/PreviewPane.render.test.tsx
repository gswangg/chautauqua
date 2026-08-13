// DEC-732 (eval-findings 44d/68): the preview must equal what send() will
// actually do -- when attachIcs is set, every recipient card says SCHEDULED
// or NO SLOT, not just recipients who happen to have a resolved slot.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PreviewPane } from './PreviewPane';
import type { RenderedRecipient } from './types';

afterEach(() => {
  cleanup();
});

const SCHEDULED: RenderedRecipient = {
  contactId: 'c1',
  submissionId: 's1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  subject: 'You are in!',
  text: 'See you there',
  ics: {
    startUtc: '2028-05-11T14:00:00.000Z',
    endUtc: '2028-05-11T14:30:00.000Z',
    room: 'Hall A',
    sequence: 0,
    timeZone: 'America/Chicago',
  },
};

const NO_SLOT: RenderedRecipient = {
  contactId: 'c2',
  submissionId: 's2',
  email: 'grace@example.com',
  name: 'Grace Hopper',
  subject: 'You are in!',
  text: 'See you there',
};

const WITH_FEEDBACK: RenderedRecipient = {
  contactId: 'c3',
  submissionId: 's3',
  email: 'radia@example.com',
  name: 'Radia Perlman',
  subject: 'You are in!',
  text: 'Congratulations on your session.\n\nGreat energy; clear structure.\n\nSee you there',
  vars: { feedback: 'Great energy; clear structure.' },
};

describe('PreviewPane: merged reviewer feedback block (DEC-883)', () => {
  it('renders the eyebrow and blockquote when vars.feedback is present and matches a paragraph', () => {
    render(<PreviewPane item={WITH_FEEDBACK} />);
    expect(screen.getByText('Reviewer feedback, merged')).toBeInTheDocument();
    const quote = screen.getByText('Great energy; clear structure.').closest('blockquote');
    expect(quote).toHaveClass('chq-comms-feedback');
  });

  it('renders the plain body with no blockquote when vars.feedback is absent', () => {
    render(<PreviewPane item={SCHEDULED} />);
    expect(screen.queryByText('Reviewer feedback, merged')).not.toBeInTheDocument();
    expect(screen.getByText('See you there')).toBeInTheDocument();
  });
});

describe('PreviewPane: attachIcs honesty (DEC-732)', () => {
  it('tags a recipient with a resolved slot as Scheduled and shows the invite line', () => {
    render(<PreviewPane item={SCHEDULED} attachIcs />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText(/Calendar invite:/)).toBeInTheDocument();
  });

  it('tags a recipient with no resolved slot as No slot and says so instead of the invite line', () => {
    render(<PreviewPane item={NO_SLOT} attachIcs />);
    expect(screen.getByText('No slot')).toBeInTheDocument();
    expect(screen.queryByText(/Calendar invite:/)).not.toBeInTheDocument();
    expect(screen.getByText(/gets no calendar invite/)).toBeInTheDocument();
  });

  it('shows no scheduling tag at all when attachIcs was never requested', () => {
    render(<PreviewPane item={NO_SLOT} />);
    expect(screen.queryByText('No slot')).not.toBeInTheDocument();
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
  });
});
