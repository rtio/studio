import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { UnauthorizedError } from '../connection/api-client';
import { connectionStore, createConnectionClient } from '../connection/connection';
import { pairWithComputer } from '../connection/pairing';
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
	await connectionStore.save( connection );
}

// Asks the computer to remove this phone, then forgets the computer. The phone
// forgets it even when the computer does not answer. In that case the Pair
// screen says that the computer still lists this phone.
export async function forgetThisComputer( connection: Connection ): Promise< void > {
	let revoked = true;
	try {
		await createConnectionClient( connection ).delete( '/api/remote/devices/current' );
	} catch ( error ) {
		// A 401 means the computer already removed this phone.
		revoked = error instanceof UnauthorizedError;
	}
	await connectionStore.clear( revoked ? null : 'not-revoked' );
	queryClient.clear();
}
