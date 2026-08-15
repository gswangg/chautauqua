// DEC-146 amendment (w44-b): DateField is the ONE date-entry grammar in the
// SPA -- a plain-text input formatted like "11 May 2028" rather than the
// browser's locale-dependent native date picker. This covers the widget's
// behavior (format on mount, parse on blur, refuse garbage) plus a
// re-runnable source-scan (DEC-808 idiom) asserting zero `type="date"`
// remains anywhere under app/src.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DateField } from './DateField';

afterEach(() => {
  cleanup();
});

describe('DateField', () => {
  it('renders the value formatted as "D Mon YYYY"', () => {
    render(<DateField id="d1" value="2028-05-11" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('11 May 2028');
  });

  it('renders empty for an empty value', () => {
    render(<DateField id="d1" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('is a plain text input, never a native date picker', () => {
    render(<DateField id="d1" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', '11 May 2028');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('normalizes an alternate valid format on blur and calls onChange with yyyy-mm-dd', () => {
    const onChange = vi.fn();
    render(<DateField id="d1" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '2028-05-11' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('2028-05-11');
    expect(input).toHaveValue('11 May 2028');
  });

  it('accepts lowercase month text on blur', () => {
    const onChange = vi.fn();
    render(<DateField id="d1" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '11 may 2028' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('2028-05-11');
  });

  it('refuses unparseable text: no onChange call, inline error shown', () => {
    const onChange = vi.fn();
    render(<DateField id="d1" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not a date' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Use a date like 11 May 2028');
    expect(input).toHaveValue('not a date');
  });

  it('clears the value when text is blanked and blurred', () => {
    const onChange = vi.fn();
    render(<DateField id="d1" value="2028-05-11" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('accepts a month-first spelling on blur', () => {
    const onChange = vi.fn();
    render(<DateField id="d1" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'May 1, 2027' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('2027-05-01');
  });
});

describe('DateField native constraint validation (DEC-146 amendment, w49-c)', () => {
  it('fails checkValidity() while the typed text is unparseable', () => {
    render(<DateField id="d1" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not a date' } });
    expect(input.checkValidity()).toBe(false);
  });

  it('passes checkValidity() once the text is corrected to a parseable date', () => {
    render(<DateField id="d1" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not a date' } });
    expect(input.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: 'May 1, 2027' } });
    expect(input.checkValidity()).toBe(true);
  });

  it('passes checkValidity() once the text is cleared', () => {
    render(<DateField id="d1" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not a date' } });
    expect(input.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.checkValidity()).toBe(true);
  });

  it('shows no inline error message while typing an unparseable value (only after blur)', () => {
    render(<DateField id="d1" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not a date' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.checkValidity()).toBe(false);
  });
});

describe('DateField source-scan: zero native date inputs remain (DEC-146 amendment)', () => {
  it('finds no `type="date"` under app/src outside this component and dates.ts docs', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const APP_SRC = join(HERE, '..'); // app/src
    const THIS_FILE = join(HERE, 'DateField.render.test.tsx');
    const files: string[] = [];
    for (const entry of readdirSync(APP_SRC, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      const full = join(entry.parentPath, entry.name);
      if (full === THIS_FILE) continue;
      files.push(full);
    }
    expect(files.length).toBeGreaterThan(5);

    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      const lines = source.split('\n');
      lines.forEach((lineText, idx) => {
        // Only a literal JSX/attribute usage counts -- doc comments
        // referencing the banned native element are not a violation.
        if (/\btype\s*=\s*"date"/.test(lineText) && !/^\s*(\*|\/\/)/.test(lineText.trim())) {
          violations.push(`${relative(APP_SRC, file)}:${idx + 1}: ${lineText.trim()}`);
        }
      });
    }
    expect(violations, `native type="date" input found:\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('DateField source-scan: no noValidate on a form containing a DateField (DEC-146 amendment, w49-c)', () => {
  // DateField relies on native constraint validation (setCustomValidity) to
  // block submit -- a form that opts out with noValidate would silently let
  // a rejected date through, per the w49-c ruling closing that drop.
  it('finds no `noValidate` on the known DateField call sites', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const APP_SRC = join(HERE, '..'); // app/src
    const callSites = [
      join(APP_SRC, 'pages/review/PlanEditor.tsx'),
      join(APP_SRC, 'pages/settings/EventSettingsPanel.tsx'),
      join(APP_SRC, 'pages/speakers/TaskModal.tsx'),
      join(APP_SRC, 'pages/settings/CallForPapersPanel.tsx'),
      join(APP_SRC, 'pages/settings/EmbedsPanel.tsx'),
      join(APP_SRC, 'pages/forms/FormsPage.tsx'),
      join(APP_SRC, 'components/EventSwitcher.tsx'),
    ];

    const violations: string[] = [];
    for (const file of callSites) {
      const source = readFileSync(file, 'utf-8');
      expect(source, `${file} imports DateField`).toMatch(/DateField/);
      const lines = source.split('\n');
      lines.forEach((lineText, idx) => {
        if (/\bnoValidate\b/.test(lineText) && !/^\s*(\*|\/\/)/.test(lineText.trim())) {
          violations.push(`${relative(APP_SRC, file)}:${idx + 1}: ${lineText.trim()}`);
        }
      });
    }
    expect(violations, `noValidate found on a form containing a DateField:\n${violations.join('\n')}`).toEqual([]);
  });
});
