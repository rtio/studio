import type { Connection } from '../connection/connection-store';

// The cache keys of what the phone reads from the computer. Each key holds the
// device id, so data of an older pairing is never shown for a new one.
export const sitesKey = ( connection: Connection ) => [ 'sites', connection.deviceId ] as const;
export const sessionsKey = ( connection: Connection ) =>
	[ 'sessions', connection.deviceId ] as const;
