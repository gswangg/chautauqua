// DEC-290 (task-w9-b), restyled per DEC-662 (task-w11-a): render smoke for
// RosterPanel -- the SPK-01/02/03 add-speaker + import-CSV UI on
// /admin/speakers. RosterPanel is now a controlled panel (its own trigger
// buttons moved into OnboardingGrid's title action row) -- `mode` says
// which body is open. Mocks the api module directly (RosterPanel +
// ImportWizard both call it) rather than stubbing fetch, so we can assert
// on the exact call args (eventId threading).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { RosterPanel } from './RosterPanel';
import { ApiError } from '../../lib/api';

const EVENT_ID = 'evt-roster-render';

const apiPostMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiPost: (...args: unknown[]) => apiPostMock(...args),
    apiGet: (...args: unknown[]) => apiGetMock(...args),
  };
});

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  apiPostMock.mockReset();
  apiGetMock.mockReset();
  apiGetMock.mockResolvedValue({ items: [] });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderPanel(props: { mode: 'none' | 'add' | 'import'; onClose: () => void; onChanged: () => void }) {
  return render(panelTree(props));
}

function panelTree(props: { mode: 'none' | 'add' | 'import'; onClose: () => void; onChanged: () => void }) {
  return (
    <MemoryRouter>
      <RosterPanel {...props} />
    </MemoryRouter>
  );
}

function fillAddForm() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText(/Session title/), { target: { value: 'Analytical Engines at Scale' } });
}

