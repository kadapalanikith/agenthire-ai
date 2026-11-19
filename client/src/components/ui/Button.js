import { ActivityIndicator, Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

const CONTAINER = {
  primary: 'bg-primary',
  secondary: 'bg-surface border border-border-strong',
  ghost: 'bg-transparent',
  danger: 'bg-danger-muted border border-danger/30',
};

const LABEL_TONE = { primary: 'inverse', secondary: 'default', ghost: 'primary', danger: 'danger' };

const SIZES = { md: 'h-11 px-4', lg: 'h-12 px-5', sm: 'h-9 px-3' };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon: Icon,
  className,
  accessibilityLabel,
  testID,
}) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const fg = variant === 'primary' ? colors['primary-foreground'] : variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.primary : colors.foreground;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      className={cn(
        'flex-row items-center justify-center rounded-xl',
        CONTAINER[variant],
        SIZES[size],
        inactive && 'opacity-60',
        className
      )}
      style={({ pressed }) => (pressed && !inactive ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null)}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View className="flex-row items-center gap-2">
          {Icon ? <Icon size={18} color={fg} strokeWidth={2} /> : null}
          <Text variant="label" tone={LABEL_TONE[variant]} className="text-body font-semibold">
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
