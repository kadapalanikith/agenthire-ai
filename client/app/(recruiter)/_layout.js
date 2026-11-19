import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Recruiter area. Access is enforced by Stack.Protected in the root layout and by the API. */
export default function RecruiterLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
