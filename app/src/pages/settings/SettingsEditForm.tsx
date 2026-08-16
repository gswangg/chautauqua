// DEC-896 amendment (wave 26): the shared settings edit-view shell. A
// settings edit view is a form in the definition grid, never a phone
// screen dropped into the content column -- one shared component pair
// owns field width, pairing, and the footer row so every panel stops
// improvising its own <label> stack + loose Save/Cancel buttons.
//
// Composed INSIDE SummarySection's existing `children` slot
// (SummarySection.tsx:86 already swaps rows for children when `editing`
// is true) -- this file never touches SummarySection itself.
import type { ReactNode } from 'react';
import { OPTIONAL_SUFFIX } from '../../../../src/domain/form-copy';

export type SettingsFieldWidth = 'date' | 'seats' | 'name' | 'slug' | 'venue' | 'timezone' | 'full';

// G13 fix (frames 09--10/09--11): Time zone is a SELECT with the shared
// caret, never a free-text input. Options come from the runtime's own IANA
// table; a stored zone the runtime doesn't list (or an environment without
// Intl.supportedValuesOf) still renders as a selectable first option so the
// saved value is never silently dropped.
export function timezoneOptions(current: string): string[] {
  const intl = Intl as { supportedValuesOf?: (key: 'timeZone') => string[] };
  const zones = typeof intl.supportedValuesOf === 'function' ? [...intl.supportedValuesOf('timeZone')] : [];
  if (current && !zones.includes(current)) zones.unshift(current);
  return zones;
}

export interface SettingsEditFormFooter {
  primary: ReactNode;
  secondary?: ReactNode;
  // Rendered far left via margin-right:auto (never mixed into the
  // right-flushed primary/secondary group) -- Remove/Delete-style actions
  // stay DISABLED (with a reason) rather than omitted when the row backing
  // them is in use; omit this prop entirely for panels with no destructive
  // action.
  destructive?: ReactNode;
}

export interface SettingsEditFormProps {
  onSubmit: (event: import('react').FormEvent<HTMLFormElement>) => void;
  // The B10 consequence line -- right-aligned, printed once per edit view,
  // naming exactly what a save on this form changes/breaks.
  consequence?: ReactNode;
  footer: SettingsEditFormFooter;
  children: ReactNode;
}

export function SettingsEditForm({ onSubmit, consequence, footer, children }: SettingsEditFormProps) {
  // G13 fix (frames 09--10/09--11, srv8894): the consequence line belongs at
  // the TOP of the edit view, right-flushed on the title line -- the frames
  // place it on the H1 baseline, never below the last field. Rendered before
  // the fields wrapper; every edit view picks this up structurally.
  return (
    <form className="chq-settings-edit-form" onSubmit={onSubmit}>
      {consequence != null ? <p className="chq-settings-edit-consequence">{consequence}</p> : null}
      <div className="chq-settings-edit-fields">{children}</div>
      <div className="chq-settings-edit-footer">
        {footer.destructive != null ? (
          <div className="chq-settings-edit-footer-destructive">{footer.destructive}</div>
        ) : null}
        {footer.secondary != null ? (
          <div className="chq-settings-edit-footer-secondary">{footer.secondary}</div>
        ) : null}
        <div className="chq-settings-edit-footer-primary">{footer.primary}</div>
      </div>
    </form>
  );
}

// DEC-896 amendment (wave 68): the shared footer owns the SLOTS, but not
// (until now) the WORDS -- three panels rendered a bare "Save" where the
// vendored frame's every drawn edit-view footer reads "Save changes"
// (docs/design/Chautauqua Settings.dc.html:687, 777, 858, 939, 1010, 1100,
// 1204, 1261). This is the ONE place either string lives; adopt it as
// `footer.primary` instead of writing the label at the call site.
export function SettingsSaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

export interface SettingsFieldProps {
  label: string;
  htmlFor?: string;
  width: SettingsFieldWidth;
  optional?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}

// A single field: label above control, width fixed by a CSS custom
// property keyed off `width` (settings.css) -- never a literal at the call
// site, and never a full-width control regardless of what stack it sits
// in.
export function SettingsField({ label, htmlFor, width, optional, hint, children }: SettingsFieldProps) {
  return (
    <div className={`chq-settings-field chq-settings-field-${width}`}>
      <label htmlFor={htmlFor}>
        <span className="chq-settings-field-label-text">
          {label}
          {optional ? <span className="chq-settings-field-optional">{OPTIONAL_SUFFIX}</span> : null}
        </span>
        {children}
      </label>
      {hint != null ? <p className="chq-settings-field-hint">{hint}</p> : null}
    </div>
  );
}

// Two fields side by side, each keeping its own content width (B10: field
// width follows content, not the column) at 18px gap -- the ONLY sanctioned
// way to place two SettingsFields on one line (e.g. Start date / End date).
// Neither member stretches to fill half the pair's track; grid-template-
// columns is auto auto, justify-content:start, so a paired date renders at
// --chq-field-w-date (200px) and a paired seats field at --chq-field-w-seats
// (110px), not at ~401px each.
export function SettingsFieldPair({ children }: { children: ReactNode }) {
  return <div className="chq-settings-field-pair">{children}</div>;
}
