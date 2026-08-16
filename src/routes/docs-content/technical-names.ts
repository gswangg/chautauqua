// ASD-STE100 (Issue 9) rule 1.5 lets a project use technical names outside
// the controlled dictionary, but only from defined categories and only if the
// project declares them; rule 1.6 does the same for technical verbs of
// manufacturing/computer processes. This module is that declaration for the
// docs articles. The docs dictionary scan (test/docs-ste.scan.test.ts) accepts
// a word only if it is dictionary-approved, a Part-1 grammar word, or listed
// here. Keep both tiers minimal: a word belongs here only when it names a
// thing or a computer action — ordinary English rewritten around ("window" as
// a time period, "own", "real", "current") must never be laundered through
// this list. Entries are single words or multiword phrases; the scan also
// accepts standard inflections (plural, -ed, -ing) of each entry.

// STE rule 1.5 (technical names must be declared and defined per project):
// standard software/SaaS vocabulary that any web product shares — UI parts,
// data objects, and the computer technical verbs of rule 1.6.
export const SAAS_TECHNICAL_NAMES: readonly string[] = [
  "accent", // the configurable highlight color of an embed
  "account",
  "admin", // the administrative side of the product, as in "admin console"
  "answer", // the stored response to a form question
  "app",
  "article", // a documentation page in this docs site
  "batch", // a batch operation over many records at once
  "board", // a kanban-style board of columns and cards
  "browser",
  "builder", // the interactive editor surface, as in "form builder", "embed builder"
  "built-in", // a field or feature that ships with the product
  "bulk", // an operation applied to many records in one step
  "calendar", // the calendar application of a visitor, target of the .ics feed
  "card", // one movable item on a board
  "chip", // a small UI marker attached to a card or cell
  "claim", // the link operation that connects a person to their account
  "click",
  "clone", // a local copy of the source repository (git clone)
  "column", // a board column, or a CSV column
  "command", // a terminal command
  "comment", // a saved remark attached to a record
  "company", // the standard company field of a contact record
  "compose", // the email-writing surface and its send operation
  "conditional", // a field that a rule shows or removes
  "console", // the admin console
  "custom", // user-defined, as in "custom field" and "custom question"
  "dashboard",
  "database",
  "dedupe", // the deduplication guard on repeated sends
  "default", // the preselected value or behavior
  "demo", // the seeded demonstration event and its data
  "dependency", // an installed software package the product uses
  "deploy",
  "deployment",
  "description", // the standard description field of a record
  "dev", // development mode; the local dev server and dev routes
  "dialog", // a UI dialog window
  "directory", // the org-wide list of contact records
  "document", // a file kept as a record
  "download",
  "drag",
  "dry-run", // a run that reports what it will change without changing it
  "due date", // the date a task must be complete
  "duplicate", // a second record for the same person or thing
  "edit", // to change stored content
  "email",
  "embed", // a snippet that shows a product surface inside another site
  "export",
  "feed", // a machine-readable stream, as in ".ics feed"
  "field", // one input of a form or one column of a record
  "file",
  "filter", // a saved or interactive narrowing of a list (noun)
  "flag", // a UI marker on a record, and the act of marking it
  "form",
  "grid", // the two-axis scheduling surface
  "highlight", // the UI emphasis state, as in "track highlight"
  "history", // the kept sequence of versions of a file or record
  "home", // the home page or home screen of a product area
  "ics", // the iCalendar file format
  "iframe",
  "import",
  "inbox",
  "install",
  "instance", // one deployed copy of the software
  "job", // one automated run in a CI system
  "key", // an API key: a stored credential value
  "link",
  "list", // the UI list component that shows a set of records
  "log", // the recorded history of actions (noun), and to record it (verb)
  "login",
  "mail",
  "mailbox",
  "map", // to connect source columns onto destination fields
  "match", // a rule or filter matches the records it selects
  "merge", // to combine two records into one
  "message",
  "migration", // a database schema migration
  "mouse",
  "note", // a short saved comment on a record
  "notification", // a system-generated message to a user
  "numeric", // the number-valued data type of a field or criterion
  "option", // one configurable input of an embed or feature
  "org", // the organization (tenant) that owns the directory and events
  "origin", // the web origin (protocol and domain) of a deployment
  "overdue", // the state of a task after its due date, shown in the UI
  "overwrite", // to replace stored data in place
  "page",
  "panel", // a UI region with controls
  "password",
  "paste",
  "pill", // the small rounded UI status marker
  "placeholder", // a template variable such as {name} before it is filled
  "portal", // a scoped external-user surface, as in "speaker portal"
  "print",
  "profile", // the editable record of a person: bio, photo, links
  "progress", // the completion indicator of a queue or plan
  "provider", // an external service, as in "email provider"
  "public", // open to persons without a login, as in "public page"
  "publish",
  "query",
  "question", // one custom input on a form, as in "custom question"
  "queue", // an ordered work list, as in "review queue"
  "quickstart", // the shortest documented setup sequence
  "radio", // the single-select UI control (radio button)
  "recipient", // the person an email is addressed to
  "remote", // on the deployed environment, not the local one
  "reply", // one answer in a comment thread
  "required", // the form-field property that makes an input mandatory
  "reset", // as in "password reset"
  "role", // the access role of a signed-in user
  "route", // one URL path the server answers
  "rule", // a configured condition, as in a field-visibility rule
  "run", // to start or execute a program, command, or job
  "save",
  "schema", // the structure of the database
  "screen",
  "script", // an executable program file, as in "seed script"
  "scroll",
  "search",
  "secret", // a credential value kept out of the repository
  "seed", // to fill a database with initial data; the data so created
  "server",
  "setting", // one stored configuration value of a record or feature
  "shortcut", // a UI element that jumps to another surface
  "sign in",
  "sign into",
  "sign out",
  "sink", // a local endpoint that collects output, as in "email sink"
  "site",
  "slug", // the URL-safe identifier of a record
  "snapshot", // a stored copy frozen at one point in time
  "snippet", // a short block of code to copy
  "software",
  "spreadsheet",
  "status", // the named state of a record in a workflow
  "storage",
  "subject", // the subject line of an email
  "submit", // to send a completed form
  "subscribe", // to connect a calendar to a feed
  "sync",
  "template", // a stored message with placeholders
  "text", // written content; the text data type of a field
  "thread", // a sequence of comments and replies on one record
  "tile", // one block in a grid of navigation blocks
  "timezone",
  "title", // the standard title field of a record
  "tray", // the UI holding area beside the grid for unscheduled items
  "undo", // to reverse the last recorded action
  "update", // to change a stored record to newer content
  "upload",
  "url",
  "user",
  "variable", // an environment variable of a deployment
  "version", // one stored revision of a file or record
  "visibility", // the property that controls if a field or record is shown
  "visitor", // a person who reads a public page without an account
  "wizard", // a step-by-step UI flow, as in "import wizard"
  "worker", // the deployed server process (Cloudflare Worker)
  "worklist", // the admin list surface of all submissions
] as const;

