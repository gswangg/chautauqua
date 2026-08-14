// DEC-788 amendment (wave 8): DuplicateEmailNotice -- the shared 409
// duplicate-email forward path used by both NewContactModal and
// RosterPanel's Add-speaker. Resolves the existing contact by email,
// renders nothing on an empty/failed lookup, and (when addToEvent is
// supplied) posts /contacts/:id/add-to-event with the typed session title.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DuplicateEmailNotice } from './DuplicateEmailNotice';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGetMock(...args),
    apiPost: (...args: unknown[]) => apiPostMock(...args),
  };
});

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function renderNotice(props: Parameters<typeof DuplicateEmailNotice>[0]) {
  return render(
    <MemoryRouter>
      <DuplicateEmailNotice {...props} />
    </MemoryRouter>,
  );
}

describe('DuplicateEmailNotice', () => {
  it('resolves by email (case-insensitive) and links the contact', async () => {
    apiGetMock.mockResolvedValueOnce({
      items: [
        { id: 'ct-other', firstName: 'Someone', lastName: 'Else', email: 'other@example.com' },
        { id: 'ct-match', firstName: 'Priya', lastName: 'Raman', email: 'Priya@Example.com', company: 'Latticework' },
      ],
    });

    renderNotice({ email: 'priya@example.com' });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/contacts?q=priya%40example.com'));
    expect(await screen.findByText(/Priya Raman, Latticework/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open this contact' });
    expect(link).toHaveAttribute('href', '/contacts?openContact=ct-match');
  });

  it('renders nothing when the lookup is empty', async () => {
    apiGetMock.mockResolvedValueOnce({ items: [] });

    renderNotice({ email: 'nobody@example.com' });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when the lookup fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('boom'));

    renderNotice({ email: 'nobody@example.com' });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('posts add-to-event with the typed session title and role speaker, then calls onAdded', async () => {
    apiGetMock.mockResolvedValueOnce({
      items: [{ id: 'ct-match', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com' }],
    });
    apiPostMock.mockResolvedValueOnce({ id: 'sub-1' });
    const onAdded = vi.fn();

    renderNotice({
      email: 'priya@example.com',
      addToEvent: { eventId: 'evt-1', sessionTitle: '  Scaling Kubernetes  ', onAdded },
    });

    const addButton = await screen.findByRole('button', { name: 'Add Priya Raman to this event' });
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/contacts/ct-match/add-to-event', {
        eventId: 'evt-1',
        title: 'Scaling Kubernetes',
        role: 'speaker',
      }),
    );
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Priya Raman'));
  });
});
