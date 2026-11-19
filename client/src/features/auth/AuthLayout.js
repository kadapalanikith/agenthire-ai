import { View } from 'react-native';
import { Logo, Screen, Text } from '../../components/ui';

/** Shared frame for authentication screens. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <Screen>
      <View className="flex-1 justify-center gap-8 py-10">
        <View className="gap-6">
          <Logo />
          <View className="gap-1.5">
            <Text variant="display">{title}</Text>
            {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
          </View>
        </View>
        <View className="gap-4">{children}</View>
        {footer ? <View className="items-center">{footer}</View> : null}
      </View>
    </Screen>
  );
}
