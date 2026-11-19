import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import { cn } from '../../lib/cn';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

const TONES = {
  neutral: { box: 'bg-surface-muted border-border', text: 'default' },
  primary: { box: 'bg-primary-muted border-primary/25', text: 'primary' },
};

/** Compact tag, optionally removable or selectable. */
export function Chip({ label, tone = 'neutral', onRemove, onPress, selected, testID, className }) {
  const { colors } = useTheme();
  const t = TONES[selected ? 'primary' : tone];
  const body = (
    <View className={cn('flex-row items-center gap-1.5 rounded-full border px-3 py-1.5', t.box, className)}>
      <Text variant="label" tone={t.text}>
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          testID={testID ? `${testID}-remove` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={8}
          onPress={onRemove}
        >
          <X size={14} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
    >
      {body}
    </Pressable>
  );
}

/** Wrapping row of chips with an optional "+N" overflow chip. */
export function ChipList({ items, max, tone, testID }) {
  const shown = max ? items.slice(0, max) : items;
  const hidden = items.length - shown.length;
  return (
    <View className="flex-row flex-wrap gap-1.5" testID={testID}>
      {shown.map((s) => (
        <Chip key={s} label={s} tone={tone} />
      ))}
      {hidden > 0 ? <Chip label={`+${hidden}`} /> : null}
    </View>
  );
}
