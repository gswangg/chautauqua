// Merge-field rendering (DEC-006): single-brace {name} placeholders,
// server-side rendered from an explicit whitelist. Fail loudly on any
// placeholder absent from vars — no silent blanks in emails to real speakers.

export const MERGE_FIELDS = [
  "speaker_name",
  "talk_title",
  "event_name",
  "portal_link",
  "task_due_date",
  "task_list",
  "feedback",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

// DEC-792 amendment (wave 45): `task_due_date` is the canonical token — the
// one MERGE_FIELDS declares, MERGE_FIELD_SAMPLES keys, and the Insert-a-field
// menu offers. `due_date` is a permanent alias: it is already sitting in
// seeded and user-authored template bodies and must keep resolving to the
// identical value forever, but must never appear as a choice in any UI. The
// alias is resolved HERE — the one renderer — so no call site forks the
// substitution.
const MERGE_FIELD_ALIASES: Readonly<Record<string, MergeField>> = {
  due_date: "task_due_date",
};

function canonicalMergeField(name: string): string {
  return MERGE_FIELD_ALIASES[name] ?? name;
}

// DEC-660: one merge-field vocabulary. These are subsets of MERGE_FIELDS,
// each naming exactly the vars a given send path actually supplies —
// `readonly MergeField[]` makes a member outside MERGE_FIELDS a compile
// error, so a UI chip can never offer a placeholder preflightRender would
// reject as MergeFieldError.

// Matches src/domain/compose.ts buildMergeVars's target vars (speaker_name,
// talk_title, event_name, portal_link, feedback, task_due_date, task_list) —
// a compose template may now also reference the recipient's outstanding
// task list (DEC-792: growing the vocabulary rather than leaving a seeded
// template whose tokens the path rejects as a landmine).
export const COMPOSE_MERGE_FIELDS: readonly MergeField[] = [
  "speaker_name",
  "talk_title",
  "event_name",
  "portal_link",
  "feedback",
  "task_due_date",
  "task_list",
] as const;

// Matches src/routes/api/contacts/bulk-email.ts renderBulkEmailTargets's
// target vars (speaker_name, event_name, portal_link) — no talk_title/
// feedback: bulk email is contact-scoped, not submission-scoped.
export const BULK_EMAIL_MERGE_FIELDS: readonly MergeField[] = [
  "speaker_name",
  "event_name",
  "portal_link",
] as const;

// DEC-847: a subject is one line. task_list/feedback render as multi-line
// blocks (a bulleted list / a paragraph of prose) and so may only appear in
// the body, never the subject line.
export const BLOCK_MERGE_FIELDS: readonly MergeField[] = ["task_list", "feedback"] as const;

// DEC-993: "Merge fields are a dropdown" — the open panel lists each token
// beside a one-line sample value. Typed as a Record over MergeField so a
// merge field grown into MERGE_FIELDS without a matching sample is a
// compile error, not a silently blank row in the menu.
export const MERGE_FIELD_SAMPLES: Record<MergeField, string> = {
  speaker_name: "Marcus Okafor",
  talk_title: "Taming 40-Minute CI",
  event_name: "DevFlow Conf 2027",
  portal_link: "https://…/portal",
  task_due_date: "14 Mar",
  task_list: "• Sign speaker agreement  • Upload your slides",
  feedback: "Great pacing — tighten the intro by about two minutes.",
};

export const SUBJECT_MERGE_FIELDS: readonly MergeField[] = COMPOSE_MERGE_FIELDS.filter(
  (f) => !(BLOCK_MERGE_FIELDS as readonly string[]).includes(f),
);

export class MergeFieldError extends Error {
  constructor(public readonly field: string) {
    super(`Unknown or missing merge field: {${field}}`);
    this.name = "MergeFieldError";
  }
}

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

// DEC-847: scan a template's placeholders for any block-only merge field
// (e.g. rejecting {task_list}/{feedback} in a subject line before render).
export function blockFieldsInTemplate(template: string): MergeField[] {
  const found = new Set<MergeField>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const name = match[1];
    if (name === undefined) continue;
    const canonical = canonicalMergeField(name);
    if ((BLOCK_MERGE_FIELDS as readonly string[]).includes(canonical)) {
      found.add(canonical as MergeField);
    }
  }
  return [...found];
}

// DEC-856: preflight names every merge field a recipient is missing (not
// just the first), in first-appearance order, deduped — renderTemplate's
// single-value throw stays as-is for callers that render one value at a
// time (e.g. reminders' single-recipient path).
export function missingMergeFields(template: string, vars: Record<string, string>): string[] {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const name = match[1];
    if (name === undefined) continue;
    if (seen.has(name)) continue;
    const canonical = canonicalMergeField(name);
    if (!Object.prototype.hasOwnProperty.call(vars, canonical) || vars[canonical] === undefined) {
      missing.push(name);
      seen.add(name);
    }
  }
  return missing;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const canonical = canonicalMergeField(name);
    if (!Object.prototype.hasOwnProperty.call(vars, canonical) || vars[canonical] === undefined) {
      throw new MergeFieldError(name);
    }
    return vars[canonical];
  });
}

// DEC-037: outbound email HTML must never embed raw user/merge-field content.
// escapeHtml/textToHtml are the only sanctioned path from plain text to HTML.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const paragraphs = escaped.split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br/>"));
  return paragraphs.map((p) => `<p>${p}</p>`).join("");
}
