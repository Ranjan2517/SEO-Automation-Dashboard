import { Badge } from '@/components/ui/badge';

const STYLES = {
  QUEUED: { variant: 'secondary', className: '' },
  RUNNING: { variant: 'default', className: 'bg-blue-600 text-white' },
  COMPLETED: { variant: 'outline', className: 'border-green-600 text-green-700' },
  FAILED: { variant: 'destructive', className: '' },
};

export function StatusBadge({ status }) {
  const s = STYLES[status] || STYLES.QUEUED;
  return (
    <Badge variant={s.variant} className={s.className}>
      {status}
    </Badge>
  );
}
