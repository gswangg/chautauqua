import { useEffect, useRef, useState } from 'react';
import { formatDayInput, parseDayInput } from '../lib/dates';

/**
 * DEC-146 amendment (w44-b): the ONE date-entry grammar in the SPA. Every
 * bare native date-input element re-exposed the browser's locale (07/14/2026 on
 * a UA in en-US) while the v6 frames show a hand-built format ("11 May
 * 2028"). DateField renders a plain text input in that grammar and speaks
 * the SAME yyyy-mm-dd wire string the msToDateInput/dateInputToMs family
 * already uses, so no caller changes its data shape -- only the widget
 * changes.
 *
 * Typing is free-form; parsing/normalization happens on blur. An
 * unparseable, non-empty value never reaches the caller's onChange (fail
 * loudly, never coerce) -- it renders an inline error instead and leaves
 * the raw text in place so the producer can fix it.
 */
export function DateField(props: {
  id: string;
  value: string;
  onChange(next: string): void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  'aria-describedby'?: string;
}): JSX.Element {
  const { id, value, onChange, required } = props;
  const className = props.className ?? 'chq-input';
  const placeholder = props.placeholder ?? '11 May 2028';
  const [text, setText] = useState(() => formatDayInput(value));
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);

  // Keep the display text in sync with an externally-changed value (e.g.
  // the parent resets the form) -- but never while the producer is mid-edit,
  // or every keystroke's re-render would stomp what they just typed.
  useEffect(() => {
    if (focusedRef.current) return;
    setText(formatDayInput(value));
    setError(null);
  }, [value]);

  function handleBlur() {
    focusedRef.current = false;
    if (text.trim() === '') {
      setError(null);
      if (value !== '') onChange('');
      return;
    }
    const parsed = parseDayInput(text);
    if (parsed === null) {
      setError('Use a date like 11 May 2028');
      return;
    }
    setError(null);
    setText(formatDayInput(parsed));
    if (parsed !== value) onChange(parsed);
  }

  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        value={text}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
      />
      {error ? (
        <span id={errorId} className="chq-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
