// Portal editor (Portals frame, flow 2): the draft the editor page edits and
// the pure helpers around it -- turning it into the PUT/preview body,
// telling whether it changed, the rule's completeness, the matches-nobody
// sentence, field levels and the permission lines the change preview lists.
import {
  RULE_OP_LABELS,
  VALUELESS_OPS,
  describeRule,
  type PortalRule,
  type RuleCondition,
  type RuleOp,
} from '../../../../src/domain/portals/rules';
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  COMPANY_ONLY_CAPABILITIES,
  DEFAULT_FIELD_LEVELS,
  FIELD_LEVEL_LABELS,
  PERMISSION_FIELDS,
  PERMISSION_FIELD_LABELS,
  type FieldLevel,
  type PermissionField,
} from '../../../../src/domain/portals/permissions';
import type { DeadlineKind, ItemScope, SystemItemKind } from '../../../../src/domain/portals/items';
import { msToDateInput } from '../../lib/dates';
import type {
  Capabilities,
  EditorItem,
  FieldPermissions,
  LibraryEntry,
  PortalEditorData,
  PortalItemInput,
  PortalInput,
  RuleFieldOption,
} from './types';

export { RULE_OP_LABELS, VALUELESS_OPS };
export type { RuleOp, RuleCondition };

// The wire body PUT /portals/:id and POST .../preview read: a fixed
// deadline travels as a YYYY-MM-DD day (parsePortalInput's parseDay), not
// the epoch the GET returns.
export interface PortalItemWire extends Omit<PortalItemInput, 'dueDate'> {
  dueDate: string | null;
}

export interface PortalInputWire extends Omit<PortalInput, 'items'> {
  items: PortalItemWire[];
}

export interface DraftItem {
  key: string;
  taskId: string | null;
  resourceId: string | null;
  systemKind: SystemItemKind | null;
  displayName: string;
  deadlineKind: DeadlineKind;
  // YYYY-MM-DD, '' while unset
  dueDate: string;
  relativeDays: number | null;
  required: boolean;
  graceDays: number;
  allowEditAfterSubmit: boolean;
  viewOnlyWhenDone: boolean;
  title: string;
  kind: string;
  scope: ItemScope;
  libraryHint: string;
}

export interface PortalDraft {
  name: string;
  note: string;
  rule: PortalRule;
  fieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  notifyOnJoin: boolean;
  items: DraftItem[];
}

type ItemRef = { taskId: string | null; resourceId: string | null; systemKind: string | null };

export function itemKey(ref: ItemRef): string {
  if (ref.taskId) return `task:${ref.taskId}`;
  if (ref.resourceId) return `resource:${ref.resourceId}`;
  return `sys:${ref.systemKind}`;
}

export function libraryEntryKey(entry: LibraryEntry): string {
  const ref = entry.ref as Partial<{ taskId: string; resourceId: string; systemKind: string }>;
  return itemKey({ taskId: ref.taskId ?? null, resourceId: ref.resourceId ?? null, systemKind: ref.systemKind ?? null });
}

function draftItemFrom(item: EditorItem): DraftItem {
  return {
    key: itemKey(item),
    taskId: item.taskId,
    resourceId: item.resourceId,
    systemKind: item.systemKind,
    displayName: item.displayName ?? '',
    deadlineKind: item.deadlineKind,
    dueDate: item.deadlineKind === 'fixed' ? msToDateInput(item.dueDate) : '',
    relativeDays: item.deadlineKind === 'relative' ? item.relativeDays : null,
    required: item.required,
    graceDays: item.graceDays,
    allowEditAfterSubmit: item.allowEditAfterSubmit,
    viewOnlyWhenDone: item.viewOnlyWhenDone,
    title: item.title,
    kind: item.kind,
    scope: item.scope === 'participation' ? 'participation' : 'person',
    libraryHint: item.libraryHint,
  };
}

export function draftFromEditor(data: PortalEditorData): PortalDraft {
  const { portal } = data;
  return {
    name: portal.name,
    note: portal.note ?? '',
    rule: portal.rule,
    fieldPermissions: portal.fieldPermissions,
    capabilities: portal.capabilities,
    notifyOnJoin: portal.notifyOnJoin,
    items: data.items.map(draftItemFrom),
  };
}

