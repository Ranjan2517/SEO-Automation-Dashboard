'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// One hue for the single series (contrast on white is 3.7:1, above the 3:1 needed for graphics).
const LINE = '#0f9488';
const INK_MUTED = '#6b7280';
const SURFACE = '#ffffff';

const day = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
const dayFull = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="text-muted-foreground">{dayFull(p.createdAt)}</div>
      <div className="font-semibold tabular-nums">Score {p.score}/100</div>
    </div>
  );
}

// Direct label on the latest point only, so the chart never prints a number on every dot.
function LastLabel({ x, y, value, index, total }) {
  if (index !== total - 1) return null;
  return (
    <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">
      {value}
    </text>
  );
}

export function ScoreHistory({ audits }) {
  const data = audits.map((a) => ({ id: a.id, createdAt: a.createdAt, score: a.overallScore, label: day(a.createdAt) }));

  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">Your score history will appear here after your second audit.</p>;
  }

  return (
    <div>
      <div role="img" aria-label={`Score history: ${data.map((d) => `${d.label} ${d.score}`).join(', ')}`} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fontSize: 12, fill: INK_MUTED }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 12, fill: INK_MUTED }} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={LINE}
              strokeWidth={2}
              dot={{ r: 4, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              label={<LastLabel total={data.length} />}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-1 font-medium">Audit date</th>
              <th className="py-1 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-1">{dayFull(d.createdAt)}</td>
                <td className="py-1 tabular-nums">{d.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
