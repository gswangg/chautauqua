// DEC-417/w63-e, generalized DEC-660 (w1-d): every free-text control (a JSX
// element whose className carries `chq-input`/`chq-textarea`) anywhere in
// app/src must declare the same character cap its owning route enforces, so
// a producer typing past the server's limit sees a hard stop in the field
// rather than a 400 after filling out the whole form. This scan enumerates
// EVERY .tsx file under app/src/** (DEC-808 readdirSync({recursive:true})
// idiom, never a hand-listed manifest -- the population is "every
// chq-input/chq-textarea occurrence in app/src", not one directory) and
// fails, naming file+line, for any chq-input/chq-textarea element that
// carries neither a `maxLength=` attribute nor
// `type="number"|"date"|"time"|"checkbox"` -- unless it is named in the
// EXEMPTIONS ledger below with a principled reason (a value that never
// reaches a capping route, or is bounded by some other real mechanism).
//
// This file supersedes the former settings-only
// pages/settings/settings-text-caps.scan.test.ts -- the settings ledger
// entries below are carried over unchanged; every other entry is new in
// w1-d.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE is app/src itself -- the scan's population is every .tsx file in
// this directory tree, not one page's subdirectory.
const SRC_ROOT = HERE;

interface Exemption {
  file: string;
  control: string;
  reason: string;
}

