// DEC-369 amendment (wave 42): derives the header's "JORDAN A." identity
// label from GET /api/v1/me's `name` (first + last, from the signed-in
// user's linked contact) -- given name in caps + surname initial + period,
// the frames' grammar (not "J. ALVAREZ"). Falls back to the email
// local-part when there is no linked contact — never renders a bare email
// and never the literal 'undefined'.

/** "Jordan Alvarez" -> "JORDAN A."; a single-word name uppercases as-is. */
export function initialsForm(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  const first = parts[0];
  if (!first) return '';
  if (parts.length === 1) return first.toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first.toUpperCase()} ${last.charAt(0).toUpperCase()}.`;
}

/** The email's local-part (before '@'), uppercased — the no-name fallback. */
export function emailLocalPart(email: string): string {
  const at = email.indexOf('@');
  return (at > 0 ? email.slice(0, at) : email).toUpperCase();
}

/** The header identity label: initials form of `name`, or the email
 * local-part when `name` is null/empty. Never returns an empty string or
 * the word 'undefined' given a non-empty email. */
export function identityLabel(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return initialsForm(trimmed);
  return emailLocalPart(email);
}
