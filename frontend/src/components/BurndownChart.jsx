import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

const fmt = d => {
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      lineHeight: 1.8,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{fmt(label)}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value != null ? `${p.value}h` : '—'}
        </div>
      ))}
    </div>
  );
};

export default function BurndownChart({ data }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={fmt}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}h`}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Daily logged hours as bars */}
        <Bar
          dataKey="logged"
          name="Daily Logged"
          fill="rgba(163,230,53,0.18)"
          stroke="rgba(163,230,53,0.35)"
          strokeWidth={1}
          radius={[2, 2, 0, 0]}
        />

        {/* Ideal burndown line */}
        <Line
          dataKey="ideal"
          name="Ideal"
          stroke="var(--accent3)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent3)' }}
        />

        {/* Actual burndown line */}
        <Line
          dataKey="actual"
          name="Actual"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent)' }}
          connectNulls={false}
        />

        {/* Today reference line */}
        <ReferenceLine
          x={today}
          stroke="var(--muted)"
          strokeDasharray="3 3"
          label={{ value: 'Today', fill: 'var(--muted)', fontSize: 11, position: 'insideTopRight' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
