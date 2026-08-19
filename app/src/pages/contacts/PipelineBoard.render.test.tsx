// DEC-144/DEC-161 layer-2 harness: component-render smoke test for the
// CRM-07/08 sourcing pipeline board. Mounts the real board against a mocked
// fetch: initial load renders cards in their stage columns, the detail
// panel's Stage select optimistically reconciles against a PATCH response,
// and opening a card shows the detail panel's notes + activity feed.
//
// w2-e redesign note: the board now also renders a phone-width duplicate of
// each card (CSS-only media-query swap, DEC-375 "client-state swap"), so
// jsdom (which ignores media queries) sees each entry's name button TWICE
// (desktop + phone). Queries below are scoped with `within()` to the
// desktop `.chq-contacts-pipeline-columns` grid to keep single-match
// assertions meaningful.
//
// DEC-157 amendment (w2-b): the desktop card is drag-only -- its per-card
// stage <select> moved into EntryDetailPanel (still the same moveTo/doMove
// PATCH path, decline prompt included).
//
// w4-c/DEC-898 amendment (wave 4): the phone strip's own per-card 'Move to'
// select is gone too -- the card face (desktop and phone) carries no stage
// control at all now; both name buttons name the person AND their current
// stage (accessible name), and open the same EntryDetailPanel Stage select.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PipelineBoard } from './PipelineBoard';
import { mockApi, listEnvelope, errorEnvelope } from '../../test-utils/mockApi';
import { PIPELINE_RATIONALE_MAX_LEN } from '../../../../src/domain/pipeline-fit';

// w4-c/DEC-898 amendment: the board's own '‹ Contacts' back link reads/
// writes the ?tab= URL param (DEC-710), so it needs a Router ancestor --
// same MemoryRouter-wrapping convention DuplicatesView.render.test.tsx uses
// for its own react-router-dom Link. LocationProbe surfaces the current
// search string as text so a click on the back link is observable without
// reaching into MemoryRouter's private in-memory history.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
      <LocationProbe />
      <PipelineBoard />
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

function desktopBoard() {
  return document.querySelector('.chq-contacts-pipeline-columns') as HTMLElement;
}

const ENTRY_IDENTIFIED = {
  id: 'entry-1',
  contactId: 'ct1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: 'Acme',
  email: 'ada@example.com',
  stage: 'identified',
  updatedAt: 1000,
  stageSince: 1000,
  declineReason: null,
  fitScore: null,
  rationale: null,
};

const ENTRY_CONTACTED = {
  id: 'entry-2',
  contactId: 'ct2',
  firstName: 'Grace',
  lastName: 'Hopper',
  company: 'Beta Inc',
  email: 'grace@example.com',
  stage: 'contacted',
  updatedAt: 2000,
  stageSince: 2000,
  declineReason: null,
  fitScore: 4,
  rationale: 'Keynoted a similar event last year',
};

