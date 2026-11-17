import { describe, expect, it } from 'vitest';
import { connectionNoticeMessage, pairingFailureMessage } from './pairing-messages';
import type { PairingFailure } from '../../connection/pairing';

const REASONS: PairingFailure[] = [
	'unreachable',
	'not-studio',
	'wrong-computer',
	'app-too-old',
	'studio-too-old',
	'code-invalid',
	'too-many-attempts',
	'failed',
];

describe( 'pairingFailureMessage', () => {
	it( 'has a different message for every reason', () => {
		const messages = REASONS.map( pairingFailureMessage );

		expect( new Set( messages ).size ).toBe( REASONS.length );
		for ( const message of messages ) {
			expect( message.length ).toBeGreaterThan( 10 );
		}
	} );
} );

describe( 'connectionNoticeMessage', () => {
	it( 'says why the phone is not paired any more', () => {
		expect( connectionNoticeMessage( 'unpaired' ) ).not.toBe(
			connectionNoticeMessage( 'expired' )
		);
	} );
} );
