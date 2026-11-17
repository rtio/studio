import { describe, expect, it, vi } from 'vitest';
import { revokeThisDevice } from './revoke-device';
import type { FetchLike } from './api-client';

const PAIRED = { baseUrl: 'http://10.0.0.5:8082', instanceId: 'instance-1', token: 'device-token' };

// A fake computer: who it says it is, and how it answers the request to remove
// the phone. `null` means nothing answers.
function computer( instanceId: string | null, removeStatus = 204 ) {
	return vi.fn< FetchLike >( async ( url ) => {
		if ( instanceId === null ) {
			throw new TypeError( 'Network request failed' );
		}
		if ( url.endsWith( '/.well-known/studio/remote' ) ) {
			return { ok: true, status: 200, json: async () => ( { instanceId } ) };
		}
		return {
			ok: removeStatus < 300,
			status: removeStatus,
			json: async () => ( { error: 'Device is not paired' } ),
		};
	} );
}

function requestsWithToken( fetch: ReturnType< typeof computer > ) {
	return fetch.mock.calls.filter( ( [ , init ] ) => init?.headers?.Authorization );
}

describe( 'revokeThisDevice', () => {
	it( 'asks the paired computer to remove the phone', async () => {
		const fetch = computer( 'instance-1' );

		expect( await revokeThisDevice( PAIRED, fetch ) ).toBe( true );

		const [ [ url, init ] ] = requestsWithToken( fetch );
		expect( url ).toBe( 'http://10.0.0.5:8082/api/remote/devices/current' );
		expect( init?.method ).toBe( 'DELETE' );
	} );

	it( 'counts a phone the computer already removed as removed', async () => {
		expect( await revokeThisDevice( PAIRED, computer( 'instance-1', 401 ) ) ).toBe( true );
	} );

	it( 'does not send the token when another computer answers', async () => {
		const fetch = computer( 'another-computer' );

		expect( await revokeThisDevice( PAIRED, fetch ) ).toBe( false );
		expect( requestsWithToken( fetch ) ).toHaveLength( 0 );
	} );

	it( 'says the phone is still listed when nothing answers or the request fails', async () => {
		expect( await revokeThisDevice( PAIRED, computer( null ) ) ).toBe( false );
		expect( await revokeThisDevice( PAIRED, computer( 'instance-1', 500 ) ) ).toBe( false );
	} );
} );
