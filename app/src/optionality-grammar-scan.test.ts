// DEC-917: one optionality grammar across every dialog and form row in the
// SPA -- required rows carry no marker, optional rows append the shared
// ' · optional' suffix, and no surface in the product marks a field with an
// asterisk (Scorecard.tsx used to print a bare ' *' on required text
// criteria). This scans every non-test source file under app/src for that
// dead literal so it can't come back.
//
// w48-b amendment: the same scan also bans hand-typed variants of the
// suffix itself -- `· Optional`, `· OPTIONAL`, `(optional)`, `(Optional)` --
// found live at PlanEditor.tsx:1374 (rendered uppercase by its container,
// since the guard below only ever checked for the dead asterisk). A single
// literal in one file is not a grammar; only the shared OPTIONAL_SUFFIX
// constant (src/domain/form-copy.ts) is.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

// SHORT, reasoned exemption list (max two entries): these two files render
// a table/chip STATUS value -- "Required" / "Optional" describing a field
// definition's own required-ness as a column value, not a ' · optional'
// suffix appended after a field label. They are a different kind of
// content (a status, read on its own, never concatenated onto a label) so
// DEC-917's field-suffix grammar does not apply to them.
const EXEMPT_OPTIONAL_LITERAL_FILES = new Set([
  join(APP_SRC, 'pages', 'forms', 'FieldList.tsx'), // required/optional column value in the fields table
  join(APP_SRC, 'pages', 'forms', 'FormsPage.tsx'), // required/optional status echoed in the forms list
]);

const HAND_TYPED_SUFFIX_LITERALS = ['· Optional', '· OPTIONAL', '(optional)', '(Optional)'];

describe('DEC-917: no required-marker asterisk literal survives in app/src', () => {
  it('no source file (outside tests) renders a bare " *" required marker', () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      const source = readFileSync(file, 'utf8');
      if (source.includes("' *'") || source.includes('" *"')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('DEC-917 (w48-b): no hand-typed variant of the optionality suffix survives in app/src', () => {
  it('no non-exempt source file spells out "· Optional", "· OPTIONAL", "(optional)" or "(Optional)"', () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      if (EXEMPT_OPTIONAL_LITERAL_FILES.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (HAND_TYPED_SUFFIX_LITERALS.some((literal) => source.includes(literal))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every file rendering the shared optional-suffix CSS hook imports OPTIONAL_SUFFIX rather than a string literal', () => {
    // These two classes are the shared ' · optional' visual hook for
    // DEC-917's grammar (chq-review-criterion-optional: Scorecard.tsx,
    // PlanEditor.tsx; chq-settings-field-optional: SettingsEditForm.tsx) --
    // a file that renders one of these classes but never imports the
    // shared constant is hand-typing the suffix text instead of reusing it.
    // NOTE: this deliberately does not match every "*-optional" class in
    // app/src -- e.g. PipelineBoard.tsx's chq-contacts-pipeline-field-
    // optional is a documented, differently-worded helper ('optional' with
    // no ' · ' prefix), not this shared suffix, and is out of scope here.
    const SUFFIX_CLASSES = ['chq-review-criterion-optional', 'chq-settings-field-optional'];
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      if (EXEMPT_OPTIONAL_LITERAL_FILES.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      const rendersSuffixHook = SUFFIX_CLASSES.some((cls) => source.includes(cls));
      if (rendersSuffixHook && !source.includes('OPTIONAL_SUFFIX')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
