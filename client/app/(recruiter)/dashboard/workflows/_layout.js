import { Stack } from 'expo-router';
import { useTheme } from '../../../../src/theme/ThemeProvider';

export const unstable_settings = { anchor: 'index' };

export default function WorkflowsStackLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
