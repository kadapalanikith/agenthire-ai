import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

/**
 * In-screen header used instead of the native stack header so the look is
 * identical on iOS, Android and web. `fallbackHref` is used when there is
 * no history (e.g. a deep link opened directly).
 */
export function ScreenHeader({ title, subtitle, right, fallbackHref, back = true }) {
  const { colors } = useTheme();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (fallbackHref) router.replace(fallbackHref);
  };
  return (
    <View className="gap-3 pb-2 pt-3">
      <View className="min-h-[36px] flex-row items-center justify-between">
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={goBack}
            className="-ml-1.5 flex-row items-center"
            testID="header-back"
          >
            <ChevronLeft size={22} color={colors.foreground} />
            <Text variant="label" className="text-body">
              Back
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        {right}
      </View>
      {title ? (
        <View className="gap-1">
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
