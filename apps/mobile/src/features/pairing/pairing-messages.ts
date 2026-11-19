import { __ } from '@wordpress/i18n';
import type { ConnectionNotice } from '../../connection/connection-store';
import type { PairingFailure } from '../../connection/pairing';

// What the Pair screen says when pairing fails. Each message says what to do next.
export function pairingFailureMessage( reason: PairingFailure ): string {
	switch ( reason ) {
		case 'unreachable':
			return __(
				'Can’t reach your computer. Check that Settings > Phone is on in Studio there, or that “studio remote” is running, and that this phone is on the same network or VPN.'
			);
		case 'not-studio':
			return __( 'That address did not answer like Studio. Check the address.' );
		case 'wrong-computer':
			return __( 'This code is from a different computer. Scan the code again.' );
		case 'app-too-old':
			return __( 'This app is too old for the Studio on your computer. Update this app.' );
		case 'studio-too-old':
			return __( 'The Studio on your computer is too old for this app. Update Studio.' );
		case 'code-invalid':
			return __(
				'That pairing code is wrong or has expired. Get a new one in Settings > Phone in Studio on your computer, or with “studio remote pair”.'
			);
		case 'too-many-attempts':
			return __( 'Too many attempts. Wait a minute, then try again.' );
		case 'failed':
			return __( 'Pairing did not work. Try again.' );
	}
}

// What the Pair screen says about how the last pairing ended.
export function connectionNoticeMessage( notice: ConnectionNotice ): string {
	switch ( notice ) {
		case 'unpaired':
			return __( 'Your computer no longer lists this phone. Pair again.' );
		case 'expired':
			return __( 'The pairing has expired. Pair again.' );
		case 'not-revoked':
			return __(
				'This phone forgot the computer, but the computer did not answer and still lists this phone. Remove it there in Settings > Phone in Studio, or with “studio remote devices revoke”.'
			);
	}
}
