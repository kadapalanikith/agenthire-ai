import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { cn } from '../../lib/cn';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export const TextField = forwardRef(function TextField(
  { label, error, hint, secureTextEntry, className, testID, ...inputProps },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View className={cn('gap-1.5', className)}>
      {label ? (
        <Text variant="label" tone="default">
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'h-12 flex-row items-center rounded-xl border bg-surface px-3.5',
          error ? 'border-danger' : focused ? 'border-primary' : 'border-border-strong'
        )}
      >
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          className="flex-1 text-body text-foreground"
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          {...inputProps}
          style={{ outlineStyle: 'none' }}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
          >
            {hidden ? <Eye size={18} color={colors.subtle} /> : <EyeOff size={18} color={colors.subtle} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
