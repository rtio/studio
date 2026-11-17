import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, HttpError, UnauthorizedError, UnreachableError } from './api-client';
import type { FetchLike } from './api-client';

function answer( status: number, payload?: unknown ): Awaited< ReturnType< FetchLike > > {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => {
			if ( payload === undefined ) {
				throw new Error( 'no body' );
			}
			return payload;
		},
	};
}

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'createApiClient', () => {
	it( 'sends the device token and returns the JSON answer', async () => {
		const fetch = vi.fn< FetchLike >( async () => answer( 200, { status: 'ok' } ) );
		const api = createApiClient( {
			baseUrl: 'http://10.0.0.5:8082',
			token: 'device-token',
			fetch,
		} );

		const payload = await api.get( '/api/health' );

		expect( payload ).toEqual( { status: 'ok' } );
		expect( fetch ).toHaveBeenCalledTimes( 1 );
		const [ url, init ] = fetch.mock.calls[ 0 ];
		expect( url ).toBe( 'http://10.0.0.5:8082/api/health' );
		expect( init?.method ).toBe( 'GET' );
		expect( init?.headers ).toEqual( {
			Accept: 'application/json',
			Authorization: 'Bearer device-token',
		} );
		expect( init?.body ).toBeUndefined();
	} );

	it( 'sends a JSON body and no Authorization header when it has no token', async () => {
		const fetch = vi.fn< FetchLike >( async () => answer( 200, { token: 'new' } ) );
		const api = createApiClient( { baseUrl: 'http://10.0.0.5:8082', fetch } );

		await api.post( '/api/remote/pair', { code: 'K7QM2XVA9D3H' } );

		const [ , init ] = fetch.mock.calls[ 0 ];
		expect( init?.method ).toBe( 'POST' );
		expect( init?.headers ).toEqual( {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		} );
		expect( init?.body ).toBe( '{"code":"K7QM2XVA9D3H"}' );
	} );

	it( 'returns undefined for an answer with no content', async () => {
		const fetch = vi.fn< FetchLike >( async () => answer( 204 ) );
		const api = createApiClient( { baseUrl: 'http://10.0.0.5:8082', token: 't', fetch } );

		expect( await api.delete( '/api/remote/devices/current' ) ).toBeUndefined();
	} );

	it( 'reports 401 to the owner and throws UnauthorizedError', async () => {
		const fetch = vi.fn< FetchLike >( async () =>
			answer( 401, { error: 'Device is not paired' } )
		);
		const onUnauthorized = vi.fn();
		const api = createApiClient( {
			baseUrl: 'http://10.0.0.5:8082',
			token: 'revoked',
			fetch,
			onUnauthorized,
		} );

		await expect( api.get( '/api/health' ) ).rejects.toBeInstanceOf( UnauthorizedError );
		expect( onUnauthorized ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'throws HttpError with the status and the message of the computer', async () => {
		const fetch = vi.fn< FetchLike >( async () =>
			answer( 403, { error: 'Not available in remote mode' } )
		);
		const api = createApiClient( { baseUrl: 'http://10.0.0.5:8082', token: 't', fetch } );

		const error = await api.get( '/api/settings' ).catch( ( caught: unknown ) => caught );

		expect( error ).toBeInstanceOf( HttpError );
		expect( ( error as HttpError ).status ).toBe( 403 );
		expect( ( error as HttpError ).message ).toBe( 'Not available in remote mode' );
	} );

	it( 'throws HttpError with a default message when the answer is not JSON', async () => {
		const fetch = vi.fn< FetchLike >( async () => answer( 500 ) );
		const api = createApiClient( { baseUrl: 'http://10.0.0.5:8082', token: 't', fetch } );

		await expect( api.get( '/api/sites' ) ).rejects.toThrow( 'Request failed with status 500' );
	} );

	it( 'throws UnreachableError when the request fails', async () => {
		const fetch = vi.fn< FetchLike >( async () => {
			throw new TypeError( 'Network request failed' );
		} );
		const api = createApiClient( { baseUrl: 'http://10.0.0.5:8082', token: 't', fetch } );

		await expect( api.get( '/api/health' ) ).rejects.toBeInstanceOf( UnreachableError );
	} );

	it( 'stops waiting after the timeout and throws UnreachableError', async () => {
		vi.useFakeTimers();
		const fetch = vi.fn< FetchLike >(
			( _url, init ) =>
				new Promise( ( _resolve, reject ) => {
					init?.signal?.addEventListener( 'abort', () => reject( new Error( 'aborted' ) ) );
				} )
		);
		const api = createApiClient( {
			baseUrl: 'http://10.0.0.5:8082',
			token: 't',
			fetch,
			timeoutMs: 5_000,
		} );

		const pending = api.get( '/api/health' ).catch( ( caught: unknown ) => caught );
		await vi.advanceTimersByTimeAsync( 5_000 );

		expect( await pending ).toBeInstanceOf( UnreachableError );
	} );
} );
