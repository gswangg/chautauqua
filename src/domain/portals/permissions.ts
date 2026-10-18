// Multi-portal permissions: which profile and session fields a participant
// can see or edit, and which actions they can take. Pure core.

export const FIELD_LEVELS = ["hidden", "view", "edit"] as const;
export type FieldLevel = (typeof FIELD_LEVELS)[number];

export const FIELD_LEVEL_LABELS: Record<FieldLevel, string> = {
  hidden: "Hidden",
  view: "View",
  edit: "Edit",
};

const LEVEL_RANK: Record<FieldLevel, number> = { hidden: 0, view: 1, edit: 2 };

// Fields about the person: shared across every participation, so the
// strictest portal wins.
export const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "title",
  "company",
  "bio",
  "headshot",
  "phone",
  "social",
  "email",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

// Fields about one session: the strictest portal matching that participation
// wins.
export const SESSION_FIELDS = ["sessionTitle", "abstract"] as const;
export type SessionField = (typeof SESSION_FIELDS)[number];

export type PermissionField = ProfileField | SessionField;
export const PERMISSION_FIELDS: readonly PermissionField[] = [...PROFILE_FIELDS, ...SESSION_FIELDS];

export const PERMISSION_FIELD_LABELS: Record<PermissionField, string> = {
  firstName: "First name",
  lastName: "Last name",
  title: "Job title",
  company: "Company",
  bio: "Bio",
  headshot: "Headshot",
  phone: "Phone number",
  social: "Social links",
  email: "Email",
  sessionTitle: "Session title",
  abstract: "Abstract",
};

// Today's portal: everything editable except email, which is view-only.
export const DEFAULT_FIELD_LEVELS: Record<PermissionField, FieldLevel> = {
  firstName: "edit",
  lastName: "edit",
  title: "edit",
  company: "edit",
  bio: "edit",
  headshot: "edit",
  // asked for only when a portal wants it (today's profile page shows
  // neither); a portal that names a field decides its level outright
  phone: "hidden",
  social: "edit",
  email: "hidden",
  sessionTitle: "edit",
  abstract: "edit",
};

export interface FieldPermission {
  level: FieldLevel;
  help?: string;
}

export type FieldPermissions = Partial<Record<PermissionField, FieldPermission>>;

export const MAX_FIELD_HELP_LENGTH = 280;

export function isPermissionField(f: string): f is PermissionField {
  return (PERMISSION_FIELDS as readonly string[]).includes(f);
}

export function isProfileField(f: string): f is ProfileField {
  return (PROFILE_FIELDS as readonly string[]).includes(f);
}

export function parseFieldPermissions(input: unknown): FieldPermissions {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Field permissions must be an object.");
  }
  const out: FieldPermissions = {};
  for (const [field, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!isPermissionField(field)) throw new Error(`Unknown field: ${field}.`);
    if (typeof raw !== "object" || raw === null) throw new Error(`Field ${field} needs a level.`);
    const { level, help } = raw as { level?: unknown; help?: unknown };
    if (typeof level !== "string" || !(FIELD_LEVELS as readonly string[]).includes(level)) {
      throw new Error(`Field ${field} has an unknown level: ${String(level)}.`);
    }
    if (help !== undefined && help !== null && typeof help !== "string") throw new Error(`Help text for ${field} must be text.`);
    if (typeof help === "string" && help.length > MAX_FIELD_HELP_LENGTH) {
      throw new Error(`Help text for ${field} is longer than ${MAX_FIELD_HELP_LENGTH} characters.`);
    }
    out[field] = typeof help === "string" && help.trim() ? { level: level as FieldLevel, help: help.trim() } : { level: level as FieldLevel };
  }
  return out;
}

export function parseFieldPermissionsJson(json: string): FieldPermissions {
  return parseFieldPermissions(JSON.parse(json));
}

export const CAPABILITIES = ["editSubmission", "addCoPresenters", "addTeammates", "createSponsorSessions"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  editSubmission: "Edit their submission",
  addCoPresenters: "Add co-presenters",
  addTeammates: "Add teammates",
  createSponsorSessions: "Create sessions within the sponsorship",
};

// Only meaningful on participations that are sponsor-company memberships.
export const COMPANY_ONLY_CAPABILITIES: readonly Capability[] = ["addTeammates", "createSponsorSessions"];

export type Capabilities = Partial<Record<Capability, boolean>>;

export function parseCapabilities(input: unknown): Capabilities {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Capabilities must be an object.");
  }
  const out: Capabilities = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(CAPABILITIES as readonly string[]).includes(key)) throw new Error(`Unknown action: ${key}.`);
    if (typeof value !== "boolean") throw new Error(`Action ${key} must be on or off.`);
    out[key as Capability] = value;
  }
  return out;
}

export function parseCapabilitiesJson(json: string): Capabilities {
  return parseCapabilities(JSON.parse(json));
}

/** One portal covering one participation, as permission merging sees it. */
export interface PermissionSource {
  portalName: string;
  participationKey: string;
  // what to call the participation in a lock line: "your invited panel"
  participationPhrase: string;
  fields: FieldPermissions;
  capabilities: Capabilities;
}

export interface ResolvedField {
  level: FieldLevel;
  help: string | null;
  // set when a portal made it stricter than the default
  lockedBy: { portalName: string; participationPhrase: string } | null;
}

/** The strictest level among the portals that name the field wins; a field
 * no portal names keeps today's default. A field held below "edit" by a
 * portal names that portal's participation (the lock line). Help text comes
 * from the first source that has some. */
export function resolveField(field: PermissionField, sources: PermissionSource[]): ResolvedField {
  let level: FieldLevel | null = null;
  let lockedBy: ResolvedField["lockedBy"] = null;
  let help: string | null = null;
  for (const s of sources) {
    const p = s.fields[field];
    if (!p) continue;
    if (help === null && p.help) help = p.help;
    if (level === null || LEVEL_RANK[p.level] < LEVEL_RANK[level]) {
      level = p.level;
      lockedBy = p.level === "edit" ? null : { portalName: s.portalName, participationPhrase: s.participationPhrase };
    }
  }
  return { level: level ?? DEFAULT_FIELD_LEVELS[field], help, lockedBy };
}

/** Portals only add: an action is allowed when any covering portal turns
 * it on. A participation no portal covers keeps today's defaults (pending
 * CFP submitters edit their own submissions and add co-presenters). */
export function resolveCapability(capability: Capability, sources: PermissionSource[]): boolean {
  if (sources.length === 0) return capability === "editSubmission" || capability === "addCoPresenters";
  return sources.some((s) => s.capabilities[capability] === true);
}

/** "Locked for your invited panel" */
export function lockLine(lockedBy: NonNullable<ResolvedField["lockedBy"]>): string {
  return `Locked for ${lockedBy.participationPhrase}`;
}
