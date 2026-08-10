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

export function kindLabel(kind: FormFieldKind): string {
  switch (kind) {
    case 'text':
      return 'Short text';
    case 'long_text':
      return 'Long text';
    case 'dropdown':
      return 'Dropdown';
    case 'checkbox':
      return 'Checkbox';
    case 'number':
      return 'Number';
    case 'file':
      return 'File';
  }
}
