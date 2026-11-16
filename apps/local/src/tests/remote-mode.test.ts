import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLocalServer, type LocalServer } from '../index';
import { isRemoteRouteAllowed } from '../remote-mode';
import {
	baseServerOptions,
	pairDevice,
	request as send,
	startRemoteTestServer,
	type RequestOptions,
	type TestRemoteServer,
} from './remote-test-utils';

let test: TestRemoteServer;
let server: LocalServer;
// Pairing allows 10 requests a minute, so the file pairs once and reuses this.
let token: string;

beforeAll( async () => {
	test = await startRemoteTestServer();
	server = test.server;
	( { token } = await pairDevice( server.port ) );
} );

afterAll( async () => {
	await test.stop();
} );

function request( options: RequestOptions ) {
	return send( server.port, options );
}

describe( 'remote mode', () => {
	it( 'refuses to listen on the network without remote mode', async () => {
		await expect( startLocalServer( { ...baseServerOptions, host: '0.0.0.0' } ) ).rejects.toThrow(
			/remote mode/i
		);
	} );

	it( 'describes itself without auth', async () => {
		const reply = await request( { path: '/.well-known/studio/remote' } );
		expect( reply.status ).toBe( 200 );
		expect( reply.json ).toMatchObject( {
			label: 'Test Mac',
			protocolVersion: 1,
			studioVersion: '0.0.0-test',
		} );
		expect( reply.json?.instanceId ).toMatch( /^[0-9a-f-]{36}$/ );
	} );

	it( 'rejects a wrong pairing code', async () => {
		const reply = await request( {
			method: 'POST',
			path: '/api/remote/pair',
			body: { code: 'WRONGWRONGWR', deviceName: 'Test phone', platform: 'ios' },
		} );
		expect( reply.status ).toBe( 401 );
	} );

	it( 'refuses a large body before the guard reads it', async () => {
		const reply = await request( {
			method: 'POST',
			path: '/api/remote/pair',
			body: {
				code: 'WRONGWRONGWR',
				deviceName: 'Test phone',
				platform: 'ios',
				padding: 'x'.repeat( 300_000 ),
			},
		} );
		expect( reply.status ).toBe( 413 );
	} );

	it( 'still answers a modest body with a wrong code', async () => {
		const reply = await request( {
			method: 'POST',
			path: '/api/remote/pair',
			body: {
				code: 'WRONGWRONGWR',
				deviceName: 'Test phone',
				platform: 'ios',
				padding: 'x'.repeat( 100_000 ),
			},
		} );
		expect( reply.status ).toBe( 401 );
	} );

	it( 'rejects a pairing request with missing fields', async () => {
		const reply = await request( {
			method: 'POST',
			path: '/api/remote/pair',
			body: { code: 'ABCDEFGH2345' },
		} );
		expect( reply.status ).toBe( 400 );
	} );

	it( 'pairs a device and lets its token in', async () => {
		expect( ( await request( { path: '/api/health', token } ) ).status ).toBe( 200 );
		expect( ( await request( { path: '/api/runs/active', token } ) ).status ).toBe( 200 );
	} );

	it( 'answers 401 without a valid token', async () => {
		expect( ( await request( { path: '/api/health' } ) ).status ).toBe( 401 );
		expect( ( await request( { path: '/api/health', token: 'nope' } ) ).status ).toBe( 401 );
	} );

	it( 'answers 403 for every registered route outside the allowlist', async () => {
		const blocked = server.apiRoutes
			.map( ( route ) => ( { ...route, path: route.path.replace( /:[A-Za-z]+/g, 'x' ) } ) )
			.filter( ( route ) => ! isRemoteRouteAllowed( route.method, route.path ) );
		expect( blocked.length ).toBeGreaterThan( 50 );
		for ( const route of blocked ) {
			const reply = await request( { method: route.method, path: `/api${ route.path }`, token } );
			expect( `${ route.method } ${ route.path } ${ reply.status }` ).toBe(
				`${ route.method } ${ route.path } 403`
			);
		}
	} );

	it( 'answers 403 for a path the server does not know', async () => {
		expect( ( await request( { path: '/api/no-such-route', token } ) ).status ).toBe( 403 );
	} );

	it( 'rejects requests that come from a web page', async () => {
		const reply = await request( { path: '/api/health', token, origin: 'http://evil.example' } );
		expect( reply.status ).toBe( 403 );
	} );

	it( 'accepts text messages only', async () => {
		const reply = await request( {
			method: 'POST',
			path: '/api/sessions/some-session/messages',
			token,
			body: { prompt: 'hello', images: [ { mimeType: 'image/png', data: 'AAAA' } ] },
		} );
		expect( reply.status ).toBe( 400 );
		expect( reply.json?.error ).toMatch( /attachments/i );
	} );

	it( 'lets a phone forget this computer', async () => {
		const own = await pairDevice( server.port );
		const reply = await request( {
			method: 'DELETE',
			path: '/api/remote/devices/current',
			token: own.token,
		} );
		expect( reply.status ).toBe( 204 );
		expect( ( await request( { path: '/api/health', token: own.token } ) ).status ).toBe( 401 );
	} );

	it( 'does not serve the sign-in callback page', async () => {
		expect( ( await request( { path: '/auth/callback' } ) ).status ).toBe( 404 );
	} );
} );
