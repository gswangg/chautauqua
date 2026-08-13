// DEC-728: SummarySection is the settings drill-in primitive — read-only
// summary rows by default, ONE right-aligned tertiary action on the
// section's rule that opens the URL-state edit drill, and the caller's
// form in place of the rows once `editing` is true.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { SummarySection } from './SummarySection';

function LocationProbe() {
  const [params] = useSearchParams();
  return <div data-testid="probe">{params.toString()}</div>;
}

afterEach(() => {
  cleanup();
});

describe('SummarySection', () => {
  it('renders the label, rule and label:value rows in view mode', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SummarySection
          sectionKey="event"
          label="Event settings"
          rows={[
            { label: 'Name', value: 'DevCon 2026' },
            { label: 'Slug', value: 'devcon-2026' },
          ]}
          actionLabel="Change"
          editing={false}
        >
          <p>the form</p>
        </SummarySection>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Event settings' })).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('DevCon 2026')).toBeInTheDocument();
    expect(screen.getByText('Slug')).toBeInTheDocument();
    expect(screen.getByText('devcon-2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.queryByText('the form')).not.toBeInTheDocument();
  });

  it('renders children instead of rows, and hides the action, when editing', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SummarySection
          sectionKey="event"
          label="Event settings"
          rows={[{ label: 'Name', value: 'DevCon 2026' }]}
          actionLabel="Change"
          editing
        >
          <p>the form</p>
        </SummarySection>
      </MemoryRouter>,
    );

    expect(screen.getByText('the form')).toBeInTheDocument();
    expect(screen.queryByText('DevCon 2026')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  it('clicking the action writes ?section=<sectionKey>&edit=1 to the URL, preserving other params', () => {
    render(
      <MemoryRouter initialEntries={['/settings?foo=bar']}>
        <LocationProbe />
        <SummarySection
          sectionKey="event"
          label="Event settings"
          rows={[{ label: 'Name', value: 'DevCon 2026' }]}
          actionLabel="Change"
          editing={false}
        >
          <p>the form</p>
        </SummarySection>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    const probe = new URLSearchParams(screen.getByTestId('probe').textContent ?? '');
    expect(probe.get('section')).toBe('event');
    expect(probe.get('edit')).toBe('1');
    expect(probe.get('foo')).toBe('bar');
  });

  // DEC-896: the read row is a three-column grid -- label / value / hint.
  // A row with a hint renders it in its own hint column; a row without one
  // renders no hint cell at all (never an empty placeholder div).
  it('renders a row hint when supplied and collapses the hint column when absent', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SummarySection
          sectionKey="event"
          label="Event settings"
          rows={[
            { label: 'Name', value: 'DevCon 2026' },
            { label: 'Slug', value: 'devcon-2026', hint: 'Used in every public URL' },
          ]}
          actionLabel="Change"
          editing={false}
        >
          <p>the form</p>
        </SummarySection>
      </MemoryRouter>,
    );

    const nameRow = screen.getByText('Name').closest('.chq-settings-row');
    const slugRow = screen.getByText('Slug').closest('.chq-settings-row');
    expect(nameRow?.querySelector('.chq-settings-row-hint')).toBeNull();
    expect(slugRow?.querySelector('.chq-settings-row-hint')).toHaveTextContent('Used in every public URL');
  });

  it('scopes the row action within the section (no floating band)', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SummarySection
          sectionKey="event"
          label="Event settings"
          rows={[{ label: 'Name', value: 'DevCon 2026' }]}
          actionLabel="Change"
          editing={false}
        >
          <p>the form</p>
        </SummarySection>
      </MemoryRouter>,
    );

    const section = screen.getByRole('region', { name: 'Event settings' });
    const action = within(section).getByRole('button', { name: 'Change' });
    expect(section).toContainElement(action);
    expect(action.className).toContain('chq-settings-section-action');
  });
});
