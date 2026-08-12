import { NavLink } from 'react-router-dom';
import { SubmissionsTable } from './submissions/SubmissionsTable';
import './submissions/submissions.css';

export function SubmissionsPage() {
  return (
    <div>
      <div className="chq-submissions-tabs">
        <NavLink to="/submissions/forms" className="chq-submissions-forms-link">
          Forms
        </NavLink>
      </div>
      <SubmissionsTable />
    </div>
  );
}
