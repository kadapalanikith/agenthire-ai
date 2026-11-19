import { Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

/** options: [{ value, label, Icon? }] */
export function SegmentedControl({ options, value, onChange, testID }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row gap-1 rounded-xl bg-surface-muted p-1" accessibilityRole="radiogroup" testID={testID}>
      {options.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <Pressable
            key={v}
            testID={testID ? `${testID}-${v}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={label}
            onPress={() => onChange(v)}
            className={cn(
              'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg',
              active && 'border border-border bg-surface'
            )}
          >
            {Icon ? <Icon size={15} color={active ? colors.foreground : colors.muted} /> : null}
            <Text variant="label" tone={active ? 'default' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
