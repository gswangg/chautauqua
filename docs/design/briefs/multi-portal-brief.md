Design the interaction model for multi-portal in Chautauqua, a conference speaker-and-program app. The attached frames show the existing app; match them.

## Context

Chautauqua runs a conference's call for papers, review, speaker onboarding and schedule. Today each event has exactly one participant portal. The organizer we're designing for needs different experiences for different kinds of participant: CFP speakers, invited speakers, and sponsors who design their own talks. New kinds will keep appearing (moderators, workshop leads, volunteers, press), so the organizer team, not engineers, must be able to create and change portals themselves.

Many people hold several roles at once: a sponsor contact who also gives a keynote, a speaker with a CFP talk and an invited panel. The design must handle that without anyone missing work.

## The model (fixed: design the experience around it)

**Participations, not people.** A participation is one person's role on one session (speaker, moderator, co-presenter) or one person's membership of one sponsor company. A person can have many participations. A portal describes what one kind of participation needs.

A portal is built from four parts:

1. **Who.** A rule that matches participations, over any field: the role, how the session arrived (submitted through the CFP, invited by organizers, or designed by a sponsor), session format, track or status, sponsor tier, or a custom field. Conditions combine with AND and OR. Rules are live, so when data changes, a participation gains or loses a portal.
2. **What.** Items from shared event libraries: tasks, forms, file requests, resource pages, downloads. Each item has a deadline (a fixed date, or relative to when the participation joined the portal) and a required flag. Each item is either:
    - **About the person** (bio, headshot, travel form): shown once, in the person's profile area.
    - **About the participation** (slides, AV needs, accepting an invitation): shown under that session or company.
3. **Can do.** Per-field visibility (hidden, view, edit) for profile and session fields, plus capability switches: edit the submission, add co-presenters, add teammates (sponsor companies), and create sessions within a sponsorship's entitlement.
4. **Wording.** A short note participants see beside this portal's items, for example "As an invited speaker, you'll confirm your session and share a bio."

**Portals add up; they don't compete.** A participation gets the items of every portal it matches. There's no ranking. Two plain rules settle the only conflicts:
- The same library item from two portals shows once, with the earliest deadline, and is required if either portal requires it.
- For profile fields shared across participations (bio, headshot), the strictest lock wins, and the participant sees why ("Locked by the organizers for your keynote").

Other rules of the model:
- One record per person across all roles and events.
- A sponsorship has a tier and entitlements, for example "Gold: one 30-minute talk and one workshop". Sessions a sponsor designs go through organizer approval before they enter the program.
- A participation that matches no portal gets nothing; organizers are warned about it rather than having a silent catch-all.

## Flows to design

Organizer screens at 1440px desktop. Participant screens at 1440px desktop and 390px phone.

Organizer:
1. **Portals overview** for an event: each portal with a plain-language rule summary ("Speakers on accepted sessions in the Workshop format"), how many participations it covers, and its item count. A coverage summary: how many participations are covered, how many match nothing, and where portals overlap. Starter templates: Everyone (profile and headshot), CFP speakers, Invited speakers, Sponsors.
2. **Portal editor** covering Who, What, Can do and Wording. The rule builder shows live which participations match, and before saving, which would gain or lose this portal and which items they'd gain or lose. Build on the segment rule builder in the Contacts frames.
3. **Explaining what a person gets:** on a person's record, list their participations, which portals each one matched, and every item with the portal that brought it. Show where an item was merged from two portals and where a lock came from.
4. **Preview as participant,** with a visible notice that this is a logged view of someone's personal data.
5. **Sponsorships:** tiers and entitlements, and an approval queue for sponsor-designed sessions (approve, request changes with a note, decline).

Participants:
6. **One home per person, grouped by participation.** A profile area first (person-level items), then one section per session or sponsor company with its items, status and the portal's note. There is no portal switcher. Show three people:
    - A CFP speaker with one talk.
    - An invited speaker who hasn't yet accepted.
    - A person with three participations: a CFP talk, an invited panel, and contact at a Gold sponsor.
7. **Sponsor session design,** inside the sponsor company's section: see what the package includes and what's used, choose an entitlement, draft title, abstract, format and speakers (including adding a speaker who isn't in the system yet), submit, see feedback, revise, approved.
8. **Invited-speaker acceptance,** from the email link to confirmed.
9. **Sponsor team management:** a sponsor contact invites a teammate to the company's section.

States to cover: a rule that matches nobody, participations that match no portal, a rule change affecting 40 participations, the same item arriving from two portals, a profile field locked by one portal and editable in another, a deadline passed with and without a grace period, an entitlement fully used, and a declined invitation.

## Principles

- **The organizer team configures this themselves.** Everything reads in plain language; no syntax or code.
- **Nothing gets lost.** A person with several roles sees all their work in one place, and organizers can see any participation that gets nothing.
- **Explainable.** For any item a person sees, anyone can tell which portal brought it and why.
- **Safe.** Rule and permission changes show their effect before saving.
- **Relevant.** Participants see only what applies to them, with no empty sections.

## Constraints

- Match the attached frames' visual language and components, and follow DESIGN-RULINGS.md. Add new components only where nothing existing fits, and call each one out.
- Organizer screens live in the admin app (Settings, Speakers and Contacts frames). The participant home extends the existing portal (Public and Portal frames); event branding stays at the event level.
- Use the existing demo event, DevFlow Conf 2027, for sample data: Gold and Silver sponsors and a mix of CFP and invited speakers.
- Out of scope: staff permissions, payments, CRM sync.

## Deliverable

- One canvas, artboards grouped by flow, each labeled with its route and state.
- Beside any frame whose behavior a static picture can't show (live counts, what happens on save, transitions), a short note describing the behavior.
- A short list of open questions where you had to make a choice.