// Every entry here is a *value that never reaches a capping route* (a
// read-only copy-fallback echo of an already-validated value, a value the
// route never reads, a query/filter value that is never persisted, or a
// value validated by some other closed grammar such as a hex-color regex,
// an option vocabulary, or a byte budget) -- never a hand-typed number
// standing in for a route's real cap.
const EXEMPTIONS: Exemption[] = [
  // --- carried over from the former settings-only scan ---
  {
    file: 'pages/settings/EventSettingsPanel.tsx',
    control: 'event-settings-record-prefix',
    reason: 'read-only display field (recordPrefix, set at event creation), never submitted to the server',
  },
  {
    file: 'pages/settings/EventSettingsPanel.tsx',
    control: 'event-settings-accent-color',
    reason: 'validated as hex color format (isValidHexColor), not length-capped',
  },
  {
    file: 'pages/settings/TracksRoomsPanel.tsx',
    control: 'Capacity',
    reason:
      'numeric capacity rendered as a text input; validated server-side as a non-negative integer (events.ts createRoom/updateRoom), not a text length cap',
  },
  {
    file: 'pages/settings/TracksRoomsPanel.tsx',
    control: 'chq-new-room-capacity',
    reason:
      'numeric capacity rendered as a text input; validated server-side as a non-negative integer (events.ts createRoom), not a text length cap',
  },
  {
    file: 'pages/settings/CallForPapersPanel.tsx',
    control: 'Public link to copy manually',
    reason: 'read-only copy-fallback echo of an already-validated public link, not user input',
  },
  {
    file: 'pages/settings/PortalSettingsPanel.tsx',
    control: 'chq-portal-accent-color',
    reason: 'validated as hex color format (isValidHexColor), not length-capped',
  },
  {
    file: 'pages/settings/PeopleRolesPanel.tsx',
    control: 'people-invite-first-name',
    reason: 'POST /api/v1/users does not read firstName -- no capping route reaches this field',
  },
  {
    file: 'pages/settings/PeopleRolesPanel.tsx',
    control: 'people-invite-last-name',
    reason: 'POST /api/v1/users does not read lastName -- no capping route reaches this field',
  },
  {
    file: 'pages/settings/EmbedsPanel.tsx',
    control: 'embed-accent-color',
    reason: 'validated as hex color format (parseAccent, src/routes/api/embeds.ts), not length-capped',
  },
  {
    // w4-d/DEC-785 amendment: this control moved into the shared
    // EmbedCodeReadout component (used by both EmbedsPanel's builder and
    // SavedEmbedsPanel's "Get code" row).
    file: 'pages/settings/EmbedCodeReadout.tsx',
    control: 'embed-copy-fallback',
    reason: 'read-only copy-fallback echo of an already-built embed URL/snippet, not user input',
  },
  {
    file: 'pages/settings/ApiTokensPanel.tsx',
    control: 'API token to copy manually',
    reason: 'read-only copy-fallback echo of an already-minted token, not user input',
  },
  {
    file: 'pages/settings/PeopleRolesPanel.tsx',
    control: 'One-time password to copy manually',
    reason: 'read-only copy-fallback echo of an already-generated password (DEC-747 wave 58), not user input',
  },
  {
    file: 'pages/settings/SessionboardImportPanel.tsx',
    control: 'name,email,company...',
    reason: 'bounded in bytes via MAX_IMPORT_CSV_BYTES (TextEncoder), not chars',
  },
  // --- new in w1-d (DEC-660 amendment) ---
  {
    file: 'pages/comms/ComposeWizard.tsx',
    control: 'Search submissions',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/comms/HistoryTab.tsx',
    control: 'Search email history',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/contacts/ContactDrawer.tsx',
    control: 'T-shirt size',
    reason:
      'custom-field KEY input; POST/PATCH /contacts only length-checks customFields.<key> VALUES (crud.ts), never the key itself',
  },
  {
    file: 'pages/contacts/ContactsApp.tsx',
    control: 'Search contacts',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/contacts/FilterRulesPanel.tsx',
    control: 'control-1',
    reason:
      'GET /contacts?rules= custom-field-key operand -- a client-side filter value, never persisted, no capping route reaches it',
  },
  {
    file: 'pages/contacts/FilterRulesPanel.tsx',
    control: 'control-2',
    reason:
      'GET /contacts?rules= value operand -- a client-side filter value, never persisted, no capping route reaches it',
  },
  {
    file: 'pages/contacts/ImportWizard.tsx',
    control: 'import-csv-text',
    reason: 'bounded in bytes via MAX_IMPORT_CSV_BYTES (TextEncoder), not chars',
  },
  {
    file: 'pages/contacts/PipelineBoard.tsx',
    control: 'pipeline-enroll-contact-search',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/content/FilesLibrary.tsx',
    control: 'Search files',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/forms/FieldModal.tsx',
    control: 'field-options',
    reason:
      'newline-separated dropdown options; builder.ts caps each OPTION at MAX_NAME_LENGTH individually, not the whole textarea',
  },
  {
    file: 'pages/forms/FieldModal.tsx',
    control: 'field-rule-value',
    reason:
      "validated against the trigger field's option vocabulary (rule-match.ts), a closed grammar, not a length cap",
  },
  {
    file: 'pages/review/PlanEditor.tsx',
    control: 'Options (comma-separated)',
    reason: 'review/shared.ts requires non-empty string options for a dropdown criterion but applies no length cap',
  },
  {
    file: 'pages/review/PlanEditor.tsx',
    control: 'reviewer@example.com',
    reason: 'new reviewer email is format-validated (isValidEmail) only -- no length-capping route reaches it',
  },
  {
    file: 'pages/review/PlanEditor.tsx',
    control: 'Reviewer password to copy manually',
    reason: 'read-only copy-fallback echo of an already-minted password, not user input',
  },
  {
    file: 'pages/speakers/GridFilters.tsx',
    control: 'Search speakers',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/submissions/FilterBar.tsx',
    control: 'Search submissions',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'pages/submissions/NewSubmissionModal.tsx',
    control: 'new-submission-title',
    reason:
      'POST .../submissions caps title via LOCKED_TITLE_MAX_LENGTH (src/forms/types.ts), a locked-field cap distinct from text-caps.ts\'s four free-text constants -- out of scope for this crossing (DEC-660/w1-d)',
  },
  {
    file: 'pages/submissions/NewSubmissionModal.tsx',
    control: 'new-submission-description',
    reason:
      'POST .../submissions caps description via LOCKED_ABSTRACT_MAX_LENGTH (src/forms/types.ts), a locked-field cap distinct from text-caps.ts\'s four free-text constants -- out of scope for this crossing (DEC-660/w1-d)',
  },
  {
    file: 'pages/submissions/NewSubmissionModal.tsx',
    control: 'new-submission-speaker-name',
    reason:
      'POST .../submissions trims contact.firstName/lastName but never length-checks them -- no capping route reaches this field',
  },
  {
    file: 'pages/submissions/NewSubmissionModal.tsx',
    control: 'new-submission-email',
    reason: 'POST .../submissions validates contact.email as a format (isValidEmail) only, never a length cap',
  },
  {
    file: 'pages/submissions/SubmissionDetailPage.tsx',
    control: 'submission-add-copresenter-contact',
    reason: 'search/filter query, never persisted -- no capping route reaches this field',
  },
  {
    file: 'components/ConfirmDialog.tsx',
    control: 'chq-confirm-typed-input',
    reason:
      "DEC-941 (wave-58 amendment) irreversible-weight type-to-confirm echo, compared client-side against confirmPhrase only -- never sent to the server, so no capping route reaches it",
  },
];

