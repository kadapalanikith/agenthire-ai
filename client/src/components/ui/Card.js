import { View } from 'react-native';
import { cn } from '../../lib/cn';
import { Text } from './Text';

export function Card({ className, children, ...props }) {
  return (
    <View className={cn('rounded-2xl border border-border bg-surface p-4', className)} {...props}>
      {children}
    </View>
  );
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-3">
      <View className="flex-1 gap-0.5">
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="label" tone="muted" className="font-normal">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