describe('PipelineBoard render smoke (CRM-07/08)', () => {
  it('renders cards in their stage columns from GET /pipeline', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();

    await waitFor(() => {
      expect(within(desktopBoard()).getByText('Ada Lovelace')).toBeInTheDocument();
    });
    expect(within(desktopBoard()).getByText('Grace Hopper')).toBeInTheDocument();

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));
    expect(contactedColumn).toContainElement(within(desktopBoard()).getByText('Grace Hopper'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // DEC-157 amendment (w2-b): the desktop card no longer carries a stage
  // control -- the move happens through the detail panel's Stage select,
  // which calls the SAME moveTo/doMove PATCH path.
  function detailStub() {
    return {
      entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
      contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
      activity: { items: [], total: 0, page: 1, perPage: 200 },
    };
  }

  it("moves a card via the detail panel's Stage select, reconciling against the PATCH response", async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': detailStub(),
      'PATCH /api/v1/pipeline/entry-1': { ...ENTRY_IDENTIFIED, stage: 'contacted', updatedAt: 3000 },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const select = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
      expect(contactedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('rolls back loudly (with a visible error) when the move PATCH fails', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': detailStub(),
      'PATCH /api/v1/pipeline/entry-1': { status: 409, body: errorEnvelope('conflict', 'Move failed') },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const select = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      expect(screen.getByText('Move failed')).toBeInTheDocument();
    });

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('opens a card detail with notes composer and activity log', async () => {
    const moveActivity = {
      kind: 'move',
      body: null,
      fromStage: null,
      toStage: 'identified',
      authorName: 'Jordan Alvarez',
      createdAt: 1000,
    };
    let noteSaved = false;

    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': () => {
        const items = noteSaved
          ? [
              {
                kind: 'note',
                body: 'Left voicemail.',
                fromStage: null,
                toStage: null,
                authorName: 'Jordan Alvarez',
                createdAt: 4000,
              },
              moveActivity,
            ]
          : [moveActivity];
        return {
          entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
          contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
          activity: { items, total: items.length, page: 1, perPage: 200 },
        };
      },
      'POST /api/v1/pipeline/entry-1/notes': () => {
        noteSaved = true;
        return {
          kind: 'note',
          body: 'Left voicemail.',
          fromStage: null,
          toStage: null,
          authorName: 'Jordan Alvarez',
          createdAt: 4000,
        };
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Moved Enrolled/)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Add a note') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Left voicemail.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(screen.getByText('Note: Left voicemail.')).toBeInTheDocument();
    });

    // DEC-378: Escape closes the pipeline card detail dialog.
    expect(screen.getByRole('dialog', { name: 'Pipeline card detail' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Pipeline card detail' })).not.toBeInTheDocument();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // DEC-468: with a 200-row server page cap, entries.length can be less
  // than the envelope's true total -- the caption must read the total, and
  // a "Load more" control must fetch and append the next page.
  it('captions the true total and appends a second page from Load more', async () => {
    const page1 = [ENTRY_IDENTIFIED, ENTRY_CONTACTED];
    const page2 = [
      { ...ENTRY_IDENTIFIED, id: 'entry-3', firstName: 'Alan', lastName: 'Turing' },
      { ...ENTRY_CONTACTED, id: 'entry-4', firstName: 'Katherine', lastName: 'Johnson' },
    ];
    let call = 0;
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': () => {
        call += 1;
        return call === 1 ? listEnvelope(page1, { total: 7 }) : listEnvelope(page2, { total: 7, page: 2 });
      },
    });

    renderBoard();

    await waitFor(() => {
      expect(screen.getByText('7 people · drag between columns')).toBeInTheDocument();
    });

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    expect(loadMore).toBeInTheDocument();

    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(within(desktopBoard()).getByText('Alan Turing')).toBeInTheDocument();
    });

    const calls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calls.some((u) => /[?&]page=2\b/.test(u))).toBe(true);

    // Four items rendered after appending (2 + 2), still short of total 7,
    // so the caption still reads the true total and Load more stays.
    expect(within(desktopBoard()).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(desktopBoard()).getByText('Grace Hopper')).toBeInTheDocument();
    expect(within(desktopBoard()).getByText('Alan Turing')).toBeInTheDocument();
    expect(within(desktopBoard()).getByText('Katherine Johnson')).toBeInTheDocument();
    expect(screen.getByText('7 people · drag between columns')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders no Load more control when the first page already covers the total', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();

    await waitFor(() => {
      expect(screen.getByText('2 people · drag between columns')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // w56-e (DEC-157 amendment): the activity feed is paged like every other
  // house list -- 60 rows means the first page shows only perPage of them,
  // newest-first, with a Load more control naming the true total.
  it('pages a 60-row activity feed: first page shows perPage items newest-first with total 60', async () => {
    const allActivity = Array.from({ length: 60 }, (_, i) => ({
      kind: 'note',
      body: `Note ${i}`,
      fromStage: null,
      toStage: null,
      authorName: 'Jordan Alvarez',
      createdAt: 1000 + i, // ascending; newest-first means highest i first
    })).reverse();

    const perPage = 50;
    let call = 0;
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': () => {
        call += 1;
        const items = allActivity.slice((call - 1) * perPage, call * perPage);
        return {
          entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
          contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
          activity: { items, total: allActivity.length, page: call, perPage },
        };
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    await waitFor(() => {
      expect(screen.getByText('Note: Note 59')).toBeInTheDocument();
    });
    expect(screen.queryByText('Note: Note 9')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// w11-e (DEC-665): the caption and per-stage counts are measurements, not
// starting values -- before the first GET /pipeline resolves, the board
// must show exactly one loading state and never a "0 people" / "0" count
// beside it.
describe('PipelineBoard: withholds unmeasured counts during the first load', () => {
  it('shows only the loading caption, never a zero-count claim, before the first load resolves', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();

    // Synchronously after mount, before the mocked fetch promise resolves:
    // no "people" caption and no stage columns (which would otherwise
    // render "0" counts against not-yet-loaded data). DEC-678: the loading
    // text itself is withheld for ~250ms (DelayedLoading), so it must NOT
    // be present on this first frame either -- a loading text that popped
    // in instantly would be exactly the flicker DEC-678 removes.
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.queryByText(/people$/)).not.toBeInTheDocument();
    expect(document.querySelector('.chq-contacts-pipeline-columns')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-contacts-pipeline-column-count')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2 people · drag between columns')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-803: every card carries its age caption, a declined card shows its
// decline reason, and moving a card into declined asks for a reason before
// it persists.
describe('PipelineBoard: card age + decline reason (DEC-803)', () => {
  it('renders the age caption on every card', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    // ENTRY_IDENTIFIED.stageSince = 1000ms, far in the past relative to
    // Date.now() -- the exact day count isn't asserted (that's
    // pipeline-age.test.ts's job), just that a caption renders per card.
    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    expect(identifiedColumn.querySelector('.chq-contacts-pipeline-card-age')).not.toBeNull();
    expect(contactedColumn.querySelector('.chq-contacts-pipeline-card-age')).not.toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders the decline reason on a declined card', async () => {
    const declined = { ...ENTRY_IDENTIFIED, id: 'entry-3', stage: 'declined', declineReason: 'Scheduling conflict' };
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([declined]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    // DEC-898 amendment (w1-e/B18): the decline reason carries its own
    // 'Declined:' lead-in so it can never be read as the fit rationale.
    expect(within(desktopBoard()).getByText('Declined: Scheduling conflict')).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('asks for a reason before moving a card into declined, and sends it with the move', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': {
        entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
        contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
        activity: { items: [], total: 0, page: 1, perPage: 200 },
      },
      'PATCH /api/v1/pipeline/entry-1': () => ({
        ...ENTRY_IDENTIFIED,
        stage: 'declined',
        declineReason: 'Went with another speaker',
      }),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const detailDialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const select = within(detailDialog).getByLabelText('Stage') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'declined' } });

    // The card must not have moved yet -- it's still in the identified
    // column, awaiting the reason.
    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));

    const dialog = await screen.findByRole('dialog', { name: 'Decline this contact?' });
    const reasonField = within(dialog).getByLabelText(/Reason/) as HTMLTextAreaElement;

    // Submit is disabled until a reason is entered.
    expect(within(dialog).getByRole('button', { name: 'Decline' })).toBeDisabled();

    fireEvent.change(reasonField, { target: { value: 'Went with another speaker' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      const declinedColumn = document.querySelector('[data-stage="declined"]') as HTMLElement;
      expect(declinedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse(String((patchCall![1] as RequestInit).body));
    expect(patchBody).toMatchObject({ stage: 'declined', reason: 'Went with another speaker' });
    expect(screen.queryByRole('dialog', { name: 'Decline this contact?' })).not.toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-821: fit is a visible state, never blank -- a null score renders a
// dashed 'Unrated' affordance rather than nothing, and a rated card renders
// its "Fit N" pill plus rationale. Fit orders cards WITHIN a stage only.
describe('PipelineBoard: fit score + rationale (DEC-821)', () => {
  it('renders the Unrated affordance for a null fit score, never blank', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(within(identifiedColumn).getByText('Unrated')).toBeInTheDocument();
    expect(identifiedColumn.querySelector('.chq-contacts-pipeline-card-fit-unrated')).not.toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders a Fit N pill and the rationale for a rated card', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_CONTACTED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Grace Hopper'));

    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    expect(within(contactedColumn).getByText('Fit 4')).toBeInTheDocument();
    expect(within(contactedColumn).getByText('Keynoted a similar event last year')).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // B18/DEC-898 amendment (w1-e): a judge misread a declined card carrying
  // both fields as "TWO fit badges + TWO rationale paragraphs under one
  // name" -- there's only ever one of each, but the decline reason and the
  // fit rationale used to be visually identical muted italic text with
  // nothing but position telling them apart. This pins one card, one fit
  // chip, one rationale, one decline reason, with the decline reason
  // carrying its own label so it can't be mistaken for the rationale.
  it('renders exactly one fit chip, one rationale, and one labelled decline reason on a declined card', async () => {
    const declinedWithBoth = {
      ...ENTRY_IDENTIFIED,
      id: 'entry-declined-both',
      stage: 'declined',
      declineReason: 'Went with another speaker',
      fitScore: 3,
      rationale: 'Strong track record on this topic',
    };
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([declinedWithBoth]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const declinedColumn = document.querySelector('[data-stage="declined"]') as HTMLElement;

    const fitChips = declinedColumn.querySelectorAll('.chq-contacts-pipeline-card-fit');
    expect(fitChips).toHaveLength(1);

    const rationales = declinedColumn.querySelectorAll('.chq-contacts-pipeline-card-rationale');
    expect(rationales).toHaveLength(1);
    expect(rationales[0]?.textContent).toBe('Strong track record on this topic');

    const declineReasons = declinedColumn.querySelectorAll('.chq-contacts-pipeline-card-decline-reason');
    expect(declineReasons).toHaveLength(1);
    expect(declineReasons[0]?.textContent).toBe('Declined: Went with another speaker');

    // Item 7 (frame 08-contacts--04): the card face carries no per-card
    // Edit control anymore -- fit editing moved into the detail panel,
    // reached via the card's own name button.
    expect(within(declinedColumn).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(declinedColumn).queryByRole('button', { name: 'Edit fit' })).toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('orders cards within a stage by fit descending, unrated last', async () => {
    const rated2 = { ...ENTRY_IDENTIFIED, id: 'entry-r2', firstName: 'Zed', lastName: 'Two', fitScore: 2 };
    const rated5 = { ...ENTRY_IDENTIFIED, id: 'entry-r5', firstName: 'Amy', lastName: 'Five', fitScore: 5 };
    const unrated = { ...ENTRY_IDENTIFIED, id: 'entry-unrated', firstName: 'Bea', lastName: 'None', fitScore: null };
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([rated2, unrated, rated5]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Amy Five'));

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    const names = Array.from(identifiedColumn.querySelectorAll('.chq-contacts-pipeline-card-name')).map(
      (el) => el.textContent,
    );
    expect(names).toEqual(['Amy Five', 'Zed Two', 'Bea None']);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-980: fit is editable after enrolment -- the edit dialog PATCHes
// without a `stage` key, and the card's pill updates in place with no
// reload (no second GET /pipeline call). Item 7 (frame 08-contacts--04):
// the trigger moved off the card face into the detail panel (opened via
// the card's own name button), which is now the click-target this flow
// starts from.
describe('PipelineBoard: fit edit after enrolment (DEC-980)', () => {
  it('rates an Unrated card via the edit dialog, PATCHing without a stage and updating in place', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': {
        entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
        contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
        activity: { items: [], total: 0, page: 1, perPage: 200 },
      },
      'PATCH /api/v1/pipeline/entry-1': {
        ...ENTRY_IDENTIFIED,
        fitScore: 3,
        rationale: 'Solid keynote track record',
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(within(identifiedColumn).getByText('Unrated')).toBeInTheDocument();
    // No per-card Rate/Edit control on the card face itself.
    expect(within(identifiedColumn).queryByRole('button', { name: 'Rate' })).toBeNull();

    fireEvent.click(within(identifiedColumn).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);
    const detailDialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: 'Rate' }));

    const dialog = await screen.findByRole('dialog', { name: 'Rate fit' });
    fireEvent.click(within(dialog).getByRole('button', { name: '3' }));
    const rationaleInput = within(dialog).getByLabelText(/Why them/) as HTMLInputElement;
    expect(rationaleInput.maxLength).toBe(PIPELINE_RATIONALE_MAX_LEN);
    fireEvent.change(rationaleInput, {
      target: { value: 'Solid keynote track record' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(desktopBoard()).getByText('Fit 3')).toBeInTheDocument();
    });
    expect(within(desktopBoard()).queryByText('Unrated')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Rate fit' })).not.toBeInTheDocument();

    const getCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'GET');
    // Only the initial GET /pipeline load plus the one GET /pipeline/:id
    // that opening the detail panel triggers -- saving the fit edit itself
    // reloads neither.
    expect(getCalls).toHaveLength(2);

    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse(String((patchCall![1] as RequestInit).body));
    expect(patchBody).toEqual({ fitScore: 3, rationale: 'Solid keynote track record' });
    expect(patchBody.stage).toBeUndefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-859: the add-to-the-pipeline dialog is the frame's dialog (ModalFrame,
// not a hand-rolled scrim), with the title/trigger vocabulary aligned and
// the Starting stage / Fit controls built on the shared .chq-segmented
// radio-group markup, not a third chip vocabulary.
//
// w40-c/DEC-821 amendment: the contact picker is now a server search
// (`/contacts?q=...&perPage=20`, the SubmissionDetailPage add-co-presenter
// idiom), not a mount-time `/contacts?perPage=200` fetch rendered as a bare
// <select> -- past 200 org contacts the old picker silently could not reach
// most of the directory.
describe('PipelineBoard: Add to the pipeline dialog (DEC-859)', () => {
  const CONTACT = { id: 'ct9', firstName: 'Rosa', lastName: 'Park', email: 'rosa@example.com', company: null };

  async function openDialog() {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
    });
    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    return screen.findByRole('dialog', { name: 'Add to the pipeline' });
  }

  it('opens through the shared ModalFrame with matching title/trigger vocabulary', async () => {
    const dialog = await openDialog();

    // The frame's contract: a role="dialog" with the given aria-label,
    // rendered as a portal child of document.body (ModalFrame.render.test's
    // assertions), plus the shared header Close control.
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // Title and trigger read identically.
    expect(within(dialog).getByText('Add to the pipeline', { selector: 'h2' })).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('exposes Starting stage and Fit as chip rows of aria-pressed buttons, not comboboxes', async () => {
    const dialog = await openDialog();

    const stageGroup = within(dialog).getByRole('group', { name: 'Starting stage' });
    const stageButtons = within(stageGroup).getAllByRole('button');
    expect(stageButtons).toHaveLength(5);
    stageButtons.forEach((b) => expect(b).toHaveAttribute('aria-pressed'));
    expect(within(stageGroup).getByRole('button', { name: 'Identified' })).toHaveAttribute('aria-pressed', 'true');

    // Item 8 (MINOR): frame 08-contacts--12 draws five equal boxes, 1-5,
    // with no sixth 'Unrated' box -- fit starts unrated with nothing
    // selected (never a synthesized "Unrated" pressed state).
    const fitGroup = within(dialog).getByRole('group', { name: 'Fit' });
    const fitButtons = within(fitGroup).getAllByRole('button');
    expect(fitButtons.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
    fitButtons.forEach((b) => expect(b).toHaveAttribute('aria-pressed', 'false'));

    expect(dialog.querySelector('select[aria-label="Starting stage"]')).toBeNull();
    expect(dialog.querySelector('select[aria-label="Fit"]')).toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // w4-c: the footnote moved below the button row so it reads as a
  // footnote to the action, not a warning above it. Item 8 (MINOR): the
  // sentence starts uppercase, matching the frame.
  it('shows the consequence sentence below the button row', async () => {
    const dialog = await openDialog();

    const consequence = within(dialog).getByText('Adding writes a move to the activity feed · no email is sent');
    const primary = within(dialog).getByRole('button', { name: 'Add to the pipeline' });
    const position = consequence.compareDocumentPosition(primary);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('enrolls with Unrated left selected and posts no fitScore', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([CONTACT]),
      'POST /api/v1/pipeline': { id: 'entry-9', contactId: 'ct9', stage: 'identified', fitScore: null },
    });

    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to the pipeline' });

    fireEvent.change(within(dialog).getByLabelText('Search contacts'), { target: { value: 'Rosa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(within(dialog).getByText('Rosa Park — rosa@example.com')).toBeInTheDocument();
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rosa Park — rosa@example.com' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to the pipeline' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    const body = JSON.parse(String((postCall![1] as RequestInit).body));
    expect(body).toMatchObject({ contactId: 'ct9', stage: 'identified', fitScore: null });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// w40-c/DEC-821 amendment: the enroll picker's own search behaviour --
// no request on mount, the true-total bound line, exclusion of already-
// enrolled contacts, and the enroll POST still firing off a selected result.
describe('PipelineBoard: enroll picker search (w40-c/DEC-821 amendment)', () => {
  it('issues no /contacts request until a query is entered', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
    });

    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    await screen.findByRole('dialog', { name: 'Add to the pipeline' });

    const contactCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/contacts'));
    expect(contactCalls).toHaveLength(0);
    expect(screen.getByText('Search by name, email or company')).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders exactly the returned rows plus the "first N of total" line when the envelope reports more', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `ct-${i}`,
      firstName: 'Person',
      lastName: String(i),
      email: `person${i}@example.com`,
      company: null,
    }));
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope(items, { total: 900 }),
    });

    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to the pipeline' });

    fireEvent.change(within(dialog).getByLabelText('Search contacts'), { target: { value: 'Person' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThanOrEqual(20);
    });
    const rows = within(dialog)
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('@example.com'));
    expect(rows).toHaveLength(20);
    expect(within(dialog).getByText('Showing the first 20 of 900 — narrow your search')).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('excludes an already-enrolled contact from the search results', async () => {
    // ENTRY_IDENTIFIED.contactId is 'ct1' -- the same contact returned by
    // the search must be excluded from the offered results.
    const already = { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: null };
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/contacts': listEnvelope([already]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to the pipeline' });

    fireEvent.change(within(dialog).getByLabelText('Search contacts'), { target: { value: 'Ada' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(within(dialog).getByText('No contacts found.')).toBeInTheDocument();
    });
    expect(within(dialog).queryByText(/ada@example\.com/)).not.toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('selecting a search result and confirming POSTs /pipeline with that contactId', async () => {
    const CONTACT = { id: 'ct9', firstName: 'Rosa', lastName: 'Park', email: 'rosa@example.com', company: null };
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([CONTACT]),
      'POST /api/v1/pipeline': { id: 'entry-9', contactId: 'ct9', stage: 'identified', fitScore: null },
    });

    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to the pipeline' });

    fireEvent.change(within(dialog).getByLabelText('Search contacts'), { target: { value: 'Rosa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));

    await waitFor(() => within(dialog).getByText('Rosa Park — rosa@example.com'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rosa Park — rosa@example.com' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to the pipeline' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeDefined();
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    const body = JSON.parse(String((postCall![1] as RequestInit).body));
    expect(body).toMatchObject({ contactId: 'ct9' });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-898: the board accepts a dropped card via the agenda DayGrid's exact
// drag contract (entry id in text/plain, effectAllowed 'move'; the column
// preventDefaults on dragover and reads the id on drop) and the drop calls
// the SAME stage-change request as the Move-to select.
describe('PipelineBoard: drag-and-drop stage change (DEC-898)', () => {
  function makeDataTransfer() {
    const data = new Map<string, string>();
    return {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? '',
      dropEffect: '',
      effectAllowed: '',
    };
  }

  it('dropping a card on a different column issues exactly one stage request for that entry/stage', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'PATCH /api/v1/pipeline/entry-1': { ...ENTRY_IDENTIFIED, stage: 'contacted', updatedAt: 3000 },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const card = within(desktopBoard()).getByText('Ada Lovelace').closest('li') as HTMLElement;
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer });

    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    fireEvent.dragOver(contactedColumn, { dataTransfer });
    fireEvent.drop(contactedColumn, { dataTransfer });

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patchCalls).toHaveLength(1);
      const body = JSON.parse(String((patchCalls[0]![1] as RequestInit).body));
      expect(body).toMatchObject({ stage: 'contacted' });
      expect(String(patchCalls[0]![0])).toContain('/pipeline/entry-1');
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('dropping a card on its own current column issues zero requests', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const card = within(desktopBoard()).getByText('Ada Lovelace').closest('li') as HTMLElement;
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer });

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    fireEvent.dragOver(identifiedColumn, { dataTransfer });
    fireEvent.drop(identifiedColumn, { dataTransfer });

    // Give any accidental async request a tick to fire.
    await new Promise((r) => setTimeout(r, 0));

    const patchOrPostCalls = fetchMock.mock.calls.filter(([, init]) =>
      ['PATCH', 'POST'].includes((init as RequestInit | undefined)?.method ?? ''),
    );
    expect(patchOrPostCalls).toHaveLength(0);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // w4-c/DEC-898 amendment: the per-card 'Move to' select left the card
  // face entirely (phone strip included) -- the keyboard/a11y path is now
  // the opened-card panel's Stage picker, reached via the card's own name
  // button, whose accessible name states the person AND their current
  // stage so the picker isn't mouse-only.
  it("the phone card's name button names the person and current stage, and opens the Stage picker", async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': {
        entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
        contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
        activity: { items: [], total: 0, page: 1, perPage: 200 },
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    // No select on the card face anywhere (desktop or phone).
    expect(screen.queryAllByLabelText('Move to')).toHaveLength(0);
    expect(document.querySelector('.chq-contacts-pipeline-phone-card select')).toBeNull();

    const phoneList = document.querySelector('.chq-contacts-pipeline-phone-list') as HTMLElement;
    const phoneNameButton = within(phoneList).getByRole('button', { name: 'Ada Lovelace, Identified' });
    fireEvent.click(phoneNameButton);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const select = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    expect(select.value).toBe('identified');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-157 amendment (w2-b): the desktop card is drag-only -- its stage
// control moved into the detail panel.
describe('PipelineBoard: desktop card is drag-only (DEC-157 amendment, w2-b)', () => {
  it('renders no stage select on any desktop card', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    expect(within(desktopBoard()).queryByLabelText('Move to')).not.toBeInTheDocument();
    expect(desktopBoard().querySelector('select')).toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('keeps the desktop card draggable', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const card = within(desktopBoard()).getByText('Ada Lovelace').closest('li') as HTMLElement;
    expect(card).toHaveAttribute('draggable', 'true');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("persists a move through PATCH via the detail panel's Stage select", async () => {
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': {
        entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
        contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
        activity: { items: [], total: 0, page: 1, perPage: 200 },
      },
      'PATCH /api/v1/pipeline/entry-1': { ...ENTRY_IDENTIFIED, stage: 'contacted', updatedAt: 3000 },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const select = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    expect(select.value).toBe('identified');
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      const body = JSON.parse(String((patchCall![1] as RequestInit).body));
      expect(body).toMatchObject({ stage: 'contacted' });
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// w4-c/DEC-898 amendment (wave 4): the board header states the card's own
// affordance now that the card face carries no stage control -- an H1
// 'Pipeline' with a '‹ Contacts' back link and the 'N people - drag between
// columns' subtitle, replacing the 'Sourcing pipeline' eyebrow.
describe('PipelineBoard: header (w4-c/DEC-898 amendment)', () => {
  it('renders the H1 title, the back link, and the drag-affordance subtitle -- no eyebrow', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    expect(screen.getByRole('heading', { name: 'Pipeline', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ Contacts' })).toBeInTheDocument();
    expect(screen.getByText('2 people · drag between columns')).toBeInTheDocument();
    expect(screen.queryByText('Sourcing pipeline')).not.toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("the '‹ Contacts' back link clears the ?tab= pipeline param", async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
    });

    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '‹ Contacts' }));

    await waitFor(() => expect(screen.getByTestId('location-search').textContent).not.toContain('tab=pipeline'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// w4-c/DEC-898 amendment: the card face is reachable by keyboard -- its
// name button carries button semantics plus an accessible name that states
// the person AND their current stage, so the opened-card panel's Stage
// picker (the keyboard/a11y path per DEC-898) is never mouse-only.
describe('PipelineBoard: card face keyboard reachability (w4-c/DEC-898 amendment)', () => {
  it('the desktop card name is a <button> whose accessible name states the person and stage', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const nameButton = within(desktopBoard()).getByRole('button', { name: 'Ada Lovelace, Identified' });
    expect(nameButton.tagName).toBe('BUTTON');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// DEC-678 (w55-b): a card's activity feed has no filter/search axis of its
// own -- it is the entry's whole move+note history -- so a zero-row settle
// renders the shared EmptyState in the 'fresh' voice, never the old bare
// escape-less line.
describe('PipelineBoard: empty activity feed (DEC-678, w55-b)', () => {
  it('renders the shared EmptyState for a card with no activity yet, and drops the old bare chq-empty line', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': detailStubForActivityTest(),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('No activity yet.')).toBeInTheDocument();
    });
    expect(dialog.querySelector('.chq-empty')).toBeNull();
    expect(dialog.querySelector('.chq-empty-block-fresh')).not.toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

function detailStubForActivityTest() {
  return {
    entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
    contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
    activity: { items: [], total: 0, page: 1, perPage: 200 },
  };
}

// Item 5 (frame 08-contacts--14, B7 exemplar): an empty stage column names
// the stage via a real heading (never the generic "No one in X"), a body
// naming the previous stage's REAL live count, and a tertiary "Add someone
// to <stage> ›" that opens the Add-to-the-pipeline dialog preset to this
// stage -- the column's own name/count header stays visible above it.
describe('PipelineBoard: empty stage column (item 5, B7 exemplar)', () => {
  it('names the stage, states the previous stage\'s real count, keeps the column header above it, and offers the tertiary add action', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    // The column's own name/count header still renders above the message.
    expect(within(contactedColumn).getByText('Contacted')).toBeInTheDocument();
    expect(within(contactedColumn).getByText('0')).toBeInTheDocument();
    // A stage-appropriate heading, never the generic "No one in X".
    expect(within(contactedColumn).queryByText(/No one in Contacted/)).toBeNull();
    expect(within(contactedColumn).getByText('Nobody has been contacted yet')).toBeInTheDocument();
    // Identified (the previous stage) really holds 1 entry (Ada Lovelace).
    expect(
      within(contactedColumn).getByText(
        'One person is in Identified. Cards land here when you move them, or you can add someone straight to this stage.',
      ),
    ).toBeInTheDocument();
    // No card list -- the ul is replaced entirely.
    expect(contactedColumn.querySelector('.chq-contacts-pipeline-column-cards')).toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('the tertiary add action opens the Add-to-the-pipeline dialog preset to this stage', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    fireEvent.click(within(contactedColumn).getByRole('button', { name: 'Add someone to Contacted ›' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add to the pipeline' });
    const stageGroup = within(dialog).getByRole('group', { name: 'Starting stage' });
    expect(within(stageGroup).getByRole('button', { name: 'Contacted' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(stageGroup).getByRole('button', { name: 'Identified' })).toHaveAttribute('aria-pressed', 'false');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// v12 design pack, phone frame "Pipeline · 390" — "One column at a time"
// (docs/design/Chautauqua Contacts.dc.html:443-478). Two things the frame
// draws on every phone card that the strip was missing:
//
//   * a right-flushed "Move ›" control (min-height:44px, horizontal
//     padding, flex-shrink:0). Drag is the desktop board's move
//     affordance and has NO touch equivalent — ruling B8 requires every
//     drag to have one — so at 390 the card needs a named control. It
//     opens the SAME EntryDetailPanel the name button does, so no stage
//     control returns to the card face (w4-c/DEC-898 stands).
//   * the fit chip. The desktop card has carried it since DEC-821; the
//     phone card did not, so one fact changed vocabulary between the two
//     widths — exactly what the "status tokens pair by density, not by
//     device" ruling forbids.
describe('PipelineBoard phone card matches the v12 "Pipeline · 390" frame', () => {
  function phoneCards(): HTMLElement[] {
    const list = document.querySelector('.chq-contacts-pipeline-phone-list') as HTMLElement;
    return [...list.querySelectorAll('.chq-contacts-pipeline-phone-card')] as HTMLElement[];
  }

  it('gives every phone card a right-flushed Move control that names the person and their stage', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const [card] = phoneCards();
    const move = within(card!).getByRole('button', { name: 'Move Ada Lovelace out of Identified' });
    expect(move).toHaveClass('chq-contacts-pipeline-phone-card-move');
    // The frame draws it as the row's last element, outside the identity
    // stack -- not another line inside the card body.
    expect(move.parentElement).toBe(card);
    expect(card!.querySelector('.chq-contacts-pipeline-phone-card-body')).not.toContainElement(move);

    // Still no stage <select> on the card face (w4-c/DEC-898).
    expect(card!.querySelector('select')).toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('opens the same detail panel the name button opens, so the Stage picker stays the one move path', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': {
        entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
        contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
        activity: { items: [], total: 0, page: 1, perPage: 200 },
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const [card] = phoneCards();
    fireEvent.click(within(card!).getByRole('button', { name: 'Move Ada Lovelace out of Identified' }));

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    expect((within(dialog).getByLabelText('Stage') as HTMLSelectElement).value).toBe('identified');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('carries the same fit chip vocabulary as the desktop card — rated and unrated alike', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const list = document.querySelector('.chq-contacts-pipeline-phone-list') as HTMLElement;

    // Identified is the default phone stage: Ada (fitScore null) is shown.
    expect(within(list).getByText('Unrated')).toHaveClass('chq-contacts-pipeline-card-fit-unrated');

    // Switch the strip to Contacted for Grace (fitScore 4 + a rationale).
    const strip = document.querySelector('.chq-contacts-pipeline-phone-stages') as HTMLElement;
    fireEvent.click(within(strip).getByRole('button', { name: /^Contacted/ }));

    expect(within(list).getByText('Fit 4')).toHaveClass('chq-contacts-pipeline-card-fit-rated');
    expect(within(list).getByText('Keynoted a similar event last year')).toHaveClass(
      'chq-contacts-pipeline-card-rationale',
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
