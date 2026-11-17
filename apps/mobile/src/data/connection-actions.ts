import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createApiClient } from '../connection/api-client';
import { connectionStore } from '../connection/connection';
import { pairWithComputer } from '../connection/pairing';
import { revokeThisDevice } from '../connection/revoke-device';
import { queryClient } from './query-client';
import type { Connection } from '../connection/connection-store';
import type { PairingLink } from '../connection/pairing-link';

// Pairs this phone with the computer and remembers it. Throws PairingError.
export async function pairThisPhone( link: PairingLink ): Promise< void > {
	const platform = Platform.OS === 'android' ? 'android' : 'ios';
	const connection = await pairWithComputer( {
		link,
		// The name the computer shows in `studio remote devices list`.
		deviceName: Constants.deviceName ?? ( platform === 'android' ? 'Android phone' : 'iPhone' ),
		platform,
		fetch,
	} );
	queryClient.clear();
	try {
		await connectionStore.save( connection );
	} catch ( error ) {
		// The code is spent and the computer lists this phone, but the phone could
		// not keep the token. Ask the computer to remove the phone again, so no
		// unused device stays listed.
		try {
			await createApiClient( {
				baseUrl: connection.baseUrl,
				token: connection.token,
				fetch,
			} ).delete( '/api/remote/devices/current' );
		} catch {
			// Nothing more the phone can do. The token is lost and expires by itself.
		}
		throw error;
	}
}

// Asks the computer to remove this phone, then forgets the computer. The phone
// forgets it even when the computer does not answer. In that case the Pair
// screen says that the computer still lists this phone.
export async function forgetThisComputer( connection: Connection ): Promise< void > {
	const revoked = await revokeThisDevice( connection, fetch );
	await connectionStore.clearIfCurrent( connection.deviceId, revoked ? null : 'not-revoked' );
	queryClient.clear();
}
