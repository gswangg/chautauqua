// Portal editor · Permissions (Portals frame, flow 2): what participants
// this portal covers can do with each profile and session field (hidden,
// view, edit, plus help text shown beside the field), and which actions
// they can take. The strictest portal wins for a field; actions add up.
import { useState } from 'react';
import { MAX_FIELD_HELP_LENGTH } from '../../lib/domain-caps';
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  COMPANY_ONLY_CAPABILITIES,
  FIELD_LEVEL_LABELS,
  PERMISSION_FIELDS,
  PERMISSION_FIELD_LABELS,
  fieldLevel,
  levelsFor,
  setFieldHelp,
  setFieldLevel,
  type PermissionField,
} from './portalDraft';
import type { Capability } from '../../../../src/domain/portals/permissions';
import type { Capabilities, FieldPermissions } from './types';

interface PermissionsSectionProps {
  fieldPermissions: FieldPermissions;
  savedFieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  savedCapabilities: Capabilities;
  // the levels the API offers for a field
  levels: readonly string[];
  // whether the rule as edited can match a sponsor contact
  companies: boolean;
  onFields: (next: FieldPermissions) => void;
  onCapabilities: (next: Capabilities) => void;
}

export function PermissionsSection({
  fieldPermissions,
  savedFieldPermissions,
  capabilities,
  savedCapabilities,
  levels,
  companies,
  onFields,
  onCapabilities,
}: PermissionsSectionProps) {
  const [helpOpen, setHelpOpen] = useState<PermissionField | null>(null);

  // an action switched back off is dropped again unless the saved portal
  // named it, so on-then-off reads as no change
  function toggle(cap: Capability, on: boolean) {
    const next = { ...capabilities };
    if (!on && savedCapabilities[cap] === undefined) delete next[cap];
    else next[cap] = on;
    onCapabilities(next);
  }

  return (
    <div className="chq-portal-perms">
      <section className="chq-portal-section" aria-labelledby="portal-fields-label">
        <div className="chq-section-head">
          <span className="chq-section-label" id="portal-fields-label">
            Permissions · fields
          </span>
        </div>
        <div className="chq-portal-fields" role="table" aria-labelledby="portal-fields-label">
          <div className="chq-portal-fields-row chq-portal-fields-head" role="row">
            <span role="columnheader">Field</span>
            <span role="columnheader">Participants can</span>
          </div>
          {PERMISSION_FIELDS.map((field) => {
            const label = PERMISSION_FIELD_LABELS[field];
            const level = fieldLevel(fieldPermissions, field);
            const help = fieldPermissions[field]?.help ?? '';
            const editingHelp = helpOpen === field;
            const helpId = `portal-field-help-${field}`;
            return (
              <div key={field} className="chq-portal-fields-group" role="rowgroup">
                <div className="chq-portal-fields-row" role="row">
                  <span role="cell" className="chq-portal-fields-name">
                    <span className="chq-portal-fields-label" id={`portal-field-${field}`}>
                      {label}
                    </span>
                    {help !== '' && !editingHelp ? <span className="chq-portal-fields-help">{help}</span> : null}
                    <button
                      type="button"
                      className="chq-link-button chq-portal-fields-help-toggle"
                      aria-expanded={editingHelp}
                      aria-controls={helpId}
                      onClick={() => setHelpOpen(editingHelp ? null : field)}
                    >
                      {editingHelp ? 'Done' : help === '' ? 'Add help text' : 'Edit help text'}
                    </button>
                  </span>
                  <span role="cell">
                    <span className="chq-portal-seg" role="group" aria-labelledby={`portal-field-${field}`}>
                      {levelsFor(field, levels).map((l) => (
                        <button
                          key={l}
                          type="button"
                          className="chq-portal-seg-btn"
                          aria-pressed={level === l}
                          onClick={() => onFields(setFieldLevel(fieldPermissions, savedFieldPermissions, field, l))}
                        >
                          {FIELD_LEVEL_LABELS[l]}
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
                {editingHelp ? (
                  <div className="chq-portal-fields-help-row" role="row">
                    <label role="cell" className="chq-portal-fields-help-edit">
                      <span className="chq-portal-field-label">Help text beside {label.toLowerCase()}</span>
                      <input
                        id={helpId}
                        className="chq-input"
                        value={help}
                        maxLength={MAX_FIELD_HELP_LENGTH}
                        placeholder="For example: we use the photo from your keynote announcement."
                        onChange={(e) => onFields(setFieldHelp(fieldPermissions, savedFieldPermissions, field, e.target.value))}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="chq-portal-field-help">
          Email is the sign-in address, so it is never editable here. When portals disagree about a field, the strictest one wins and the participant sees why.
        </p>
      </section>

      <section className="chq-portal-section" aria-labelledby="portal-actions-label">
        <div className="chq-section-head">
          <span className="chq-section-label" id="portal-actions-label">
            Permissions · actions
          </span>
        </div>
        <ul className="chq-portal-caps">
          {CAPABILITIES.map((cap) => {
            const on = capabilities[cap] === true;
            const companyOnly = COMPANY_ONLY_CAPABILITIES.includes(cap);
            const labelId = `portal-cap-${cap}`;
            return (
              <li key={cap} className="chq-portal-caps-row">
                <span className="chq-portal-caps-label" id={labelId}>
                  {CAPABILITY_LABELS[cap]}
                </span>
                {companyOnly && !companies && !on ? (
                  <span className="chq-portal-caps-na">Sponsor portals only</span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby={labelId}
                    className="chq-portal-switch"
                    onClick={() => toggle(cap, !on)}
                  >
                    <span className="chq-portal-switch-track" aria-hidden="true">
                      <span className="chq-portal-switch-knob" />
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {!companies ? <p className="chq-portal-field-help">Teammates and sponsor sessions appear once the rule can match a sponsor contact.</p> : null}
      </section>
    </div>
  );
}
