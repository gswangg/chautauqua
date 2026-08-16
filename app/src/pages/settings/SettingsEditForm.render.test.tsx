// DEC-896 amendment (wave 68): SettingsSaveButton is the ONE place either
// edit-footer primary string lives -- "Save changes" at rest, "Saving…"
// while pending -- matching the vendored frame's every drawn edit-view
// footer (docs/design/Chautauqua Settings.dc.html:687, 777). Panels adopt
// it instead of writing the label themselves; this test pins the two
// states directly against the shared component so a call site can't drift
// back to a bare "Save".
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SettingsSaveButton } from './SettingsEditForm';

afterEach(() => {
  cleanup();
});

describe('SettingsSaveButton', () => {
  it('reads exactly "Save changes" and is enabled at rest', () => {
    render(<SettingsSaveButton pending={false} />);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Save changes');
  });

  it('reads exactly "Saving…" and is disabled while pending', () => {
    render(<SettingsSaveButton pending={true} />);
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});
