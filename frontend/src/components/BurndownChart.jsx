import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList,
} from 'recharts';

// Daily booked hours get their own fixed scale, the same in every chart (feature 011, spec Q1).
// The domain is three times the maximum, so the bars use at most the lower third of the plot (plan R1).
const DAILY_MAX_HOURS = 10;
const DAILY_DOMAIN    = [0, DAILY_MAX_HOURS * 3];

// ▲ above a bar whose day exceeds DAILY_MAX_HOURS (the bar itself is capped)
const OverMarker = ({ x, y, width, value }) => {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--text)" fontSize={10}>▲</text>
  );
};

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
      {payload.map(p => {
        // Daily bars are capped at DAILY_MAX_HOURS — show the real booked hours
        const value = p.dataKey === 'daily' ? p.payload.logged : p.value;
        return (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {value != null ? `${value}h` : '—'}
          </div>
        );
      })}
    </div>
  );
};

export default function BurndownChart({ data, barFill, barStroke }) {
  const today = new Date().toISOString().slice(0, 10);
  const chartData = useMemo(() => (data ?? []).map(d => ({
    ...d,
    daily: Math.min(d.logged ?? 0, DAILY_MAX_HOURS),
    over:  (d.logged ?? 0) > DAILY_MAX_HOURS,
  })), [data]);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
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
        {/* Own fixed scale for the daily bars (right side) */}
        <YAxis
          yAxisId="daily"
          orientation="right"
          domain={DAILY_DOMAIN}
          ticks={[0, 5, 10]}
          allowDataOverflow
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={v => `${v}h`}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Daily logged hours as bars, on the fixed daily scale */}
        <Bar
          yAxisId="daily"
          dataKey="daily"
          name="Daily Logged"
          fill={barFill}
          stroke={barStroke}
          strokeWidth={1}
          radius={[2, 2, 0, 0]}
        >
          <LabelList dataKey="over" content={OverMarker} />
        </Bar>

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

        {/* Forecast line – lineare Verlängerung der Ist-Linie */}
        <Line
          dataKey="forecast"
          name="Forecast"
          stroke="var(--accent2)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent2)' }}
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
