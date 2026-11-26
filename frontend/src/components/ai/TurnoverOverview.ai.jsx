import React from 'react';
import TurnoverOverview from '../TurnoverOverview.jsx';

// The year is resolved at render time when omitted, so a cached layout never goes stale.
function resolveYear(year) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

// AI block: cross-project turnover for one year, with ‹ / › year switching (feature 010).
export default function TurnoverOverviewAI({ props: { year } }) {
  return <TurnoverOverview initialYear={resolveYear(year)} />;
}
