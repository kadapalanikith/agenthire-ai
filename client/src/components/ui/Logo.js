import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

/** AgentHire mark: connected workflow nodes inside a rounded tile. */
export function LogoMark({ size = 40 }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.foreground }}
      className="items-center justify-center"
    >
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <Path d="M6 18 L12 6 L18 18" stroke={colors.background} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8.6 13.2 H15.4" stroke={colors.background} strokeWidth={2.2} strokeLinecap="round" />
        <Circle cx={12} cy={6} r={2.2} fill={colors.primary} />
      </Svg>
    </View>
  );
}

export function Logo({ size = 36 }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <LogoMark size={size} />
      <Text variant="heading" className="text-[19px] tracking-tight">
        AgentHire
      </Text>
    </View>
  );
}
