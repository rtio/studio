import { QueryClient } from '@tanstack/react-query';

// One cache for everything the phone reads from the computer. Queries do not
// retry by themselves: a screen that cannot reach the computer says so and
// offers "Try again".
export const queryClient = new QueryClient( {
	defaultOptions: { queries: { retry: false } },
} );
