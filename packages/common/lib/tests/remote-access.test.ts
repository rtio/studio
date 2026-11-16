import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getRemoteInstanceId,
	readRemoteAccess,
	RemoteAccessVersionMismatchError,
	updateRemoteAccess,
} from '../remote-access';

let configDir: string;
const storePath = () => path.join( configDir, 'remote.json' );

beforeEach( () => {
	configDir = mkdtempSync( path.join( os.tmpdir(), 'studio-remote-access-' ) );
	process.env.DEV_CONFIG_DIR = configDir;
} );

afterEach( () => {
	delete process.env.DEV_CONFIG_DIR;
	rmSync( configDir, { recursive: true, force: true } );
} );

describe( 'remote access store', () => {
	it( 'starts empty when there is no file', async () => {
		const state = await readRemoteAccess();
		expect( state.devices ).toEqual( [] );
		expect( state.pairingCodes ).toEqual( [] );
		expect( existsSync( storePath() ) ).toBe( false );
	} );

	it( 'keeps one instance id across calls', async () => {
		const first = await getRemoteInstanceId();
		const second = await getRemoteInstanceId();
		expect( first ).toMatch( /^[0-9a-f-]{36}$/ );
		expect( second ).toBe( first );
	} );

	it( 'persists what a mutation changes and returns its result', async () => {
		const result = await updateRemoteAccess( ( state ) => {
			state.server = { url: 'http://192.168.1.20:8082', pid: 123, startedAt: 1 };
			return 'done';
		} );
		expect( result ).toBe( 'done' );
		expect( JSON.parse( readFileSync( storePath(), 'utf8' ) ).server.pid ).toBe( 123 );
	} );

	it( 'treats a corrupt file as empty, which unpairs every device', async () => {
		writeFileSync( storePath(), '{ not json' );
		expect( ( await readRemoteAccess() ).devices ).toEqual( [] );
	} );

	it( 'throws when a newer build wrote the file', async () => {
		writeFileSync(
			storePath(),
			JSON.stringify( { version: 2, instanceId: 'x', pairingCodes: [], devices: [] } )
		);
		await expect( readRemoteAccess() ).rejects.toBeInstanceOf( RemoteAccessVersionMismatchError );
	} );

	it( 'leaves a newer build file alone when updating', async () => {
		const original = JSON.stringify( {
			version: 2,
			instanceId: 'x',
			pairingCodes: [],
			devices: [],
		} );
		writeFileSync( storePath(), original );
		await expect( updateRemoteAccess( () => undefined ) ).rejects.toBeInstanceOf(
			RemoteAccessVersionMismatchError
		);
		expect( readFileSync( storePath(), 'utf8' ) ).toBe( original );
	} );

	it( 'keeps fields a newer build added', async () => {
		writeFileSync(
			storePath(),
			JSON.stringify( {
				version: 1,
				instanceId: 'x',
				pairingCodes: [],
				futureField: 1,
				devices: [
					{
						id: 'd1',
						name: 'Phone',
						platform: 'ios',
						tokenHash: 'hash',
						pairedAt: 1,
						lastSeenAt: 2,
						expiresAt: 3,
						futureDeviceField: true,
					},
				],
			} )
		);
		await updateRemoteAccess( () => undefined );
		const saved = JSON.parse( readFileSync( storePath(), 'utf8' ) );
		expect( saved.futureField ).toBe( 1 );
		expect( saved.devices[ 0 ].futureDeviceField ).toBe( true );
	} );

	it( 'reads valid JSON with the wrong shape as empty', async () => {
		writeFileSync( storePath(), JSON.stringify( { version: 1 } ) );
		expect( ( await readRemoteAccess() ).devices ).toEqual( [] );
	} );

	it.skipIf( process.platform === 'win32' )( 'writes the file with mode 0600', async () => {
		await updateRemoteAccess( () => undefined );
		expect( statSync( storePath() ).mode & 0o777 ).toBe( 0o600 );
	} );

	it( 'serialises concurrent updates', async () => {
		await updateRemoteAccess( ( state ) => {
			state.server = { url: 'http://x', pid: 1, startedAt: 0 };
		} );
		await Promise.all(
			Array.from( { length: 10 }, () =>
				updateRemoteAccess( ( state ) => {
					if ( state.server ) {
						state.server.startedAt += 1;
					}
				} )
			)
		);
		expect( ( await readRemoteAccess() ).server?.startedAt ).toBe( 10 );
	} );

	it( 'writes nothing and releases the lock when a mutation throws', async () => {
		await updateRemoteAccess( () => undefined );
		const before = readFileSync( storePath(), 'utf8' );
		await expect(
			updateRemoteAccess( () => {
				throw new Error( 'boom' );
			} )
		).rejects.toThrow( 'boom' );
		expect( readFileSync( storePath(), 'utf8' ) ).toBe( before );
		await expect( updateRemoteAccess( () => 'ok' ) ).resolves.toBe( 'ok' );
	} );

	it( 'does not write an invalid state', async () => {
		await updateRemoteAccess( () => undefined );
		const before = readFileSync( storePath(), 'utf8' );
		await expect(
			updateRemoteAccess( ( state ) => {
				state.devices.push( {
					id: 'd1',
					name: 'Phone',
					platform: 'ios',
					tokenHash: 'hash',
					pairedAt: 1,
					lastSeenAt: 2,
					expiresAt: NaN,
				} );
			} )
		).rejects.toThrow();
		expect( readFileSync( storePath(), 'utf8' ) ).toBe( before );
	} );

	it( 'does not rewrite the file when reading the instance id', async () => {
		const first = await getRemoteInstanceId();
		const content = readFileSync( storePath(), 'utf8' );
		const mtimeMs = statSync( storePath() ).mtimeMs;
		const second = await getRemoteInstanceId();
		expect( second ).toBe( first );
		expect( readFileSync( storePath(), 'utf8' ) ).toBe( content );
		expect( statSync( storePath() ).mtimeMs ).toBe( mtimeMs );
	} );
} );
