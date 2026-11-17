import { describe, expect, it, vi } from 'vitest';
import { PairingError, pairWithComputer } from './pairing';
import type { FetchLike } from './api-client';
import type { PairingFailure } from './pairing';
import type { PairingLink } from './pairing-link';

const LINK: PairingLink = {
	baseUrl: 'http://10.0.0.5:8082',
	code: 'K7QM2XVA9D3H',
	instanceId: 'instance-1',
};

const DESCRIPTOR = {
	instanceId: 'instance-1',
	label: 'Work laptop',
	protocolVersion: 1,
	studioVersion: '1.9.0',
};

const PAIRED = { token: 'device-token', deviceId: 'device-1', expiresAt: 1_800_000_000_000 };

type Answer = { status: number; payload?: unknown } | 'network-error';

// A fake computer: one answer for the descriptor, one for the pairing request.
function fakeComputer( descriptor: Answer, pair: Answer = { status: 200, payload: PAIRED } ) {
	return vi.fn< FetchLike >( async ( url ) => {
		const answer = url.endsWith( '/.well-known/studio/remote' ) ? descriptor : pair;
		if ( answer === 'network-error' ) {
			throw new TypeError( 'Network request failed' );
		}
		return {
			ok: answer.status >= 200 && answer.status < 300,
			status: answer.status,
			json: async () => answer.payload,
		};
	} );
}

async function failureOf( fetch: FetchLike, link: PairingLink = LINK ): Promise< PairingFailure > {
	const error = await pairWithComputer( {
		link,
		deviceName: 'Pixel 9',
		platform: 'android',
		fetch,
	} ).catch( ( caught: unknown ) => caught );
	expect( error ).toBeInstanceOf( PairingError );
	return ( error as PairingError ).reason;
}

describe( 'pairWithComputer', () => {
	it( 'returns the connection after the descriptor check and the code exchange', async () => {
		const fetch = fakeComputer( { status: 200, payload: DESCRIPTOR } );

		const connection = await pairWithComputer( {
			link: LINK,
			deviceName: '  Pixel 9  ',
			platform: 'android',
			fetch,
		} );

		expect( connection ).toEqual( {
			baseUrl: 'http://10.0.0.5:8082',
			instanceId: 'instance-1',
			label: 'Work laptop',
			token: 'device-token',
			deviceId: 'device-1',
			expiresAt: 1_800_000_000_000,
		} );
		expect( fetch ).toHaveBeenCalledTimes( 2 );
		const [ url, init ] = fetch.mock.calls[ 1 ];
		expect( url ).toBe( 'http://10.0.0.5:8082/api/remote/pair' );
		expect( JSON.parse( init?.body ?? '' ) ).toEqual( {
			code: 'K7QM2XVA9D3H',
			deviceName: 'Pixel 9',
			platform: 'android',
		} );
	} );

	it( 'pairs from a typed address, which has no instance id to check', async () => {
		const fetch = fakeComputer( { status: 200, payload: DESCRIPTOR } );

		const connection = await pairWithComputer( {
			link: { baseUrl: LINK.baseUrl, code: LINK.code },
			deviceName: 'iPhone',
			platform: 'ios',
			fetch,
		} );

		expect( connection.instanceId ).toBe( 'instance-1' );
	} );

	it( 'does not spend the code when the computer is not the one that showed it', async () => {
		const fetch = fakeComputer( {
			status: 200,
			payload: { ...DESCRIPTOR, instanceId: 'another-computer' },
		} );

		expect( await failureOf( fetch ) ).toBe( 'wrong-computer' );
		expect( fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not spend the code when the protocol versions differ', async () => {
		const newerStudio = fakeComputer( {
			status: 200,
			payload: { ...DESCRIPTOR, protocolVersion: 2 },
		} );
		const olderStudio = fakeComputer( {
			status: 200,
			payload: { ...DESCRIPTOR, protocolVersion: 0 },
		} );

		expect( await failureOf( newerStudio ) ).toBe( 'app-too-old' );
		expect( await failureOf( olderStudio ) ).toBe( 'studio-too-old' );
		expect( newerStudio ).toHaveBeenCalledTimes( 1 );
		expect( olderStudio ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'says the computer is unreachable when a request gets no answer', async () => {
		expect( await failureOf( fakeComputer( 'network-error' ) ) ).toBe( 'unreachable' );
		expect(
			await failureOf( fakeComputer( { status: 200, payload: DESCRIPTOR }, 'network-error' ) )
		).toBe( 'unreachable' );
	} );

	it( 'says the address is not Studio when the descriptor is missing or has another shape', async () => {
		expect( await failureOf( fakeComputer( { status: 404, payload: {} } ) ) ).toBe( 'not-studio' );
		expect( await failureOf( fakeComputer( { status: 200, payload: { hello: 'world' } } ) ) ).toBe(
			'not-studio'
		);
	} );

	it( 'says the code is wrong when the computer refuses it, and fails on a malformed request', async () => {
		const refused = fakeComputer(
			{ status: 200, payload: DESCRIPTOR },
			{ status: 401, payload: { error: 'Pairing code is not valid' } }
		);
		const malformed = fakeComputer(
			{ status: 200, payload: DESCRIPTOR },
			{ status: 400, payload: { error: 'code, deviceName and platform are required' } }
		);

		expect( await failureOf( refused ) ).toBe( 'code-invalid' );
		// A 400 means the request itself was wrong, which no other code would fix.
		expect( await failureOf( malformed ) ).toBe( 'failed' );
	} );

	it( 'sends a device name the computer accepts: 1 to 80 characters', async () => {
		const longName = fakeComputer( { status: 200, payload: DESCRIPTOR } );
		const noName = fakeComputer( { status: 200, payload: DESCRIPTOR } );

		await pairWithComputer( {
			link: LINK,
			deviceName: 'x'.repeat( 200 ),
			platform: 'ios',
			fetch: longName,
		} );
		await pairWithComputer( { link: LINK, deviceName: '   ', platform: 'ios', fetch: noName } );

		const sentName = ( fetch: typeof longName ) =>
			( JSON.parse( fetch.mock.calls[ 1 ][ 1 ]?.body ?? '' ) as { deviceName: string } ).deviceName;
		expect( sentName( longName ) ).toBe( 'x'.repeat( 80 ) );
		expect( sentName( noName ) ).toBe( 'Phone' );
	} );

	it( 'says to wait when the computer limits pairing attempts', async () => {
		const limited = fakeComputer( { status: 200, payload: DESCRIPTOR }, { status: 429 } );

		expect( await failureOf( limited ) ).toBe( 'too-many-attempts' );
	} );

	it( 'fails when the pairing answer has no token', async () => {
		const empty = fakeComputer(
			{ status: 200, payload: DESCRIPTOR },
			{ status: 200, payload: {} }
		);
		const broken = fakeComputer( { status: 200, payload: DESCRIPTOR }, { status: 500 } );

		expect( await failureOf( empty ) ).toBe( 'failed' );
		expect( await failureOf( broken ) ).toBe( 'failed' );
	} );
} );
