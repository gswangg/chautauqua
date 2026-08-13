// Wire types for the J1 form-builder SPA (DEC-033), mirroring the DEC-008
// FormFieldDef shape as serialized by src/routes/api/forms.ts.

export type FormFieldSection = 'session' | 'speaker';
export type FormFieldKind = 'text' | 'long_text' | 'dropdown' | 'checkbox' | 'number' | 'file';
export type FormFieldRuleOp = 'eq' | 'ne' | 'in';

export interface FormFieldRule {
  fieldId: string;
  op: FormFieldRuleOp;
  value: unknown;
}

export interface FormField {
  id: string;
  section: FormFieldSection;
  kind: FormFieldKind;
  label: string;
  helpText?: string;
  required: boolean;
  position: number;
  options?: string[];
  rule?: FormFieldRule;
  locked: boolean;
}

export interface CfpForm {
  id: string;
  eventId: string;
  title: string;
  intro?: string | null;
  isDefault: boolean;
  openDate?: number | null;
  closeDate?: number | null;
  tracks?: string[] | null;
  fields: FormField[];
}

export interface EventTrack {
  id: string;
  name: string;
  color?: string | null;
}

export const FIELD_KINDS: readonly FormFieldKind[] = ['text', 'long_text', 'dropdown', 'checkbox', 'number', 'file'];
export const RULE_OPS: readonly FormFieldRuleOp[] = ['eq', 'ne', 'in'];

// ONE organiser-facing label per field kind (DEC-762), audited against the
// design pack (docs/design/Chautauqua Submissions.dc.html): the wire kind
// stays 'dropdown' but the pack's word for it is "Single choice". Every
// place the builder shows a kind name -- the Kind select, the field-list
// row, and error copy -- reads this map, never a second hand-typed literal.
export const FIELD_KIND_LABELS: Record<FormFieldKind, string> = {
  text: 'Short text',
  long_text: 'Long text',
  dropdown: 'Single choice',
  checkbox: 'Checkbox',
  number: 'Number',
  file: 'File',
};

export function kindLabel(kind: FormFieldKind): string {
  return FIELD_KIND_LABELS[kind];
}
