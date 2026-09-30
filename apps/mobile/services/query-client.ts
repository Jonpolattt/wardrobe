import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@wardrobe/api-client';
export const queryClient = new QueryClient({ defaultOptions: {
  queries: {
    staleTime: 60_000, gcTime: 5 * 60_000,
    retry: (count, error) => count < 1 && error instanceof ApiClientError && ['NETWORK', 'TIMEOUT'].includes(error.kind),
    refetchOnWindowFocus: true,
  },
  // Checkout, toggles and quantity increments must never replay after uncertain completion.
  mutations: { retry: false },
} });
