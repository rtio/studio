import { useSyncExternalStore } from 'react';
import { secureStorage } from '../lib/secure-storage';
import { createApiClient } from './api-client';
import { createConnectionStore } from './connection-store';
import type { ApiClient } from './api-client';
import type { Connection, ConnectionState } from './connection-store';

// The app's one connection, kept in secure storage.
export const connectionStore = createConnectionStore( secureStorage );

export function useConnectionState(): ConnectionState {
	return useSyncExternalStore( connectionStore.subscribe, connectionStore.getState );
}

// A client for the paired computer. When the computer says this phone is no
// longer paired, the app forgets the connection and returns to the Pair screen.
export function createConnectionClient( connection: Connection ): ApiClient {
	return createApiClient( {
		baseUrl: connection.baseUrl,
		token: connection.token,
		fetch,
		onUnauthorized: () => {
			void connectionStore.clear( 'unpaired' );
		},
	} );
}