/** A library entry as a new draft item: no deadline, required, no grace --
 * the per-portal settings are chosen in the items table afterwards. */
export function draftItemFromLibrary(entry: LibraryEntry): DraftItem {
  const ref = entry.ref as Partial<{ taskId: string; resourceId: string; systemKind: string }>;
  const others = entry.usedBy.map((u) => u.name);
  return {
    key: libraryEntryKey(entry),
    taskId: ref.taskId ?? null,
    resourceId: ref.resourceId ?? null,
    systemKind: (ref.systemKind as SystemItemKind | undefined) ?? null,
    displayName: '',
    deadlineKind: 'none',
    dueDate: '',
    relativeDays: null,
    required: entry.type !== 'resource',
    graceDays: 0,
    allowEditAfterSubmit: false,
    viewOnlyWhenDone: false,
    title: entry.title,
    kind: entry.type === 'built_in' ? (ref.systemKind ?? 'built_in') : entry.type,
    scope: entry.scope,
    libraryHint: entry.type === 'built_in' ? 'Built in' : others.length > 0 ? `Shared library item · also in ${others.join(', ')}` : 'Shared library item',
  };
}

function itemToWire(item: DraftItem): PortalItemWire {
  return {
    taskId: item.taskId,
    resourceId: item.resourceId,
    systemKind: item.systemKind,
    displayName: item.displayName.trim() === '' ? null : item.displayName.trim(),
    deadlineKind: item.deadlineKind,
    dueDate: item.deadlineKind === 'fixed' && item.dueDate !== '' ? item.dueDate : null,
    relativeDays: item.deadlineKind === 'relative' ? item.relativeDays : null,
    required: item.required,
    // grace with no deadline is inert; it is sent as stored so a save that
    // never touched the item doesn't read as an item change
    graceDays: item.graceDays,
    allowEditAfterSubmit: item.allowEditAfterSubmit,
    viewOnlyWhenDone: item.viewOnlyWhenDone,
  };
}

export function draftToInput(draft: PortalDraft): PortalInputWire {
  return {
    name: draft.name.trim(),
    note: draft.note.trim() === '' ? null : draft.note,
    rule: draft.rule,
    fieldPermissions: draft.fieldPermissions,
    capabilities: draft.capabilities,
    notifyOnJoin: draft.notifyOnJoin,
    items: draft.items.map(itemToWire),
  };
}

export function sameDraft(a: PortalDraft, b: PortalDraft): boolean {
  return JSON.stringify(draftToInput(a)) === JSON.stringify(draftToInput(b));
}

