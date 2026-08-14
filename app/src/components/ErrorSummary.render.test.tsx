// DEC-124/DEC-958: ErrorSummary is the ONE top-of-form error block --
// heading pluralisation, one anchor per problem, an optional kept-state
// line.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { countHeading, ErrorSummary } from './ErrorSummary';

afterEach(() => {
  cleanup();
});

describe('countHeading', () => {
  it('spells the singular case: one thing needs fixing', () => {
    expect(countHeading(1, 'before this can be sent')).toBe('One thing needs fixing before this can be sent');
  });

  it('spells the plural case up to ten', () => {
    expect(countHeading(3, 'before this can be sent')).toBe('Three things need fixing before this can be sent');
    expect(countHeading(10, 'before this can be sent')).toBe('Ten things need fixing before this can be sent');
  });

  it('falls back to digits above ten', () => {
    expect(countHeading(11, 'before this can be sent')).toBe('11 things need fixing before this can be sent');
  });
});

describe('ErrorSummary', () => {
  it('renders role="alert", the heading, and one anchor per problem', () => {
    render(
      <ErrorSummary
        heading="Two things need fixing before this can be sent"
        problems={[
          { anchorId: 'subject-field', label: 'Subject' },
          { anchorId: 'body-field', label: 'Body' },
        ]}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Two things need fixing before this can be sent');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '#subject-field');
    expect(links[0]).toHaveTextContent('Subject');
    expect(links[1]).toHaveAttribute('href', '#body-field');
    expect(links[1]).toHaveTextContent('Body');
  });

  it('omits the kept line when not provided, renders it when provided', () => {
    const { rerender } = render(
      <ErrorSummary heading="One thing needs fixing" problems={[{ anchorId: 'x', label: 'X' }]} />,
    );
    expect(screen.queryByText(/kept/)).not.toBeInTheDocument();

    rerender(
      <ErrorSummary
        heading="One thing needs fixing"
        kept="Everything else was kept as a draft."
        problems={[{ anchorId: 'x', label: 'X' }]}
      />,
    );
    expect(screen.getByText('Everything else was kept as a draft.')).toBeInTheDocument();
  });
});
