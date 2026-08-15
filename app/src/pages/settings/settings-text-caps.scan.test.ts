// DEC-417/w63-e: every settings free-text control (a JSX element whose
// className carries `chq-input`/`chq-textarea`) must declare the same
// character cap its owning route enforces, so a producer typing past the
// server's limit sees a hard stop in the field rather than a 400 after
// filling out the whole form. This scan enumerates every .tsx file under
// app/src/pages/settings/** (DEC-808 readdirSync({recursive:true}) idiom,
// never a hand-listed manifest) and fails, naming file+line, for any
// chq-input/chq-textarea element that carries neither a `maxLength=`
// attribute nor `type="number"|"date"|"checkbox"` — unless it is named in
// the EXEMPTIONS ledger below with a principled reason (a value that never
// reaches a capping route, or is bounded by some other real mechanism).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SETTINGS_ROOT = HERE;

interface Exemption {
  file: string;
  control: string;
  reason: string;
}

// Every entry here is a *value that never reaches a capping route* (a
// read-only copy-fallback echo of an already-validated value, a value the
// route never reads, or a value validated by some other closed grammar
// such as a hex-color regex or a byte budget) — never a hand-typed number
// standing in for a route's real cap.
const EXEMPTIONS: Exemption[] = [
  {
    file: 'EventSettingsPanel.tsx',
    control: 'event-settings-record-prefix',
    reason: 'read-only display field (recordPrefix, set at event creation), never submitted to the server',
  },
  {
    file: 'EventSettingsPanel.tsx',
    control: 'event-settings-accent-color',
    reason: 'validated as hex color format (isValidHexColor), not length-capped',
  },
  {
    file: 'TracksRoomsPanel.tsx',
    control: 'Capacity',
    reason:
      'numeric capacity rendered as a text input; validated server-side as a non-negative integer (events.ts createRoom/updateRoom), not a text length cap',
  },
  {
    file: 'TracksRoomsPanel.tsx',
    control: 'chq-new-room-capacity',
    reason:
      'numeric capacity rendered as a text input; validated server-side as a non-negative integer (events.ts createRoom), not a text length cap',
  },
  {
    file: 'CallForPapersPanel.tsx',
    control: 'Public link to copy manually',
    reason: 'read-only copy-fallback echo of an already-validated public link, not user input',
  },
  {
    file: 'PortalSettingsPanel.tsx',
    control: 'chq-portal-accent-color',
    reason: 'validated as hex color format (isValidHexColor), not length-capped',
  },
  {
    file: 'PeopleRolesPanel.tsx',
    control: 'people-invite-first-name',
    reason: 'POST /api/v1/users does not read firstName -- no capping route reaches this field',
  },
  {
    file: 'PeopleRolesPanel.tsx',
    control: 'people-invite-last-name',
    reason: 'POST /api/v1/users does not read lastName -- no capping route reaches this field',
  },
  {
    file: 'EmbedsPanel.tsx',
    control: 'embed-accent-color',
    reason: 'validated as hex color format (parseAccent, src/routes/api/embeds.ts), not length-capped',
  },
  {
    file: 'EmbedsPanel.tsx',
    control: 'embed-copy-fallback',
    reason: 'read-only copy-fallback echo of an already-built embed URL/snippet, not user input',
  },
  {
    file: 'ApiTokensPanel.tsx',
    control: 'API token to copy manually',
    reason: 'read-only copy-fallback echo of an already-minted token, not user input',
  },
  {
    file: 'SessionboardImportPanel.tsx',
    control: 'name,email,company...',
    reason: 'bounded in bytes via MAX_IMPORT_CSV_BYTES (TextEncoder), not chars',
  },
];

function isExempt(file: string, control: string): boolean {
  return EXEMPTIONS.some((e) => e.file === file && e.control === control);
}

/** Every .tsx file directly under app/src/pages/settings/**, excluding tests. */
function settingsFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(SETTINGS_ROOT, { withFileTypes: true, recursive: true })) {
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

function hasExemptType(tagSrc: string): boolean {
  return /\btype\s*=\s*["']\s*(number|date|checkbox)\s*["']/.test(tagSrc);
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
    const relFile = relative(SETTINGS_ROOT, path);
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

describe('every settings chq-input/chq-textarea declares the cap its route enforces (DEC-417, w63-e)', () => {
  const FILES = settingsFiles();

  it('scanned more than one settings panel file', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('no unexempted chq-input/chq-textarea is missing both maxLength and an exempt type', () => {
    const offenders = scan(FILES);
    const rendered = offenders.map((o) => `${o.file}:${o.line} (control="${o.control}")`).join('\n');
    expect(offenders, `uncapped settings text controls:\n${rendered}`).toEqual([]);
  });

  // Positive control: a synthetic uncapped chq-input IS flagged.
  it('positive control: a synthetic uncapped chq-input is flagged', () => {
    const src = `<input id="widget-name" className="chq-input" value={x} onChange={(e) => set(e.target.value)} />`;
    const tags = findTags(src);
    expect(tags.length).toBe(1);
    expect(isChqTextControl(tags[0]!.src)).toBe(true);
    expect(hasMaxLength(tags[0]!.src)).toBe(false);
    expect(hasExemptType(tags[0]!.src)).toBe(false);
  });

  // Negative control: a synthetic capped chq-input is NOT flagged.
  it('negative control: a synthetic capped chq-input is not flagged', () => {
    const src = `<input id="widget-name" className="chq-input" maxLength={200} value={x} onChange={(e) => set(e.target.value)} />`;
    const tags = findTags(src);
    expect(tags.length).toBe(1);
    expect(isChqTextControl(tags[0]!.src)).toBe(true);
    expect(hasMaxLength(tags[0]!.src)).toBe(true);
  });

  // Negative control: a synthetic type="number" chq-input is not flagged
  // even with no maxLength.
  it('negative control: a synthetic type="number" chq-input is not flagged', () => {
    const src = `<input id="widget-count" className="chq-input" type="number" value={x} onChange={(e) => set(e.target.value)} />`;
    const tags = findTags(src);
    expect(hasExemptType(tags[0]!.src)).toBe(true);
  });

  // Every exemption row names a file this scan actually visits, and a
  // control it actually finds -- so a stale/renamed ledger entry can never
  // silently stop exempting anything (it would surface as a fresh offender
  // instead of a quiet no-op).
  it('every exemption is still exercised by a real chq-input/chq-textarea in its file', () => {
    const byFile = new Map<string, string[]>();
    for (const path of FILES) {
      const src = readFileSync(path, 'utf-8');
      const relFile = relative(SETTINGS_ROOT, path);
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
