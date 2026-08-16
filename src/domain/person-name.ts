// ONE OWNER for a person's display name (DEC-757 wave-5 amendment,
// DEC-613: one join, one owner). DEC-986 (wave 45 amendment) means the
// public CFP's single Name control can legitimately produce a mononym --
// a submitted name with no whitespace stores the whole string in
// first_name and leaves last_name empty, and that is NEVER rejected. Every
// reader of a person's name must therefore treat "only one of the two
// parts is present" as a real name, not as "no name" -- a
// `firstName && lastName ? ... : <fallback>` ladder silently demotes a
// mononym speaker to their raw email on every surface that uses it. This
// module is the ONE place that joins firstName/lastName into a display
// string; every other site must call it (or personNameOrEmail) rather than
// hand-rolling the ladder. See test/person-name-single-source.scan.test.ts,
// which bans the ladder outside this file.
//
// Pure core (DEC-002): no node:/cloudflare/drizzle imports.

export interface PersonNameRow {
  firstName?: string | null;
  lastName?: string | null;
}

/** Trims each part, drops empties (including whitespace-only parts), and
 * joins the surviving parts with a single space. Returns "" when both
 * parts are empty -- callers that need a guaranteed non-blank string use
 * personNameOrEmail instead. */
export function personName(row: PersonNameRow): string {
  const parts = [row.firstName, row.lastName]
    .map((p) => (p ?? "").trim())
    .filter((p) => p !== "");
  return parts.join(" ");
}

export interface PersonNameOrEmailRow extends PersonNameRow {
  email: string;
}

/** personName(row), falling back to the row's email when neither name
 * part survives trimming. Never returns "" as long as email is non-blank. */
export function personNameOrEmail(row: PersonNameOrEmailRow): string {
  return personName(row) || row.email;
}
