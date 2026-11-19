import { View } from 'react-native';
import { Badge, Card, CardHeader, ErrorState, Skeleton, Text } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useSystemHealth } from './hooks';

function Row({ label, value, tone, last }) {
  return (
    <View className={cn('flex-row items-center justify-between py-3', !last && 'border-b border-border')}>
      <Text>{label}</Text>
      <Badge label={value} tone={tone} />
    </View>
  );
}

const service = (v) => (v === 'up' ? { value: 'Operational', tone: 'success' } : { value: 'Unavailable', tone: 'danger' });
const configured = (v) => (v ? { value: 'Configured', tone: 'success' } : { value: 'Not configured', tone: 'warning' });
const OVERALL = {
  ok: { label: 'All systems', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warning' },
  down: { label: 'Down', tone: 'danger' },
};

/** Live dependency status from GET /health — nothing here is simulated. */
export function SystemStatusCard() {
  const health = useSystemHealth();

  if (health.isPending) {
    return (
      <Card testID="system-status-loading">
        <Skeleton className="mb-4 h-5 w-40" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="my-2 h-6 w-full" />
        ))}
      </Card>
    );
  }

  if (health.isError) {
    return (
      <Card testID="system-status-error">
        <ErrorState error={health.error} title="Can't reach the API" onRetry={health.refetch} retrying={health.isFetching} />
      </Card>
    );
  }

  const { services, configured: cfg, status } = health.data;
  const overall = OVERALL[status] || OVERALL.down;
  const rows = [
    { label: 'Database', ...service(services.mongo) },
    { label: 'Vector database', ...service(services.qdrant) },
    { label: 'AI provider', ...configured(cfg.llm_primary || cfg.llm_fallback) },
    { label: 'Email delivery', ...configured(cfg.email) },
  ];

  return (
    <Card testID="system-status">
      <CardHeader
        title="System status"
        subtitle="Services that power your AI workflows"
        right={<Badge label={overall.label} tone={overall.tone} />}
      />
      {rows.map((r, i) => (
        <Row key={r.label} label={r.label} value={r.value} tone={r.tone} last={i === rows.length - 1} />
      ))}
    </Card>
  );
}
