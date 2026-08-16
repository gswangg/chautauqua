// DEC-575 (wave 28 amendment): a file-level, pre-mapping block for rows
// missing the dedupe key (email) -- rendered above the step content,
// counting the offending rows against the total, saying why email matters,
// listing the offending rows (capped at ten), reassuring nothing was lost,
// and offering a partial primary that continues to the match step with only
// the usable rows. See DEC-575/DEC-124 in decisions/.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';

afterEach(() => {
  cleanup();
});

// Header row (line 1), John (line 2, has email), Jane/Bob/Amy (lines 3-5:
// blank email, placeholder "n/a", missing-@ — the three failure kinds frame
// 08-contacts--15 enumerates), Sam (line 6, has email). 3 of 5 data rows
// have no usable email.
const CSV_WITH_MISSING_EMAILS = [
  'First Name,Last Name,Email,Company',
  'John,Doe,john@example.com,Acme',
  'Jane,Smith,,Beta',
  'Bob,Lee,n/a,Gamma',
  'Amy,Wu,priya.example.com,Delta',
  'Sam,Fox,sam@example.com,Zeta',
].join('\n');

const CLEAN_CSV = [
  'First Name,Last Name,Email,Company',
  'John,Doe,john@example.com,Acme',
  'Jane,Smith,jane@example.com,Beta',
].join('\n');

describe('ImportWizard: DEC-575 file-level "rows have no email address" block', () => {
  it('renders the counted heading, capped row list, and reassurance, and hides the match-columns screen', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV_WITH_MISSING_EMAILS } });

    expect(await screen.findByText('3 of 5 rows have no email address')).toBeInTheDocument();
    expect(screen.getByText(/Email is how a contact is matched and how anything reaches them/)).toBeInTheDocument();
    // G13 (frame 08-contacts--15): every rejected row names its own reason —
    // the three failure kinds the frame enumerates.
    expect(screen.getByText('Row 3 — Email blank')).toBeInTheDocument();
    expect(screen.getByText('Row 4 — Email reads "n/a"')).toBeInTheDocument();
    expect(screen.getByText('Row 5 — Email missing an @ — "priya.example.com"')).toBeInTheDocument();
    expect(screen.getByText('Nothing was lost — the file is still loaded.')).toBeInTheDocument();

    // The match-columns screen (step 2) does not share the page with the
    // file-level block.
    expect(screen.queryByLabelText('Map column Email')).not.toBeInTheDocument();

    // The block carries the shared .chq-error-summary vocabulary by class
    // name (DEC-124), not a hand-rolled treatment.
    expect(screen.getByRole('alert')).toHaveClass('chq-error-summary');
  });

  it('the partial primary "Import the N good rows" advances to the match step with only the usable rows', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV_WITH_MISSING_EMAILS } });

    const primary = await screen.findByRole('button', { name: 'Import the 2 good rows' });
    fireEvent.click(primary);

    // The file-level block is gone and the match-columns screen (step 2)
    // now shows -- with only the 2 rows that had an email.
    expect(screen.queryByText('3 of 5 rows have no email address')).not.toBeInTheDocument();
    const emailSelect = await screen.findByLabelText('Map column Email');
    expect(emailSelect).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Import 2 rows' })).toBeInTheDocument();
  });

  it('a secondary path re-uploads a different file without the state itself clearing the parsed file', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV_WITH_MISSING_EMAILS } });

    await screen.findByText('3 of 5 rows have no email address');
    // Merely rendering the warning never clears the file -- the reassurance
    // copy says so, and step 1's file/paste controls stay unmounted (as
    // they are for the whole of step 2) rather than the file being wiped.
    expect(screen.getByText('Nothing was lost — the file is still loaded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upload a different file' }));

    // The explicit re-upload action clears the file and returns to step 1.
    expect(screen.getByLabelText('Upload a CSV file')).toBeInTheDocument();
    expect(screen.getByLabelText('Or paste CSV text')).toHaveValue('');
  });

  it('a clean CSV (every row has an email) renders no file-level block', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CLEAN_CSV } });

    await screen.findByLabelText('Map column Email');
    expect(screen.queryByText(/rows have no email address/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
