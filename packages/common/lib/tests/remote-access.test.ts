import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	authenticateDeviceToken,
	createPairingCode,
	DEVICE_TOKEN_TTL_MS,
	formatPairingCode,
	getRemoteInstanceId,
	listRemoteDevices,
	PAIRING_CODE_TTL_MS,
	PAIRING_MAX_FAILED_ATTEMPTS,
	readRemoteAccess,
	RemoteAccessVersionMismatchError,
	redeemPairingCode,
	revokeRemoteDevice,
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

const phone = { deviceName: "Sam's iPhone", platform: 'ios' as const };

describe( 'pairing codes', () => {
	it( 'mints a 12-character code from the unambiguous alphabet', async () => {
		const { code, expiresAt } = await createPairingCode( 1_000 );
		expect( code ).toMatch( /^[0-9A-HJKMNP-TV-Z]{12}$/ );
		expect( expiresAt ).toBe( 1_000 + PAIRING_CODE_TTL_MS );
	} );

	it( 'never stores the code itself', async () => {
		const { code } = await createPairingCode();
		expect( readFileSync( storePath(), 'utf8' ) ).not.toContain( code );
	} );

	it( 'redeems a code once and returns a device token', async () => {
		const { code } = await createPairingCode( 1_000 );
		const paired = await redeemPairingCode( { code, ...phone }, 2_000 );
		expect( paired?.token ).toMatch( /^[A-Za-z0-9_-]{43}$/ );
		expect( paired?.deviceId ).toMatch( /^[0-9a-f-]{36}$/ );
		expect( await redeemPairingCode( { code, ...phone }, 3_000 ) ).toBeNull();
	} );

	it( 'accepts the code as people type it: lower case, with dashes and spaces', async () => {
		const { code } = await createPairingCode();
		const typed = formatPairingCode( code ).toLowerCase().replace( '-', ' - ' );
		expect( await redeemPairingCode( { code: typed, ...phone } ) ).not.toBeNull();
	} );

	it( 'rejects an expired code', async () => {
		const { code } = await createPairingCode( 1_000 );
		const late = 1_000 + PAIRING_CODE_TTL_MS;
		expect( await redeemPairingCode( { code, ...phone }, late ) ).toBeNull();
	} );

	it( 'invalidates the code after too many wrong attempts', async () => {
		const { code } = await createPairingCode();
		for ( let attempt = 0; attempt < PAIRING_MAX_FAILED_ATTEMPTS; attempt += 1 ) {
			expect( await redeemPairingCode( { code: 'WRONGWRONGWR', ...phone } ) ).toBeNull();
		}
		expect( await redeemPairingCode( { code, ...phone } ) ).toBeNull();
	} );

	it( 'formats a code in groups of four', () => {
		expect( formatPairingCode( 'ABCDEFGH2345' ) ).toBe( 'ABCD-EFGH-2345' );
	} );
} );

describe( 'device tokens', () => {
	async function pair( now = 1_000 ) {
		const { code } = await createPairingCode( now );
		const paired = await redeemPairingCode( { code, ...phone }, now );
		if ( ! paired ) {
			throw new Error( 'pairing failed' );
		}
		return paired;
	}

	it( 'authenticates the token it issued and no other', async () => {
		const { token, deviceId } = await pair();
		expect( ( await authenticateDeviceToken( token, 2_000 ) )?.id ).toBe( deviceId );
		expect( await authenticateDeviceToken( 'not-the-token', 2_000 ) ).toBeNull();
		expect( await authenticateDeviceToken( '', 2_000 ) ).toBeNull();
	} );

	it( 'never stores the token itself', async () => {
		const { token } = await pair();
		expect( readFileSync( storePath(), 'utf8' ) ).not.toContain( token );
	} );

	it( 'rejects a token after 30 days', async () => {
		const { token } = await pair( 1_000 );
		expect( await authenticateDeviceToken( token, 1_000 + DEVICE_TOKEN_TTL_MS ) ).toBeNull();
	} );

	it( 'records when the device was last seen', async () => {
		const { token } = await pair( 1_000 );
		await authenticateDeviceToken( token, 1_000 + 5 * 60 * 1000 );
		const [ device ] = await listRemoteDevices( 1_000 + 5 * 60 * 1000 );
		expect( device.lastSeenAt ).toBe( 1_000 + 5 * 60 * 1000 );
	} );

	it( 'lists devices without their token hash', async () => {
		await pair();
		const [ device ] = await listRemoteDevices( 2_000 );
		expect( device ).toMatchObject( { name: "Sam's iPhone", platform: 'ios' } );
		expect( device ).not.toHaveProperty( 'tokenHash' );
	} );

	it( 'revokes a device at once', async () => {
		const { token, deviceId } = await pair();
		expect( await revokeRemoteDevice( deviceId ) ).toBe( true );
		expect( await authenticateDeviceToken( token, 2_000 ) ).toBeNull();
		expect( await revokeRemoteDevice( deviceId ) ).toBe( false );
	} );
} );
