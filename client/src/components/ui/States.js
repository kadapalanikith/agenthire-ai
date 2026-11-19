import { View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, WifiOff, XCircle } from 'lucide-react-native';
import { cn } from '../../lib/cn';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({ icon: Icon = Info, title, description, action }) {
  const { colors } = useTheme();
  return (
    <View className="items-center gap-3 px-6 py-10">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted">
        <Icon size={22} color={colors.muted} />
      </View>
      <View className="items-center gap-1">
        <Text variant="heading" className="text-center">
          {title}
        </Text>
        {description ? (
          <Text tone="muted" className="text-center">
            {description}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/** Full error state with retry. Shows network-specific copy for connectivity failures. */
export function ErrorState({ error, title, onRetry, retrying }) {
  const { colors } = useTheme();
  const network = error?.isNetworkError;
  const Icon = network ? WifiOff : AlertTriangle;
  return (
    <View className="items-center gap-3 px-6 py-10">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-danger-muted">
        <Icon size={22} color={colors.danger} />
      </View>
      <View className="items-center gap-1">
        <Text variant="heading" className="text-center">
          {title || (network ? 'You appear to be offline' : 'Something went wrong')}
        </Text>
        <Text tone="muted" className="text-center">
          {error?.message || 'Please try again.'}
        </Text>
      </View>
      {onRetry ? <Button title="Try again" variant="secondary" size="md" onPress={onRetry} loading={retrying} /> : null}
    </View>
  );
}

const ALERT_TONES = {
  error: { box: 'bg-danger-muted border-danger/25', tone: 'danger', Icon: XCircle, color: 'danger' },
  success: { box: 'bg-success-muted border-success/25', tone: 'success', Icon: CheckCircle2, color: 'success' },
  info: { box: 'bg-primary-muted border-primary/20', tone: 'primary', Icon: Info, color: 'primary' },
  warning: { box: 'bg-warning-muted border-warning/25', tone: 'warning', Icon: AlertTriangle, color: 'warning' },
};

/** Inline message box for form-level feedback. */
export function InlineAlert({ tone = 'info', title, message, className }) {
  const { colors } = useTheme();
  const t = ALERT_TONES[tone];
  return (
    <View accessibilityRole="alert" className={cn('flex-row gap-2.5 rounded-xl border p-3', t.box, className)}>
      <t.Icon size={18} color={colors[t.color]} style={{ marginTop: 2 }} />
      <View className="flex-1 gap-0.5">
        {title ? (
          <Text variant="label" tone={t.tone} className="font-semibold">
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text variant="label" tone="default" className="font-normal">
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
