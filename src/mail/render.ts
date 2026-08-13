// Merge-field rendering (DEC-006): single-brace {name} placeholders,
// server-side rendered from an explicit whitelist. Fail loudly on any
// placeholder absent from vars — no silent blanks in emails to real speakers.

export const MERGE_FIELDS = [
  "speaker_name",
  "talk_title",
  "event_name",
  "portal_link",
  "due_date",
  "task_list",
  "feedback",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

// DEC-660: one merge-field vocabulary. These are subsets of MERGE_FIELDS,
// each naming exactly the vars a given send path actually supplies —
// `readonly MergeField[]` makes a member outside MERGE_FIELDS a compile
// error, so a UI chip can never offer a placeholder preflightRender would
// reject as MergeFieldError.

// Matches src/domain/compose.ts buildMergeVars's target vars (speaker_name,
// talk_title, event_name, portal_link, feedback, due_date, task_list) — a
// compose template may now also reference the recipient's outstanding
// task list (DEC-792: growing the vocabulary rather than leaving a seeded
// template whose tokens the path rejects as a landmine).
export const COMPOSE_MERGE_FIELDS: readonly MergeField[] = [
  "speaker_name",
  "talk_title",
  "event_name",
  "portal_link",
  "feedback",
  "due_date",
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

export class MergeFieldError extends Error {
  constructor(public readonly field: string) {
    super(`Unknown or missing merge field: {${field}}`);
    this.name = "MergeFieldError";
  }
}

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name) || vars[name] === undefined) {
      throw new MergeFieldError(name);
    }
    return vars[name];
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
