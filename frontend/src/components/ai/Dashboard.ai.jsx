import React from 'react';

export default function DashboardRoot({ props: { children }, renderNode }) {
  if (!children) return null;
  const items = Array.isArray(children) ? children : [children];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>{renderNode(item)}</React.Fragment>
      ))}
    </div>
  );
}
