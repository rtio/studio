import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createPairingCode } from '@studio/common/lib/remote-access';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLocalServer, type LocalServer } from '../index';
import { isRemoteRouteAllowed } from '../remote-mode';

let server: LocalServer;
let configDir: string;

const baseOptions = {
	cliBinary: path.join( os.tmpdir(), 'studio-test-cli.mjs' ),
	sessionsRoot: path.join( os.tmpdir(), 'studio-test-sessions' ),
	sitesRoot: path.join( os.tmpdir(), 'studio-test-sites' ),
	port: 0,
};

beforeAll( async () => {
	configDir = mkdtempSync( path.join( os.tmpdir(), 'studio-remote-mode-' ) );
	process.env.DEV_CONFIG_DIR = configDir;
	server = await startLocalServer( {
		...baseOptions,
		host: '127.0.0.1',
		remote: { label: 'Test Mac', studioVersion: '0.0.0-test' },
	} );
} );

afterAll( async () => {
	await server.close();
	delete process.env.DEV_CONFIG_DIR;
	rmSync( configDir, { recursive: true, force: true } );
} );

interface Reply {
	status: number;
	json: Record< string, unknown > | undefined;
}

function request( options: {
	method?: string;
	path: string;
	token?: string;
	origin?: string;
	body?: unknown;
} ): Promise< Reply > {
	return new Promise( ( resolve, reject ) => {
		const payload = options.body === undefined ? undefined : JSON.stringify( options.body );
		const req = http.request(
			{
				host: '127.0.0.1',
				port: server.port,
				path: options.path,
				method: options.method ?? 'GET',
				headers: {
					...( payload
						? { 'content-type': 'application/json', 'content-length': Buffer.byteLength( payload ) }
						: {} ),
					...( options.token ? { authorization: `Bearer ${ options.token }` } : {} ),
					...( options.origin ? { origin: options.origin } : {} ),
				},
			},
			( response ) => {
				let raw = '';
				response.setEncoding( 'utf8' );
				response.on( 'data', ( chunk ) => ( raw += chunk ) );
				response.on( 'end', () => {
					let json: Record< string, unknown > | undefined;
					try {
						json = raw ? JSON.parse( raw ) : undefined;
					} catch {
						json = undefined;
					}
					resolve( { status: response.statusCode ?? 0, json } );
				} );
			}
		);
		req.on( 'error', reject );
		if ( payload ) {
			req.write( payload );
		}
		req.end();
	} );
}

async function pairDevice(): Promise< { token: string; deviceId: string } > {
	const { code } = await createPairingCode();
	const reply = await request( {
		method: 'POST',
		path: '/api/remote/pair',
		body: { code, deviceName: 'Test phone', platform: 'ios' },
	} );
	return reply.json as { token: string; deviceId: string };
}

describe( 'remote mode', () => {
	it( 'refuses to listen on the network without remote mode', async () => {
		await expect( startLocalServer( { ...baseOptions, host: '0.0.0.0' } ) ).rejects.toThrow(
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

	it( 'rejects a pairing request with missing fields', async () => {
		const reply = await request( {
			method: 'POST',
			path: '/api/remote/pair',
			body: { code: 'ABCDEFGH2345' },
		} );
		expect( reply.status ).toBe( 400 );
	} );

	it( 'pairs a device and lets its token in', async () => {
		const { token } = await pairDevice();
		expect( ( await request( { path: '/api/health', token } ) ).status ).toBe( 200 );
		expect( ( await request( { path: '/api/runs/active', token } ) ).status ).toBe( 200 );
	} );

	it( 'answers 401 without a valid token', async () => {
		expect( ( await request( { path: '/api/health' } ) ).status ).toBe( 401 );
		expect( ( await request( { path: '/api/health', token: 'nope' } ) ).status ).toBe( 401 );
	} );

	it( 'answers 403 for every registered route outside the allowlist', async () => {
		const { token } = await pairDevice();
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
		const { token } = await pairDevice();
		expect( ( await request( { path: '/api/no-such-route', token } ) ).status ).toBe( 403 );
	} );

	it( 'rejects requests that come from a web page', async () => {
		const { token } = await pairDevice();
		const reply = await request( { path: '/api/health', token, origin: 'http://evil.example' } );
		expect( reply.status ).toBe( 403 );
	} );

	it( 'accepts text messages only', async () => {
		const { token } = await pairDevice();
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
		const { token } = await pairDevice();
		const reply = await request( {
			method: 'DELETE',
			path: '/api/remote/devices/current',
			token,
		} );
		expect( reply.status ).toBe( 204 );
		expect( ( await request( { path: '/api/health', token } ) ).status ).toBe( 401 );
	} );

	it( 'does not serve the sign-in callback page', async () => {
		expect( ( await request( { path: '/auth/callback' } ) ).status ).toBe( 404 );
	} );
} );
