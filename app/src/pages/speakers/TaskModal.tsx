import { useEffect, useState, type FormEvent } from 'react';
import {
  DELIVERABLE_KINDS,
  DIRECT_TASK_KINDS,
  type DeliverableKind,
  type EventForm,
  type NewTaskInput,
  type OnboardingTask,
  type TaskKind,
} from './types';
import { DateField } from '../../components/DateField';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { ApiError } from '../../lib/api';
// The instructions textarea reads the SAME cap the server enforces
// (src/routes/tasks.ts's parseInstructions) so the control can never drift
// from the rule that actually validates it.
import { MAX_TASK_INSTRUCTIONS_LENGTH } from '../../lib/domain-caps';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';
import { MAX_TASK_ASSIGNEES } from '../../lib/batch-caps';

interface TaskModalProps {
  onCancel: () => void;
  onSubmit: (input: NewTaskInput) => Promise<void>;
  // DEC-398: the event's own forms, {id, title, isDefault} — the producer
  // picks a form by NAME from this list; the client never types or invents
  // an id. An empty list (no forms yet, or the fetch failed) disables the
  // select and blocks submit rather than silently posting no formId.
  forms: EventForm[];
  // the roster's size, for the too-many-to-list note
  acceptedCount: number;
  // Multi-portal decision 76: the portals a new task can go to, and the one
  // to offer first (the portal the grid is narrowed to, when it is)
  portals?: { id: string; name: string }[];
  defaultPortalId?: string | null;
  // DEC-746 (wave-59 amendment): the roster available to the CREATE-mode
  // subset picker, {contactId, name}. Only ever read in create mode; edit
  // mode never touches assignments (PATCH is title/instructions/due
  // date/required only). Undefined/empty in edit mode, or while the
  // fetch is in flight, or on a failed fetch (never a silent empty list
  // presented as "no speakers" -- see assigneesTruncated below for the
  // over-ceiling case, and OnboardingGrid for the failed-fetch case,
  // which falls back to offering only "Everyone accepted").
  assignees?: { contactId: string; name: string }[];
  // DEC-746 (wave-59 amendment): true when the roster exceeds the
  // picker's fetch ceiling (MAX_PER_PAGE, 200) -- the subset choice is
  // withheld entirely rather than showing a truncated list masquerading
  // as the whole roster, and the modal states the ceiling in one
  // sentence instead.
  assigneesTruncated?: boolean;
  // DEC-933: when provided, the modal opens in EDIT mode for this existing
  // task instead of creating a new one. Kind/Form/Deliverable-kind are the
  // task's shape and are fixed in edit mode -- changing kind would orphan
  // stored responses, and this modal has no wire-safe way to learn a task's
  // current deliverableKind (the onboarding grid response never carries it,
  // and widening that wire shape is out of this change's scope), so that
  // picker stays hidden too rather than risk clobbering it with a fresh
  // default. Only title/instructions/due date/required are editable; the
  // caller is responsible for stripping kind/formId/deliverableKind out of
  // the NewTaskInput this modal hands back before it PATCHes. CNT-01:
  // instructions orphans nothing (unlike kind/formId/deliverableKind), so
  // the DEC-933 edit-mode freeze does not apply to it -- it stays editable
  // in both modes.
  task?: OnboardingTask | null;
  // Ruling A12 (DEC-662 amendment, wave 25): the column header now offers
  // only Edit -- Remove lives in here instead, so removing a task is one
  // click deeper (into the thing you're already editing) rather than a
  // second control sitting beside Edit in every column. Only rendered in
  // edit mode; ignored for New task.
  onRemove?: () => void;
}

// DEC-746: the segmented control's labels/order per
// docs/design/Chautauqua Speakers.dc.html:186-216 -- Upload, Form,
// Acknowledge, mapping onto the existing kind values so every other kind
// gate (deliverable-kind row, form picker) keeps working unchanged.
export function kindLabel(kind: TaskKind): string {
  if (kind === 'file_request') return 'Upload';
  if (kind === 'form') return 'Form';
  if (kind === 'share_kit') return 'Share kit';
  return 'Acknowledge';
}

const KIND_ORDER: readonly TaskKind[] = (() => {
  const order: TaskKind[] = ['file_request', 'form', 'general'];
  // DIRECT_TASK_KINDS is the source enumeration for this modal; assert the
  // display order is a permutation of it so a new kind can't silently go
  // unlisted here.
  if (order.length !== DIRECT_TASK_KINDS.length || !DIRECT_TASK_KINDS.every((k) => order.includes(k))) {
    throw new Error('TaskModal: KIND_ORDER is out of sync with DIRECT_TASK_KINDS');
  }
  return order;
})();

// DEC-928: exhaustive Record so a new FILE_KINDS entry fails to compile
// here rather than silently rendering unlabeled.
const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  presentation: 'Presentation',
  poster: 'Poster',
  handout: 'Handout',
  recording: 'Recording',
  photo: 'Photo / headshot',
};

function deliverableKindLabel(kind: DeliverableKind): string {
  return DELIVERABLE_KIND_LABELS[kind];
}

