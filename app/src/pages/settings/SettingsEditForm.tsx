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

export type SettingsFieldWidth = 'date' | 'seats' | 'name' | 'slug' | 'full';

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
  return (
    <form className="chq-settings-edit-form" onSubmit={onSubmit}>
      <div className="chq-settings-edit-fields">{children}</div>
      {consequence != null ? <p className="chq-settings-edit-consequence">{consequence}</p> : null}
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

// Two fields side by side, 1fr 1fr at 18px gap -- the ONLY sanctioned way
// to place two SettingsFields on one line (e.g. Start date / End date).
export function SettingsFieldPair({ children }: { children: ReactNode }) {
  return <div className="chq-settings-field-pair">{children}</div>;
}
