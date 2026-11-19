import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { cn } from '../../lib/cn';

/** Pulsing placeholder shown while content loads. */
export function Skeleton({ className, style }) {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('rounded-lg bg-surface-muted', className)}
      style={[animated, style]}
    />
  );
}