function isExempt(file: string, control: string): boolean {
  return EXEMPTIONS.some((e) => e.file === file && e.control === control);
}

/** Every .tsx file under app/src/**, excluding tests. */
function srcFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(SRC_ROOT, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface Tag {
  src: string;
  start: number;
  lineNumber: number;
}

/** Finds every `<input ...>`/`<textarea ...>` opening tag in `src`, using
 * brace-depth tracking (not a naive '>'-search) so a `>` inside a JSX
 * expression attribute (e.g. an arrow function `onChange={(e) => ...}`)
 * never mistakenly closes the tag early. */
function findTags(src: string): Tag[] {
  const tags: Tag[] = [];
  const tagStartRe = /<(input|textarea)(?=[\s/>])/g;
  let match: RegExpExecArray | null;
  while ((match = tagStartRe.exec(src)) !== null) {
    const start = match.index;
    let depth = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue; // malformed / unterminated -- skip rather than false-positive
    const tagSrc = src.slice(start, end + 1);
    const lineNumber = src.slice(0, start).split('\n').length;
    tags.push({ src: tagSrc, start, lineNumber });
  }
  return tags;
}

function isChqTextControl(tagSrc: string): boolean {
  return tagSrc.includes('chq-input') || tagSrc.includes('chq-textarea');
}

function hasMaxLength(tagSrc: string): boolean {
  return /\bmaxLength\s*=/.test(tagSrc);
}

// "time" joins number/date/checkbox: a browser time-picker control, not an
// arbitrary-length text field, so it needs no character cap.
function hasExemptType(tagSrc: string): boolean {
  return /\btype\s*=\s*["']\s*(number|date|time|checkbox)\s*["']/.test(tagSrc);
}

/** id > static aria-label > static placeholder > positional fallback --
 * whichever the element actually carries, in that priority order, so the
 * ledger can name a real, human-checkable control rather than a synthetic
 * index alone. */
function controlLabel(tagSrc: string, ordinal: number): string {
  const id = tagSrc.match(/\bid=["']([^"']+)["']/);
  if (id) return id[1]!;
  const ariaLabel = tagSrc.match(/aria-label=["']([^"']+)["']/);
  if (ariaLabel) return ariaLabel[1]!;
  const placeholder = tagSrc.match(/placeholder=["']([^"']+)["']/);
  if (placeholder) return placeholder[1]!;
  return `control-${ordinal}`;
}

interface Offender {
  file: string;
  line: number;
  control: string;
}

function scan(files: string[]): Offender[] {
  const offenders: Offender[] = [];
  for (const path of files) {
    const src = readFileSync(path, 'utf-8');
    const relFile = relative(SRC_ROOT, path);
    let ordinal = 0;
    for (const tag of findTags(src)) {
      if (!isChqTextControl(tag.src)) continue;
      ordinal++;
      if (hasMaxLength(tag.src) || hasExemptType(tag.src)) continue;
      const control = controlLabel(tag.src, ordinal);
      if (isExempt(relFile, control)) continue;
      offenders.push({ file: relFile, line: tag.lineNumber, control });
    }
  }
  return offenders;
}

describe('every app/src chq-input/chq-textarea declares the cap its route enforces (DEC-417/DEC-660, w1-d)', () => {
  const FILES = srcFiles();

  it('scanned far more than the former settings-only population', () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  it('no unexempted chq-input/chq-textarea is missing both maxLength and an exempt type', () => {
    const offenders = scan(FILES);
    const rendered = offenders.map((o) => `${o.file}:${o.line} (control="${o.control}")`).join('\n');
    expect(offenders, `uncapped text controls:\n${rendered}`).toEqual([]);
  });

  // Positive control: a synthetic uncapped chq-input IS flagged by the full
  // scan pipeline (found, not exempt, no maxLength/exempt type -> offender).
  it('positive control: a synthetic uncapped chq-input is detected as an offender', () => {
    const src = `<input id="synthetic-undeclared-widget" className="chq-input" value={x} onChange={(e) => set(e.target.value)} />`;
    const tags = findTags(src);
    expect(tags.length).toBe(1);
    const tag = tags[0]!;
    expect(isChqTextControl(tag.src)).toBe(true);
    expect(hasMaxLength(tag.src)).toBe(false);
    expect(hasExemptType(tag.src)).toBe(false);
    const control = controlLabel(tag.src, 1);
    expect(control).toBe('synthetic-undeclared-widget');
    expect(isExempt('pages/nowhere/Nowhere.tsx', control)).toBe(false);
    // i.e. this control would be pushed onto `offenders` by scan().
  });

  // Negative control: a synthetic capped chq-input is NOT flagged.
  it('negative control: a synthetic capped chq-input is not flagged', () => {
    const src = `<input id="widget-name" className="chq-input" maxLength={200} value={x} onChange={(e) => set(e.target.value)} />`;
    const tags = findTags(src);
    expect(tags.length).toBe(1);
    expect(isChqTextControl(tags[0]!.src)).toBe(true);
    expect(hasMaxLength(tags[0]!.src)).toBe(true);
  });

  // Negative control: a synthetic type="number"/"time" chq-input is not
  // flagged even with no maxLength.
  it('negative control: a synthetic type="number"/"time" chq-input is not flagged', () => {
    const numberSrc = `<input id="widget-count" className="chq-input" type="number" value={x} onChange={(e) => set(e.target.value)} />`;
    const timeSrc = `<input id="widget-time" className="chq-input" type="time" value={x} onChange={(e) => set(e.target.value)} />`;
    expect(hasExemptType(findTags(numberSrc)[0]!.src)).toBe(true);
    expect(hasExemptType(findTags(timeSrc)[0]!.src)).toBe(true);
  });

  // Every exemption row names a file this scan actually visits, and a
  // control it actually finds -- so a stale/renamed ledger entry can never
  // silently stop exempting anything (it would surface as a fresh offender
  // instead of a quiet no-op).
  it('every exemption is still exercised by a real chq-input/chq-textarea in its file', () => {
    const byFile = new Map<string, string[]>();
    for (const path of FILES) {
      const src = readFileSync(path, 'utf-8');
      const relFile = relative(SRC_ROOT, path);
      const controls: string[] = [];
      let ordinal = 0;
      for (const tag of findTags(src)) {
        if (!isChqTextControl(tag.src)) continue;
        ordinal++;
        controls.push(controlLabel(tag.src, ordinal));
      }
      byFile.set(relFile, controls);
    }
    for (const exemption of EXEMPTIONS) {
      const controls = byFile.get(exemption.file) ?? [];
      expect(
        controls,
        `exemption ${exemption.file}/${exemption.control} names no real control in that file`,
      ).toContain(exemption.control);
    }
  });
});
