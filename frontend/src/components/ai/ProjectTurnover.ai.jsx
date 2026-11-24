import React from 'react';
import ProjectTurnover from '../ProjectTurnover.jsx';

// AI block: turnover per year (invoiced / paid / open) for one project.
// Reuses the project-detail turnover table, incl. loading, retry and "No invoices yet".
export default function ProjectTurnoverAI({ props: { projectId } }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <ProjectTurnover projectId={projectId} reloadKey={0} />
    </div>
  );
}
