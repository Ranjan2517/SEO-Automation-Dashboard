import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BREAKDOWN = [
  ['technical', 'Technical'],
  ['on_page', 'On-page'],
  ['content', 'Content'],
  ['core_web_vitals', 'Core Web Vitals'],
  ['schema', 'Schema'],
];

export const scoreColor = (n) => (n >= 80 ? 'text-green-600' : n >= 60 ? 'text-amber-600' : 'text-red-600');

// Overall score plus the five category scores.
export function ScoreCards({ analysis }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <Card>
        <CardContent className="pt-4 text-center">
          <div className={`text-4xl font-bold ${scoreColor(analysis.overall_score)}`}>{analysis.overall_score}</div>
          <div className="text-xs text-muted-foreground">Overall score</div>
        </CardContent>
      </Card>
      {BREAKDOWN.map(([key, label]) => (
        <Card key={key}>
          <CardContent className="pt-4 text-center">
            <div className={`text-3xl font-semibold ${scoreColor(analysis.score_breakdown[key])}`}>{analysis.score_breakdown[key]}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function IssueList({ title, items }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None.</p>
        )}
      </CardContent>
    </Card>
  );
}
