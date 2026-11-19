import { View } from 'react-native';
import { cn } from '../../lib/cn';
import { Text } from './Text';

const TONES = {
  neutral: { box: 'bg-surface-muted border-border', text: 'muted', dot: 'bg-subtle' },
  primary: { box: 'bg-primary-muted border-primary/20', text: 'primary', dot: 'bg-primary' },
  success: { box: 'bg-success-muted border-success/20', text: 'success', dot: 'bg-success' },
  warning: { box: 'bg-warning-muted border-warning/20', text: 'warning', dot: 'bg-warning' },
  danger: { box: 'bg-danger-muted border-danger/20', text: 'danger', dot: 'bg-danger' },
};

export function Badge({ label, tone = 'neutral', dot = true, className, testID }) {
  const t = TONES[tone];
  return (
    <View testID={testID} className={cn('flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1', t.box, className)}>
      {dot ? <View className={cn('h-1.5 w-1.5 rounded-full', t.dot)} /> : null}
      <Text variant="caption" tone={t.text} className="font-semibold">
        {label}
      </Text>
    </View>
  );
}
