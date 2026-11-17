import { z } from 'zod';
import { createApiClient, HttpError, UnauthorizedError, UnreachableError } from './api-client';
import type { FetchLike } from './api-client';
import type { Connection } from './connection-store';
import type { PairingLink } from './pairing-link';

// The remote protocol this app speaks. `studio remote` reports its own in the
// descriptor, and the two must be equal.
const SUPPORTED_PROTOCOL_VERSION = 1;

export type PairingFailure =
	| 'unreachable'
	| 'not-studio'
	| 'wrong-computer'
	| 'app-too-old'
	| 'studio-too-old'
	| 'code-invalid'
	| 'too-many-attempts'
	| 'failed';

export class PairingError extends Error {
	readonly reason: PairingFailure;

	constructor( reason: PairingFailure ) {
		super( `Pairing failed: ${ reason }` );
		this.name = 'PairingError';
		this.reason = reason;
	}
}

const descriptorSchema = z.object( {
	instanceId: z.string().min( 1 ),
	label: z.string(),
	protocolVersion: z.number().int(),
} );

const pairedSchema = z.object( {
	token: z.string().min( 1 ),
	deviceId: z.string().min( 1 ),
	expiresAt: z.number(),
} );

// The computer accepts a device name of 1 to 80 characters.
const MAX_DEVICE_NAME_LENGTH = 80;

export interface PairingInput {
	link: PairingLink;
	deviceName: string;
	platform: 'ios' | 'android';
	fetch: FetchLike;
}

// Pairs this phone with the computer in `link`. It reads the descriptor first,
// so a wrong computer or a version mismatch is found before the one-time code
// is spent. Throws PairingError with the reason.
export async function pairWithComputer( input: PairingInput ): Promise< Connection > {
	const { link, deviceName, platform, fetch } = input;
	const api = createApiClient( { baseUrl: link.baseUrl, fetch } );

	let descriptorAnswer: unknown;
	try {
		descriptorAnswer = await api.get( '/.well-known/studio/remote' );
	} catch ( error ) {
		throw new PairingError( error instanceof UnreachableError ? 'unreachable' : 'not-studio' );
	}
	const descriptor = descriptorSchema.safeParse( descriptorAnswer );
	if ( ! descriptor.success ) {
		throw new PairingError( 'not-studio' );
	}
	const { instanceId, label, protocolVersion } = descriptor.data;
	if ( link.instanceId && link.instanceId !== instanceId ) {
		throw new PairingError( 'wrong-computer' );
	}
	if ( protocolVersion !== SUPPORTED_PROTOCOL_VERSION ) {
		throw new PairingError(
			protocolVersion > SUPPORTED_PROTOCOL_VERSION ? 'app-too-old' : 'studio-too-old'
		);
	}

	let pairedAnswer: unknown;
	try {
		pairedAnswer = await api.post( '/api/remote/pair', {
			code: link.code,
			deviceName: deviceName.trim().slice( 0, MAX_DEVICE_NAME_LENGTH ) || 'Phone',
			platform,
		} );
	} catch ( error ) {
		if ( error instanceof UnreachableError ) {
			throw new PairingError( 'unreachable' );
		}
		if ( error instanceof UnauthorizedError ) {
			throw new PairingError( 'code-invalid' );
		}
		if ( error instanceof HttpError && error.status === 400 ) {
			throw new PairingError( 'code-invalid' );
		}
		if ( error instanceof HttpError && error.status === 429 ) {
			throw new PairingError( 'too-many-attempts' );
		}
		throw new PairingError( 'failed' );
	}
	const paired = pairedSchema.safeParse( pairedAnswer );
	if ( ! paired.success ) {
		throw new PairingError( 'failed' );
	}

	return {
		baseUrl: link.baseUrl,
		instanceId,
		label,
		token: paired.data.token,
		deviceId: paired.data.deviceId,
		expiresAt: paired.data.expiresAt,
	};
}
