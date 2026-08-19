// SPEC §10 #3 (DEC-441): pure component test for the bulk-remind review
// dialog -- it shows the recipient count, each recipient's email, and the
// first draft's rendered text, then either sends (calling onSend) or
// cancels (calling onCancel) without ever sending on its own.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RemindPreviewModal } from './RemindPreviewModal';
import type { ReminderDraft } from './types';

const DRAFTS: ReminderDraft[] = [
  {
    contactId: 'contact_1',
    email: 'priya@example.com',
    name: 'Priya Raman',
    subject: 'Action needed: outstanding tasks for DevFlow Conf 2027',
    text: 'You have outstanding tasks for DevFlow Conf 2027:\n- Hotel stay requirement form — due Mon, Mar 01, 2027',
  },
  {
    contactId: 'contact_2',
    email: 'jamal@example.com',
    name: 'Jamal Okoye',
    subject: 'Action needed: outstanding tasks for DevFlow Conf 2027',
    text: 'You have outstanding tasks for DevFlow Conf 2027:\n- Speaker agreement — No due date',
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RemindPreviewModal (SPEC §10 #3, DEC-441)', () => {
  it('shows a loading state before drafts arrive', () => {
    render(
      <RemindPreviewModal
        loading={true}
        error={null}
        drafts={null}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Review these reminders' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  it('lists recipient count, emails, and the first draft text, and calls onSend on click', () => {
    const onSend = vi.fn();
    render(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={DRAFTS}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={onSend}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('2 recipients')).toBeInTheDocument();
    expect(screen.getByText(/priya@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/jamal@example\.com/)).toBeInTheDocument();
    expect(
      screen.getByText(/Hotel stay requirement form — due Mon, Mar 01, 2027/),
    ).toBeInTheDocument();
    // Second recipient's draft is not shown -- only the first draft renders.
    expect(screen.queryByText(/Speaker agreement — No due date/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send these 2' }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Cancel click and never calls onSend itself', () => {
    const onSend = vi.fn();
    const onCancel = vi.fn();
    render(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={DRAFTS}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={onSend}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('surfaces a send error loudly instead of closing silently', () => {
    render(
      <RemindPreviewModal
        loading={false}
        error="Send failed: mailer outage"
        drafts={DRAFTS}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Send failed: mailer outage')).toBeInTheDocument();
  });

  it('disables Send with zero recipients', () => {
    render(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={[]}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Send these 0' })).toBeDisabled();
  });

  // DEC-829 amendment: the modal prints the server's own skipped figure
  // verbatim -- never recomputed here -- so it can never claim a different
  // number than the send actually performs.
  it('prints the server-supplied skipped count when greater than zero, and omits the line at zero', () => {
    const { rerender } = render(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={DRAFTS}
        skipped={3}
        remaining={0}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('3 contacts skipped — reminded in the last hour')).toBeInTheDocument();

    rerender(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={DRAFTS}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();
  });

  // DEC-441 amendment (w52-a): the review dialog names the batch-cap
  // remainder in the same sentence family the send toast (sendResult.ts)
  // uses, so the organizer knows the preview does not cover the whole
  // outstanding population before they click Send.
  it('prints the server-supplied remaining count when greater than zero, and omits the line at zero', () => {
    const { rerender } = render(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={DRAFTS}
        skipped={0}
        remaining={4}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('4 contacts still outstanding — run it again to continue.')).toBeInTheDocument();

    rerender(
      <RemindPreviewModal
        loading={false}
        error={null}
        drafts={DRAFTS}
        skipped={0}
        remaining={0}
        sending={false}
        onSend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText(/still outstanding/)).not.toBeInTheDocument();
  });

  // DEC-829 amendment (w61-e): a loaded, empty drafts array is never the
  // bare <ul> + "0 recipients" subtitle -- one sentence names its own
  // emptiness, and which sentence depends on WHY (skipped vs never
  // outstanding).
  describe('DEC-829 amendment (w61-e): zero-state sentence', () => {
    it('names the deduped-skip reason when skipped > 0', () => {
      render(
        <RemindPreviewModal
          loading={false}
          error={null}
          drafts={[]}
          skipped={3}
          remaining={0}
          sending={false}
          onSend={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(
        screen.getByText('Nobody to remind right now — 3 contacts reminded in the last hour.'),
      ).toBeInTheDocument();
      // The old empty-list + recipient-count subtitle is gone.
      expect(screen.queryByText('0 recipients')).not.toBeInTheDocument();
      expect(document.querySelector('.chq-speakers-remind-recipients')).not.toBeInTheDocument();
      // Send stays present but disabled -- its action is genuinely inert.
      expect(screen.getByRole('button', { name: 'Send these 0' })).toBeDisabled();
    });

    it('names "nothing outstanding" when skipped is zero too', () => {
      render(
        <RemindPreviewModal
          loading={false}
          error={null}
          drafts={[]}
          skipped={0}
          remaining={0}
          sending={false}
          onSend={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByText('Nothing outstanding to remind about.')).toBeInTheDocument();
      expect(screen.queryByText('0 recipients')).not.toBeInTheDocument();
      expect(document.querySelector('.chq-speakers-remind-recipients')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send these 0' })).toBeDisabled();
    });

    it('keeps the remaining line even in the zero-draft state', () => {
      render(
        <RemindPreviewModal
          loading={false}
          error={null}
          drafts={[]}
          skipped={0}
          remaining={2}
          sending={false}
          onSend={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByText('Nothing outstanding to remind about.')).toBeInTheDocument();
      expect(screen.getByText('2 contacts still outstanding — run it again to continue.')).toBeInTheDocument();
    });
  });
});