// STE rule 1.5: this product's conference-domain vocabulary — the objects,
// statuses, and actions of running a call for papers and a speaker program.
export const CONFERENCE_TECHNICAL_NAMES: readonly string[] = [
  "agenda", // the public day-by-day program surface
  "agreement", // the speaker agreement document a task collects
  "anonymization", // the plan feature that removes identifying data before review
  "anonymize",
  "approve", // the content-approval action; "approved" is the resulting status
  "assign", // to give a reviewer a set of submissions
  "assignment",
  "auto-schedule", // the bulk scheduling operation
  "bio",
  "break", // a scheduled pause that blocks a time slot in all rooms (noun)
  "call for papers", // the open request for submissions
  "call-for-papers",
  "cfp",
  "chautauqua", // the product name
  "comms", // the communications area of the product
  "conference",
  "conflict", // two sessions that need the same room or speaker at one time
  "conflict of interest", // the relation that makes a reviewer recuse
  "content", // the public material of a session: title, description, deliverables
  "co-presenter",
  "co-speaker",
  "criteria",
  "criterion", // one scored dimension on a scorecard
  "decline", // the negative decision; "declined" is the resulting status
  "deliverable", // a file a speaker owes against a task
  "enroll", // to put a contact onto the sourcing pipeline
  "enrollment",
  "event",
  "format", // the session-format facet, as in "talk" or "workshop"
  "gallery", // the public speaker-photo surface
  "headshot",
  "hub", // the one public page that links to all public surfaces
  "onboarding", // the post-acceptance task flow for speakers
  "organizer",
  "participation", // the per-event attachment record of a speaker
  "pending", // the arrival status of a submission
  "persona", // one of the seeded demo logins (organizer, reviewer, speaker)
  "pipeline", // the sourcing pipeline of possible speakers; also the status flow
  "plan", // an evaluation plan: reviewers, scorecard, and assignments
  "presenter",
  "program", // the speaker program of an event
  "programme", // the print-first public surface, spelled as the surface is named
  "rating", // one reviewer's recorded score for one submission
  "recusal",
  "recuse",
  "review", // the scored evaluation of a submission (noun)
  "reviewer",
  "room",
  "roster", // the per-event list of attached speakers
  "round", // one pass of review under one plan
  "scale", // the numeric range of a scorecard criterion
  "schedule", // the placed sessions of the event; to place them
  "score",
  "scorecard",
  "segment", // a saved, reusable directory filter
  "session", // an accepted submission as it appears on the agenda
  "slides", // the presentation file a speaker delivers
  "speaker",
  "submission",
  "talk", // a session presentation; the thing a speaker gives
  "track", // a themed group of sessions
  "triage", // the sorting of pending submissions toward a decision
  "visible", // the participation flag in the publish gate, one of its three conditions
  "waitlist",
  "waitlisted", // the hold status: not accepted, not declined
] as const;

// The scan keys off this single derived union.
export const DOCS_TECHNICAL_NAMES: readonly string[] = [
  ...SAAS_TECHNICAL_NAMES,
  ...CONFERENCE_TECHNICAL_NAMES,
] as const;
