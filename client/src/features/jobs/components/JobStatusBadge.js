import { Badge } from '../../../components/ui';

export function JobStatusBadge({ status }) {
  return status === 'open' ? <Badge label="Open" tone="success" /> : <Badge label="Closed" tone="neutral" />;
}
