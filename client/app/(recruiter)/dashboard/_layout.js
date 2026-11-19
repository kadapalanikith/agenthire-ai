import { Tabs } from 'expo-router';
import { Briefcase, LayoutDashboard, Settings, Users } from 'lucide-react-native';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function DashboardTabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size - 2} /> }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: 'Jobs', tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size - 2} /> }}
      />
      <Tabs.Screen
        name="candidates"
        options={{ title: 'Candidates', tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size - 2} /> }}
      />
    </Tabs>
  );
}
