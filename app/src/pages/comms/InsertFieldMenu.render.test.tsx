// DEC-792 amendment (wave 45): {task_due_date} is the canonical token; the
// Insert-a-field menu must offer it (never the {due_date} alias) and its
// helper sentence's count must equal the number of options rendered --
// computed from the SAME `fields` list, never a hardcoded numeral.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InsertFieldMenu } from './InsertFieldMenu';
import { COMPOSE_MERGE_FIELDS } from '../../lib/merge-fields';

afterEach(() => {
  cleanup();
});

describe('InsertFieldMenu', () => {
  it('offers task_due_date and never the due_date alias', () => {
    render(<InsertFieldMenu fields={COMPOSE_MERGE_FIELDS} onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /insert a field/i }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    const offered = items.map((el) => el.getAttribute('aria-label'));
    expect(offered).toContain('{task_due_date}');
    expect(offered).not.toContain('{due_date}');
  });

  it("the helper sentence's count equals the rendered option count, for whatever field list is passed", () => {
    const fields = COMPOSE_MERGE_FIELDS.slice(0, 3);
    render(<InsertFieldMenu fields={fields} onInsert={vi.fn()} />);
    expect(screen.getByText(new RegExp(`^${fields.length} available`))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /insert a field/i }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(fields.length);
  });
});