export function sameRule(a: PortalRule, b: PortalRule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function isValueless(op: RuleOp): boolean {
  return VALUELESS_OPS.includes(op);
}

export function isMultiOp(op: RuleOp): boolean {
  return op === 'is_any_of' || op === 'is_none_of';
}

export function conditionComplete(c: RuleCondition): boolean {
  return isValueless(c.op) || c.values.length > 0;
}

/** The rule with every unfinished condition (a test still waiting for its
 * value) left out: what the live matches count. */
export function completeRule(rule: PortalRule): PortalRule {
  return { groups: rule.groups.map((g) => ({ conditions: g.conditions.filter(conditionComplete) })) };
}

export function ruleHasIncomplete(rule: PortalRule): boolean {
  return rule.groups.some((g) => g.conditions.some((c) => !conditionComplete(c)));
}

export function ruleHasConditions(rule: PortalRule): boolean {
  return rule.groups.some((g) => g.conditions.some(conditionComplete));
}

/** Changing a condition's test keeps what still fits: a single value when
 * moving from "is any of" to "is", nothing for "is empty". */
export function withOp(c: RuleCondition, op: RuleOp): RuleCondition {
  if (isValueless(op)) return { ...c, op, values: [] };
  if (!isMultiOp(op)) return { ...c, op, values: c.values.slice(0, 1) };
  return { ...c, op };
}

export function ruleLabels(options: RuleFieldOption[]) {
  const byField = new Map(options.map((o) => [o.field, o]));
  return {
    field: (f: string) => byField.get(f)?.label ?? f,
    value: (f: string, v: string) => byField.get(f)?.values.find((x) => x.value === v)?.label ?? v,
  };
}

/** Frame 04: "No one has the role Volunteer yet." -- the first line of the
 * matches-nobody panel, read from the rule as edited. */
export function matchesNobodyLine(rule: PortalRule, options: RuleFieldOption[]): string {
  const complete = completeRule(rule);
  const groups = complete.groups.filter((g) => g.conditions.length > 0);
  if (groups.length === 0) return 'The rule has no conditions yet, so it matches nobody.';
  const labels = ruleLabels(options);
  const only = groups.length === 1 && groups[0]!.conditions.length === 1 ? groups[0]!.conditions[0]! : null;
  if (only && only.field === 'role' && (only.op === 'is' || only.op === 'is_any_of')) {
    const names = only.values.map((v) => labels.value('role', v));
    const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
    return `No one has the role ${list} yet.`;
  }
  return `Nobody matches ${describeRule(complete, labels)} yet.`;
}

// Whether some company participation (a sponsor contact) could satisfy one
// condition. Session fields are empty on a company participation; tier,
// sponsorship status, participation status and custom fields could hold
// anything.
const SESSION_ONLY_FIELDS = new Set(['arrival', 'format', 'track', 'session_status']);

function companyCanSatisfy(c: RuleCondition): boolean {
  let have: string[] | null = null;
  if (c.field === 'kind') have = ['company'];
  else if (c.field === 'role') have = ['contact'];
  else if (SESSION_ONLY_FIELDS.has(c.field)) have = [];
  if (have === null) return true;
  const hit = have.some((h) => c.values.some((v) => v.toLowerCase() === h));
  switch (c.op) {
    case 'is':
    case 'is_any_of':
      return hit;
    case 'is_not':
    case 'is_none_of':
      return !hit;
    case 'is_empty':
      return have.length === 0;
    case 'is_not_empty':
      return have.length > 0;
  }
}

/** Teammates and sponsor sessions only mean anything on a sponsor-company
 * participation: they are offered once some "or" group of the rule could
 * match a sponsor contact. */
export function ruleCanMatchCompanies(rule: PortalRule): boolean {
  return completeRule(rule).groups.some((g) => g.conditions.length > 0 && g.conditions.every(companyCanSatisfy));
}

export { COMPANY_ONLY_CAPABILITIES, CAPABILITIES, CAPABILITY_LABELS };

// ---------------------------------------------------------------------------
// Field permissions
// ---------------------------------------------------------------------------

export { PERMISSION_FIELDS, PERMISSION_FIELD_LABELS, FIELD_LEVEL_LABELS };
export type { FieldLevel, PermissionField };

export function fieldLevel(perms: FieldPermissions, field: PermissionField): FieldLevel {
  return perms[field]?.level ?? DEFAULT_FIELD_LEVELS[field];
}

// The levels the API offers (PortalEditorData.fieldLevels), in its order.
// Email is the sign-in address: participants never edit it here.
export function levelsFor(field: PermissionField, offered: readonly string[]): FieldLevel[] {
  const levels = offered.filter((l): l is FieldLevel => l === 'hidden' || l === 'view' || l === 'edit');
  return field === 'email' ? levels.filter((l) => l !== 'edit') : levels;
}

/** Sets one field's level. A field the saved portal never named, set back
 * to its default with no help text, is dropped again, so the body only
 * names the fields the organizer decided. */
export function setFieldLevel(perms: FieldPermissions, saved: FieldPermissions, field: PermissionField, level: FieldLevel): FieldPermissions {
  const next = { ...perms };
  const help = perms[field]?.help;
  if (!saved[field] && level === DEFAULT_FIELD_LEVELS[field] && !help) delete next[field];
  else next[field] = help ? { level, help } : { level };
  return next;
}

export function setFieldHelp(perms: FieldPermissions, saved: FieldPermissions, field: PermissionField, help: string): FieldPermissions {
  const next = { ...perms };
  const level = fieldLevel(perms, field);
  if (help === '' && !saved[field] && level === DEFAULT_FIELD_LEVELS[field]) delete next[field];
  else next[field] = help === '' ? { level } : { level, help };
  return next;
}

/** "Headshot: Edit to View", "Add co-presenters: off to on" -- the change
 * preview's permission lines, from the levels participants actually get. */
export function permissionChangeLines(saved: PortalDraft, draft: PortalDraft): string[] {
  const lines: string[] = [];
  for (const field of PERMISSION_FIELDS) {
    const a = fieldLevel(saved.fieldPermissions, field);
    const b = fieldLevel(draft.fieldPermissions, field);
    if (a !== b) lines.push(`${PERMISSION_FIELD_LABELS[field]}: ${FIELD_LEVEL_LABELS[a]} to ${FIELD_LEVEL_LABELS[b]}`);
  }
  for (const cap of CAPABILITIES) {
    const a = saved.capabilities[cap] === true;
    const b = draft.capabilities[cap] === true;
    if (a !== b) lines.push(`${CAPABILITY_LABELS[cap]}: ${a ? 'on' : 'off'} to ${b ? 'on' : 'off'}`);
  }
  return lines;
}

/** The preview's own permission lines ("bio: view -> edit", where a field
 * the portal never named reads as edit), in the same words as
 * permissionChangeLines -- shown only when the editor computed none. */
export function serverPermissionLine(line: string): string {
  const m = /^(\w+): (\w+) -> (\w+)$/.exec(line);
  if (!m) return line;
  const [, key, a, b] = m as unknown as [string, string, string, string];
  const fieldLabel = (PERMISSION_FIELD_LABELS as Record<string, string>)[key];
  if (fieldLabel) {
    const la = (FIELD_LEVEL_LABELS as Record<string, string>)[a] ?? a;
    const lb = (FIELD_LEVEL_LABELS as Record<string, string>)[b] ?? b;
    return `${fieldLabel}: ${la} to ${lb}`;
  }
  const capLabel = (CAPABILITY_LABELS as Record<string, string>)[key];
  return capLabel ? `${capLabel}: ${a} to ${b}` : line;
}

/** Items added to and removed from the portal by this edit. */
export function itemChanges(saved: PortalDraft, draft: PortalDraft): { added: DraftItem[]; removed: DraftItem[] } {
  const before = new Set(saved.items.map((i) => i.key));
  const after = new Set(draft.items.map((i) => i.key));
  return {
    added: draft.items.filter((i) => !before.has(i.key)),
    removed: saved.items.filter((i) => !after.has(i.key)),
  };
}

// ---------------------------------------------------------------------------
// Validation before Review and save
// ---------------------------------------------------------------------------

export interface DraftProblem {
  anchorId: string;
  label: string;
}

export function conditionAnchor(g: number, c: number): string {
  return `portal-rule-${g}-${c}-value`;
}

export function itemAnchor(key: string, part: 'deadline' | 'days'): string {
  return `portal-item-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}-${part}`;
}

export function draftProblems(draft: PortalDraft, options: RuleFieldOption[]): DraftProblem[] {
  const problems: DraftProblem[] = [];
  const labels = ruleLabels(options);
  const grouped = draft.rule.groups.length > 1;
  if (draft.name.trim() === '') problems.push({ anchorId: 'portal-name', label: 'The portal needs a name.' });
  draft.rule.groups.forEach((g, gi) =>
    g.conditions.forEach((c, ci) => {
      if (conditionComplete(c)) return;
      const where = grouped ? ` in “or” group ${gi + 1}` : '';
      problems.push({ anchorId: conditionAnchor(gi, ci), label: `Choose a value for ${labels.field(c.field)}${where}, or remove that condition.` });
    }),
  );
  for (const item of draft.items) {
    if (item.deadlineKind === 'fixed' && item.dueDate === '') {
      problems.push({ anchorId: itemAnchor(item.key, 'deadline'), label: `${item.title}: choose the due date.` });
    }
    if (item.deadlineKind === 'relative' && item.relativeDays === null) {
      problems.push({ anchorId: itemAnchor(item.key, 'days'), label: `${item.title}: choose how many days after joining.` });
    }
  }
  return problems;
}
