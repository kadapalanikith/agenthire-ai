import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginScreen from '../../app/(auth)/login';
import { useAuthStore } from '../../src/stores/authStore';
import { configureApiClient } from '../../src/api/client';
import { mockFetchOnce } from '../helpers/fetch';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return { Link: ({ children }) => <Text>{children}</Text>, router: { replace: jest.fn() } };
});

async function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <LoginScreen />
    </QueryClientProvider>
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    configureApiClient({ baseUrl: 'http://api.test' });
    useAuthStore.setState({ status: 'unauthenticated', user: null, token: null, error: null });
  });

  test('validates input before calling the API', async () => {
    await renderLogin();
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Email is required')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('signs in with valid credentials', async () => {
    const user = { id: 'a'.repeat(24), name: 'Riley', email: 'r@example.com', role: 'recruiter' };
    mockFetchOnce(200, { success: true, data: { user, token: 'jwt' } });
    await renderLogin();
    await fireEvent.changeText(screen.getByTestId('login-email'), 'r@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'Str0ngPassword');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ email: 'r@example.com', password: 'Str0ngPassword' });
  });

  test('shows the server error for invalid credentials', async () => {
    mockFetchOnce(401, { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } });
    await renderLogin();
    await fireEvent.changeText(screen.getByTestId('login-email'), 'r@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Email or password is incorrect')).toBeTruthy();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
