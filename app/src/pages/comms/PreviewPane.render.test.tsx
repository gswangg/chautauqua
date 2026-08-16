// DEC-912: the 'To' line's Scheduled/No slot flag names the talk's slot
// state unconditionally -- driven by item.scheduled, never gated on
// attachIcs. The two ics footnote blocks ('Calendar invite: …' / 'No slot
// yet — this recipient gets no calendar invite.') describe the ATTACHMENT
// and stay gated on attachIcs.
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
  ref: 'DFC-014',
  scheduled: true,
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
  ref: 'DFC-021',
  scheduled: false,
  subject: 'You are in!',
  text: 'See you there',
};

const WITH_FEEDBACK: RenderedRecipient = {
  contactId: 'c3',
  submissionId: 's3',
  email: 'radia@example.com',
  name: 'Radia Perlman',
  ref: 'DFC-041',
  scheduled: true,
  subject: 'You are in!',
  text: 'Congratulations on your session.\n\nGreat energy; clear structure.\n\nSee you there',
  vars: { feedback: 'Great energy; clear structure.' },
};

const WITH_HTML: RenderedRecipient = {
  contactId: 'c4',
  submissionId: 's4',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  ref: 'DFC-055',
  scheduled: false,
  subject: 'You are in!',
  text: 'See you there',
  html: '<!doctype html><html><body>See you there</body></html>',
};

describe('PreviewPane: rendered HTML preview (DEC-037 amendment)', () => {
  it('renders a sandboxed iframe carrying srcDoc when item.html is present', () => {
    const { container } = render(<PreviewPane item={WITH_HTML} />);
    const iframe = container.querySelector('iframe.chq-comms-preview-frame');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('sandbox', '');
    expect(iframe).toHaveAttribute('srcDoc', WITH_HTML.html);
  });

  it('still renders the plain-text path (including the feedback block) under a disclosure when html is present', () => {
    const withHtmlAndFeedback: RenderedRecipient = { ...WITH_HTML, ...WITH_FEEDBACK, html: WITH_HTML.html };
    render(<PreviewPane item={withHtmlAndFeedback} />);
    expect(screen.getByText('Plain text')).toBeInTheDocument();
    expect(screen.getByText('Reviewer feedback, merged')).toBeInTheDocument();
  });

  it('falls back to the plain-text body with no iframe when item.html is absent', () => {
    const { container } = render(<PreviewPane item={SCHEDULED} />);
    expect(container.querySelector('iframe.chq-comms-preview-frame')).toBeNull();
    expect(screen.getByText('See you there')).toBeInTheDocument();
  });
});

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

describe('PreviewPane: To-line scheduled flag is unconditional (DEC-912)', () => {
  it('shows Scheduled for a scheduled recipient even when attachIcs was never requested', () => {
    render(<PreviewPane item={SCHEDULED} />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('shows No slot for an unscheduled recipient even when attachIcs was never requested', () => {
    render(<PreviewPane item={NO_SLOT} />);
    expect(screen.getByText('No slot')).toBeInTheDocument();
  });

  it('keeps showing Scheduled/No slot when attachIcs IS set (flag unaffected by the toggle)', () => {
    render(<PreviewPane item={SCHEDULED} attachIcs />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });
});

describe('PreviewPane: attachIcs honesty (DEC-732) -- the ics footnote blocks describe the attachment', () => {
  it('shows the invite line for a recipient with a resolved slot', () => {
    render(<PreviewPane item={SCHEDULED} attachIcs />);
    expect(screen.getByText(/Calendar invite:/)).toBeInTheDocument();
  });

  it('shows the no-invite footnote for a recipient with no resolved slot', () => {
    render(<PreviewPane item={NO_SLOT} attachIcs />);
    expect(screen.queryByText(/Calendar invite:/)).not.toBeInTheDocument();
    expect(screen.getByText(/gets no calendar invite/)).toBeInTheDocument();
  });

  it('shows neither footnote block when attachIcs was never requested', () => {
    render(<PreviewPane item={NO_SLOT} />);
    expect(screen.queryByText(/Calendar invite:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gets no calendar invite/)).not.toBeInTheDocument();
  });

  it('shows no note for a scheduled recipient whose ics has not resolved yet (stale attachment payload)', () => {
    const scheduledNoIcs: RenderedRecipient = { ...SCHEDULED, ics: undefined };
    render(<PreviewPane item={scheduledNoIcs} attachIcs />);
    expect(screen.queryByText(/Calendar invite:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gets no calendar invite/)).not.toBeInTheDocument();
  });

  it('shows the no-invite note for an unscheduled recipient', () => {
    render(<PreviewPane item={NO_SLOT} attachIcs />);
    expect(screen.getByText(/gets no calendar invite/)).toBeInTheDocument();
  });
});

// wave-60 amendment (DEC-238, P1 cluster 4): src/routes/comms/preview.ts
// stamps each item with its own willSend/skipReason disposition specifically
// so this component can render a per-row skip badge without re-deriving the
// dedupe decision client-side -- this locks that the badge actually renders,
// with the same reason wording the send-report's skipped list uses.
describe('PreviewPane: per-item skip badge (DEC-238 wave-60 amendment)', () => {
  const DUPLICATE_IN_BATCH: RenderedRecipient = {
    ...NO_SLOT,
    willSend: false,
    skipReason: 'duplicate_in_batch',
  };

  const ALREADY_SENT: RenderedRecipient = {
    ...NO_SLOT,
    willSend: false,
    skipReason: 'already_sent_recently',
    retryAtIso: '2028-05-11T15:00:00.000Z',
  };

  it('shows no skip badge for a recipient this render will actually send to', () => {
    render(<PreviewPane item={{ ...NO_SLOT, willSend: true }} />);
    expect(screen.queryByText(/Won.t be sent/)).not.toBeInTheDocument();
  });

  it("shows 'Won't be sent' with the duplicate-in-batch reason", () => {
    render(<PreviewPane item={DUPLICATE_IN_BATCH} />);
    expect(screen.getByText(/Won.t be sent/)).toBeInTheDocument();
    expect(screen.getByText(/Same message, same address, already in this batch\./)).toBeInTheDocument();
  });

  it("shows 'Won't be sent' with the already-sent-recently reason", () => {
    render(<PreviewPane item={ALREADY_SENT} />);
    expect(screen.getByText(/Won.t be sent/)).toBeInTheDocument();
    expect(screen.getByText(/Already sent within the hour\./)).toBeInTheDocument();
  });
});
