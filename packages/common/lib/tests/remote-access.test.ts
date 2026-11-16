import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRemoteInstanceId, readRemoteAccess, updateRemoteAccess } from '../remote-access';

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
} );
