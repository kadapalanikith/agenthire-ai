import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

/** Root route: send users to the dashboard or to sign in based on session state. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  return <Redirect href={status === 'authenticated' ? '/dashboard' : '/login'} />;
}
