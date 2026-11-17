import { useQuery } from '@tanstack/react-query';
import { createConnectionClient } from '../connection/connection';
import type { Connection } from '../connection/connection-store';

const RECHECK_MS = 15_000;

// Asks the paired computer whether it answers, now and every 15 seconds. The
// query fails while the computer cannot be reached.
export function useComputerReachable( connection: Connection ) {
	return useQuery( {
		queryKey: [ 'health', connection.baseUrl, connection.deviceId ],
		queryFn: async () => {
			await createConnectionClient( connection ).get( '/api/health' );
			return true;
		},
		refetchInterval: RECHECK_MS,
	} );
}
