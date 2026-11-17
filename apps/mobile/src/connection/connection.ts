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

// The computer answered 401 for `connection`: this phone is not paired with it
// any more. The app forgets that connection and returns to the Pair screen.
export function reportUnauthorized( connection: Connection ): void {
	const notice = Date.now() >= connection.expiresAt ? 'expired' : 'unpaired';
	void connectionStore.clearIfCurrent( connection.deviceId, notice );
}

// A client for the paired computer.
export function createConnectionClient( connection: Connection ): ApiClient {
	return createApiClient( {
		baseUrl: connection.baseUrl,
		token: connection.token,
		fetch,
		onUnauthorized: () => reportUnauthorized( connection ),
	} );
}
