import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
}

export async function renderWithProviders(ui) {
  const client = createTestQueryClient();
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}
