import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { readFile, writeFile } from 'atomically';
import { z } from 'zod';
import { LOCKFILE_STALE_TIME, LOCKFILE_WAIT_TIME, REMOTE_ACCESS_LOCKFILE_NAME } from '../constants';
import { lockFileAsync, unlockFileAsync } from './lockfile';
import { getConfigDirectory, getRemoteAccessConfigPath } from './well-known-paths';

// What `studio remote` and paired phones agree on. Bump it when a change to the
// remote routes or their payloads would break a phone built for the old ones.
export const REMOTE_PROTOCOL_VERSION = 1;

const REMOTE_ACCESS_VERSION = 1;

const pairingCodeSchema = z.object( {
	codeHash: z.string(),
	expiresAt: z.number(),
	failedAttempts: z.number(),
} );

const storedDeviceSchema = z.object( {
	id: z.string(),
	name: z.string(),
	platform: z.string(),
	tokenHash: z.string(),
	pairedAt: z.number(),
	lastSeenAt: z.number(),
	expiresAt: z.number(),
} );

const serverInfoSchema = z.object( {
	url: z.string(),
	pid: z.number(),
	startedAt: z.number(),
} );

const remoteAccessSchema = z.object( {
	version: z.literal( REMOTE_ACCESS_VERSION ),
	instanceId: z.string(),
	pairingCodes: z.array( pairingCodeSchema ),
	devices: z.array( storedDeviceSchema ),
	server: serverInfoSchema.optional(),
} );

export type RemoteAccessState = z.infer< typeof remoteAccessSchema >;
export type RemoteServerInfo = z.infer< typeof serverInfoSchema >;

function emptyState(): RemoteAccessState {
	return {
		version: REMOTE_ACCESS_VERSION,
		instanceId: randomUUID(),
		pairingCodes: [],
		devices: [],
	};
}

// A missing or unreadable file reads as empty: no device is paired.
export async function readRemoteAccess(): Promise< RemoteAccessState > {
	const configPath = getRemoteAccessConfigPath();
	if ( ! fs.existsSync( configPath ) ) {
		return emptyState();
	}
	try {
		const content = await readFile( configPath, { encoding: 'utf8' } );
		return remoteAccessSchema.parse( JSON.parse( content ) );
	} catch {
		return emptyState();
	}
}

export async function updateRemoteAccess< T >(
	mutate: ( state: RemoteAccessState ) => T
): Promise< T > {
	const configDir = getConfigDirectory();
	if ( ! fs.existsSync( configDir ) ) {
		fs.mkdirSync( configDir, { recursive: true } );
	}
	const lockPath = path.join( configDir, REMOTE_ACCESS_LOCKFILE_NAME );
	await lockFileAsync( lockPath, { wait: LOCKFILE_WAIT_TIME, stale: LOCKFILE_STALE_TIME } );
	try {
		const state = await readRemoteAccess();
		const result = mutate( state );
		await writeFile( getRemoteAccessConfigPath(), JSON.stringify( state, null, 2 ) + '\n', {
			encoding: 'utf8',
			mode: 0o600,
		} );
		return result;
	} finally {
		await unlockFileAsync( lockPath );
	}
}

// Stable id of this Studio install, so a phone can tell two computers apart.
export function getRemoteInstanceId(): Promise< string > {
	return updateRemoteAccess( ( state ) => state.instanceId );
}