describe('RosterPanel', () => {
  it('renders nothing when mode is none and there is no toast', () => {
    renderPanel({ mode: 'none', onClose: vi.fn(), onChanged: vi.fn() });
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts eventId when adding a speaker, then closes and notifies onChanged', async () => {
    apiPostMock.mockResolvedValueOnce({ id: 'ct-new' });
    const onChanged = vi.fn();
    const onClose = vi.fn();

    renderPanel({ mode: 'add', onClose, onChanged });

    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(apiPostMock).toHaveBeenCalledWith(
      '/contacts',
      expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        eventId: EVENT_ID,
        // DEC-810: the server requires a session title with eventId; the
        // form must send it or every add fails with a 400.
        sessionTitle: 'Analytical Engines at Scale',
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the add-speaker form as a dialog, closed by Escape', () => {
    const onClose = vi.fn();
    renderPanel({ mode: 'add', onClose, onChanged: vi.fn() });

    expect(screen.getByRole('dialog', { name: /Add speaker/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the import wizard scoped to the current event when mode is import', () => {
    renderPanel({ mode: 'import', onClose: vi.fn(), onChanged: vi.fn() });
    expect(screen.getByRole('dialog', { name: 'Import contacts' })).toBeInTheDocument();
  });

  it('renders an error banner and does not call onChanged/onClose when adding fails', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(409, 'conflict', 'A contact with that email already exists.'));
    const onChanged = vi.fn();
    const onClose = vi.fn();

    renderPanel({ mode: 'add', onClose, onChanged });

    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    expect(await screen.findByText('A contact with that email already exists.')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // DEC-958 amendment (wave 58): a fields-map 400 renders the ErrorSummary
  // (heading + one anchor per problem, each pointing at the offending
  // input's own id), marks every offending control chq-field-invalid, and
  // never resets the user's typed values.
  describe('field-scoped 400 (DEC-958 amendment, wave 58)', () => {
    it('renders the summary heading, per-field anchors, invalid controls, and keeps typed values', async () => {
      apiPostMock.mockRejectedValueOnce(
        new ApiError(400, 'invalid', 'Validation failed', {
          firstName: 'required',
          email: 'must be a valid email address',
        }),
      );

      renderPanel({ mode: 'add', onClose: vi.fn(), onChanged: vi.fn() });
      fillAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

      // Heading counts exactly two problems.
      expect(await screen.findByText('Two things need fixing before this speaker can be added')).toBeInTheDocument();

      // One anchor per problem, each pointing at the offending input's own id.
      const firstNameAnchor = screen.getByRole('link', { name: 'First name' });
      expect(firstNameAnchor).toHaveAttribute('href', '#roster-first-name');
      const emailAnchor = screen.getByRole('link', { name: 'Email' });
      expect(emailAnchor).toHaveAttribute('href', '#roster-email');

      // Both offending inputs carry chq-field-invalid + aria-invalid.
      const firstNameInput = screen.getByLabelText('First name');
      const emailInput = screen.getByLabelText('Email');
      expect(firstNameInput).toHaveClass('chq-field-invalid');
      expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput).toHaveClass('chq-field-invalid');
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');

      // A field that was NOT named in err.fields stays untouched.
      const lastNameInput = screen.getByLabelText('Last name');
      expect(lastNameInput).not.toHaveClass('chq-field-invalid');

      // Nothing was reset: the user's typed values survive the refusal.
      expect((firstNameInput as HTMLInputElement).value).toBe('Ada');
      expect((emailInput as HTMLInputElement).value).toBe('ada@example.com');
      expect((lastNameInput as HTMLInputElement).value).toBe('Lovelace');
    });
  });

  // DEC-788 amendment (wave 8): the shared DuplicateEmailNotice forward path.
  describe('duplicate-email 409 forward path (DEC-788 amendment, wave 8)', () => {
    it('renders the existing person + open link + add-to-event affordance', async () => {
      apiPostMock.mockRejectedValueOnce(new ApiError(409, 'conflict', 'Priya Raman already uses this email'));
      apiGetMock.mockImplementation((path: string) => {
        if (path.startsWith('/contacts?q=')) {
          return Promise.resolve({
            items: [{ id: 'ct-existing', firstName: 'Priya', lastName: 'Raman', email: 'ada@example.com', company: 'Latticework' }],
          });
        }
        return Promise.resolve({ items: [] });
      });

      renderPanel({ mode: 'add', onClose: vi.fn(), onChanged: vi.fn() });
      fillAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

      expect(await screen.findByText('Priya Raman already uses this email')).toBeInTheDocument();
      const openLink = await screen.findByRole('link', { name: 'Open this contact' });
      expect(openLink).toHaveAttribute('href', '/contacts?openContact=ct-existing');
      expect(screen.getByRole('button', { name: 'Add Priya Raman to this event' })).toBeInTheDocument();
    });

    it('posts add-to-event with the typed session title and closes on success', async () => {
      apiPostMock.mockImplementation((path: string) => {
        if (path === '/contacts') {
          return Promise.reject(new ApiError(409, 'conflict', 'Priya Raman already uses this email'));
        }
        if (path === '/contacts/ct-existing/add-to-event') {
          return Promise.resolve({ id: 'sub-1' });
        }
        throw new Error(`unexpected apiPost ${path}`);
      });
      apiGetMock.mockImplementation((path: string) => {
        if (path.startsWith('/contacts?q=')) {
          return Promise.resolve({
            items: [{ id: 'ct-existing', firstName: 'Priya', lastName: 'Raman', email: 'ada@example.com' }],
          });
        }
        return Promise.resolve({ items: [] });
      });
      const onChanged = vi.fn();
      const onClose = vi.fn();

      renderPanel({ mode: 'add', onClose, onChanged });
      fillAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

      const addButton = await screen.findByRole('button', { name: 'Add Priya Raman to this event' });
      fireEvent.click(addButton);

      await waitFor(() =>
        expect(apiPostMock).toHaveBeenCalledWith('/contacts/ct-existing/add-to-event', {
          eventId: EVENT_ID,
          title: 'Analytical Engines at Scale',
          role: 'speaker',
        }),
      );
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(onClose).toHaveBeenCalled();
    });
  });

  // Eval finding (wave-5 retest): the dialog is mount-gated on mode === 'add',
  // so closing it discards the whole attempt. Before that, its state sat on
  // the always-mounted RosterPanel and survived the close: reopening to type
  // Marcus Okafor still showed Ada's typed values, Priya Raman's 409 banner
  // and Priya's duplicate hint.
  describe('close and reopen', () => {
    it('starts clean: no typed values, no 409 banner, no duplicate hint', async () => {
      apiPostMock.mockRejectedValue(new ApiError(409, 'conflict', 'Priya Raman already uses this email'));
      apiGetMock.mockImplementation((path: string) => {
        if (path.startsWith('/contacts/duplicates/check')) {
          return Promise.resolve({
            items: [
              {
                id: 'ct-existing',
                firstName: 'Priya',
                lastName: 'Raman',
                email: 'ada@example.com',
                company: 'Latticework',
                reason: 'email',
              },
            ],
          });
        }
        if (path.startsWith('/contacts?q=')) {
          return Promise.resolve({
            items: [
              { id: 'ct-existing', firstName: 'Priya', lastName: 'Raman', email: 'ada@example.com', company: 'Latticework' },
            ],
          });
        }
        return Promise.resolve({ items: [] });
      });

      const onClose = vi.fn();
      const onChanged = vi.fn();
      const { rerender } = renderPanel({ mode: 'add', onClose, onChanged });

      fillAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

      // The full stale set is on screen before the close: the 409 banner, the
      // forward-path notice it renders, and the debounced duplicate hint.
      expect(await screen.findByText('Priya Raman already uses this email')).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Open this contact' })).toBeInTheDocument();
      expect(await screen.findByText(/Possible duplicate:/)).toBeInTheDocument();

      // Cancel / Escape / scrim all land on the same onClose the page turns
      // into mode 'none'.
      rerender(panelTree({ mode: 'none', onClose, onChanged }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(panelTree({ mode: 'add', onClose, onChanged }));

      expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Last name') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Session title/) as HTMLInputElement).value).toBe('');
      expect(screen.queryByText('Priya Raman already uses this email')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open this contact' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Possible duplicate:/)).not.toBeInTheDocument();

      // ...and stays clean: an empty form never re-runs the duplicate check,
      // so nothing can arrive late and repaint the stale hint.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryByText(/Possible duplicate:/)).not.toBeInTheDocument();
    });
  });
});