export function TaskModal({
  onCancel,
  onSubmit,
  forms,
  acceptedCount,
  portals = [],
  defaultPortalId = null,
  assignees = [],
  assigneesTruncated = false,
  task = null,
  onRemove,
}: TaskModalProps) {
  const isEdit = task !== null;
  // Multi-portal decision 76, CREATE mode only: a task reaches a group
  // through a portal (it becomes the portal's item) or named people. There
  // is no "everyone accepted" any more -- that was a rule engine beside
  // portals. A portal is offered first when the event has any, and the
  // organizer names it: only the portal the grid is filtered to is
  // pre-chosen, never simply the first one (Profile basics covers sponsor
  // contacts too).
  const [audienceMode, setAudienceMode] = useState<'portal' | 'subset'>(portals.length > 0 ? 'portal' : 'subset');
  const [portalId, setPortalId] = useState<string>(
    defaultPortalId && portals.some((p) => p.id === defaultPortalId) ? defaultPortalId : '',
  );
  // the portal list can arrive after the modal opens
  useEffect(() => {
    if (portals.length === 0) return;
    setPortalId((current) =>
      portals.some((p) => p.id === current)
        ? current
        : defaultPortalId && portals.some((p) => p.id === defaultPortalId)
          ? defaultPortalId
          : '',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portals]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'file_request');
  const [title, setTitle] = useState(task?.title ?? '');
  const [instructions, setInstructions] = useState(task?.instructions ?? '');
  const [dueDate, setDueDate] = useState(task ? msToDateInput(task.dueDate) : '');
  const [required, setRequired] = useState(task?.required ?? true);
  const [formId, setFormId] = useState('');
  const [deliverableKind, setDeliverableKind] = useState<DeliverableKind>(DELIVERABLE_KINDS[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEC-958: mirrors RosterPanel/EventSettingsPanel -- when the server
  // refuses with a fields map (src/routes/tasks.ts: kind / title /
  // description / dueDate / required / formId), each named control gets
  // its own message via FormRow's `error` prop instead of collapsing the
  // whole map into the single top-of-form sentence.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Defaults to the first form in the (default-first, per DEC-398) list, and
  // re-syncs if the previously-selected id falls out of the list (e.g. the
  // async fetch resolves after the modal has already mounted with none) --
  // a blank submit is impossible by construction.
  useEffect(() => {
    if (isEdit) return; // edit mode never renders the Form picker.
    if (forms.length === 0) {
      setFormId('');
      return;
    }
    setFormId((current) => (forms.some((f) => f.id === current) ? current : forms[0]!.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError('Title is required.');
      return;
    }
    if (!isEdit && kind === 'form' && (forms.length === 0 || formId.trim().length === 0)) {
      setError('Select a form before creating a form task.');
      return;
    }
    if (!isEdit && audienceMode === 'subset' && selectedContactIds.size === 0) {
      setError('Choose at least one speaker.');
      return;
    }
    if (!isEdit && audienceMode === 'portal' && portalId === '') {
      setError('Choose the portal that gets this task.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        instructions: instructions.trim(),
        dueDate: dateInputToMs(dueDate),
        required,
        formId: !isEdit && kind === 'form' ? formId : undefined,
        deliverableKind: !isEdit && kind === 'file_request' ? deliverableKind : undefined,
        portalId: !isEdit && audienceMode === 'portal' ? portalId : undefined,
        contactIds: !isEdit && audienceMode === 'subset' ? Array.from(selectedContactIds) : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : isEdit ? 'Failed to save task' : 'Failed to create task');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title={isEdit ? 'Edit task' : 'New task'}
      subtitle={
        isEdit
          ? undefined
          : audienceMode === 'subset'
            ? `Created for the ${selectedContactIds.size} people you choose`
            : `Added to ${portals.find((p) => p.id === portalId)?.name ?? 'the portal you choose'}: everyone it covers gets it`
      }
      onClose={onCancel}
      closeDisabled={submitting}
      modalClassName="chq-speakers-modal"
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={submitting}>
            {isEdit ? (submitting ? 'Saving...' : 'Save changes') : submitting ? 'Creating...' : 'Create the task'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          {isEdit && onRemove && (
            <button
              type="button"
              className="chq-btn chq-btn-tertiary chq-speakers-task-remove"
              onClick={onRemove}
              disabled={submitting}
            >
              Remove
            </button>
          )}
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}

        <FormRow label="Task" htmlFor="task-title" error={fieldErrors.title}>
          <input
            id="task-title"
            className="chq-input"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Submit your slides"
            required
          />
        </FormRow>

        <FormRow label="Instructions" htmlFor="task-instructions" optional error={fieldErrors.description}>
          <textarea
            id="task-instructions"
            className="chq-textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="16:9, under 20 MB, PDF or Keynote"
            maxLength={MAX_TASK_INSTRUCTIONS_LENGTH}
            rows={3}
          />
        </FormRow>

        <FormRow label="Due date" htmlFor="task-due-date" optional error={fieldErrors.dueDate}>
          <DateField id="task-due-date" value={dueDate} onChange={setDueDate} />
        </FormRow>

        {/* DEC-933: kind is a task's shape and is fixed once created --
            edit mode shows it as a quiet read-only line rather than the
            interactive segmented control (changing kind would orphan
            responses already stored against it). */}
        {isEdit ? (
          <div className="chq-speakers-modal-field">
            <span className="chq-speakers-modal-label">Kind</span>
            <span className="chq-meta">{kindLabel(kind)} (not editable)</span>
          </div>
        ) : (
          <div className="chq-speakers-modal-field">
            <span className="chq-speakers-modal-label" id="task-kind-label">
              Kind
            </span>
            <div className="chq-segmented" role="group" aria-label="Kind">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={kind === k ? 'chq-btn chq-speakers-kind-selected' : 'chq-btn chq-btn-secondary'}
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                >
                  {kindLabel(k)}
                </button>
              ))}
            </div>
            {fieldErrors.kind ? (
              <span role="alert" className="chq-form-row-error">
                {fieldErrors.kind}
              </span>
            ) : null}
          </div>
        )}

        {!isEdit && kind === 'form' && (
          <FormRow
            label="Form"
            htmlFor="task-form"
            error={fieldErrors.formId}
            help={
              forms.length === 0
                ? 'This event has no forms yet. Add a form before creating a form task.'
                : undefined
            }
          >
            <select
              id="task-form"
              className="chq-select"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              disabled={forms.length === 0}
            >
              {forms.length === 0 ? (
                <option value="">No forms available</option>
              ) : (
                forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))
              )}
            </select>
          </FormRow>
        )}

        {!isEdit && kind === 'file_request' && (
          <FormRow label="Deliverable kind" htmlFor="task-deliverable-kind" optional>
            <select
              id="task-deliverable-kind"
              className="chq-select"
              value={deliverableKind}
              onChange={(e) => setDeliverableKind(e.target.value as DeliverableKind)}
            >
              {DELIVERABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {deliverableKindLabel(k)}
                </option>
              ))}
            </select>
          </FormRow>
        )}

        <label className="chq-check-label">
          <input className="chq-check" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        {fieldErrors.required ? (
          <span role="alert" className="chq-form-row-error">
            {fieldErrors.required}
          </span>
        ) : null}

        {/* DEC-746 (wave-59 amendment): CREATE mode only -- edit mode PATCHes
            and never touches assignments. Two mutually exclusive choices;
            no new frame exists for this in the V11 pack, so this reuses the
            existing chq-speakers-modal-field/chq-check-label vocabulary
            already spent above (Kind group, Required checkbox). */}
        {!isEdit && (
          <div className="chq-speakers-modal-field">
            <span className="chq-speakers-modal-label" id="task-audience-label">
              Who gets it
            </span>
            <div className="chq-radio-group" role="radiogroup" aria-labelledby="task-audience-label">
              {portals.length > 0 ? (
                <label className="chq-check-label">
                  <input
                    className="chq-check"
                    type="radio"
                    name="task-audience"
                    checked={audienceMode === 'portal'}
                    onChange={() => setAudienceMode('portal')}
                  />
                  Everyone in a portal
                </label>
              ) : null}
              <label className="chq-check-label">
                <input
                  className="chq-check"
                  type="radio"
                  name="task-audience"
                  checked={audienceMode === 'subset'}
                  onChange={() => setAudienceMode('subset')}
                  disabled={assigneesTruncated}
                />
                Only the people I choose
              </label>
            </div>
            {assigneesTruncated ? (
              <p className="chq-meta">
                This event has too many speakers to choose from here ({acceptedCount} accepted, more than the{' '}
                {MAX_TASK_ASSIGNEES} this picker can list) -- give the task to a portal, or add people from the task&rsquo;s page.
              </p>
            ) : null}
            {fieldErrors.portalId ? (
              <span role="alert" className="chq-form-row-error">
                {fieldErrors.portalId}
              </span>
            ) : null}
            {fieldErrors.contactIds ? (
              <span role="alert" className="chq-form-row-error">
                {fieldErrors.contactIds}
              </span>
            ) : null}
          </div>
        )}

        {!isEdit && audienceMode === 'portal' && portals.length > 0 && (
          <div className="chq-speakers-modal-field">
            <label className="chq-speakers-modal-label" htmlFor="task-portal">
              Portal
            </label>
            <select id="task-portal" className="chq-select" value={portalId} onChange={(e) => setPortalId(e.target.value)}>
              <option value="">Choose a portal</option>
              {portals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="chq-meta">Saved to the library as this portal&rsquo;s item. People who join the portal later get it too.</p>
          </div>
        )}

        {!isEdit && !assigneesTruncated && audienceMode === 'subset' && (
          <div className="chq-speakers-modal-field" role="group" aria-label="Choose speakers">
            <div className="chq-speakers-audience-list">
              {assignees.map((a) => (
                <label key={a.contactId} className="chq-check-label">
                  <input
                    className="chq-check"
                    type="checkbox"
                    checked={selectedContactIds.has(a.contactId)}
                    onChange={(e) => {
                      setSelectedContactIds((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(a.contactId);
                        else next.delete(a.contactId);
                        return next;
                      });
                    }}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        )}
    </ModalFrame>
  );
}
