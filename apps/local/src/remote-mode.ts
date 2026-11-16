import {
	authenticateDeviceToken,
	getRemoteInstanceId,
	redeemPairingCode,
	REMOTE_PROTOCOL_VERSION,
	revokeRemoteDevice,
	type RemoteDevice,
} from '@studio/common/lib/remote-access';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Express, NextFunction, Request, Response, Router } from 'express';

// Remote mode: what a paired phone may reach on the local server. Everything
// here is default-deny, so a route added to the server later stays blocked
// until someone adds it to the list on purpose.

// The only event channels a phone receives: agent output and site status.
export const REMOTE_EVENT_CHANNELS: ReadonlySet< string > = new Set( [ 'agent', 'site-event' ] );

// Paths are relative to the `/api` router.
const REMOTE_ALLOWED_ROUTES: ReadonlyArray< { method: string; pattern: RegExp } > = [
	{ method: 'POST', pattern: /^\/remote\/pair$/ },
	{ method: 'DELETE', pattern: /^\/remote\/devices\/current$/ },
	{ method: 'GET', pattern: /^\/health$/ },
	{ method: 'GET', pattern: /^\/sites$/ },
	{ method: 'GET', pattern: /^\/sessions$/ },
	{ method: 'POST', pattern: /^\/sessions$/ },
	{ method: 'GET', pattern: /^\/sessions\/[^/]+$/ },
	{ method: 'POST', pattern: /^\/sessions\/[^/]+\/messages$/ },
	{ method: 'GET', pattern: /^\/runs\/active$/ },
	{ method: 'POST', pattern: /^\/runs\/[^/]+\/interrupt$/ },
	{ method: 'POST', pattern: /^\/runs\/[^/]+\/answer$/ },
	{ method: 'GET', pattern: /^\/events$/ },
];

export function isRemoteRouteAllowed( method: string, path: string ): boolean {
	return REMOTE_ALLOWED_ROUTES.some(
		( route ) => route.method === method.toUpperCase() && route.pattern.test( path )
	);
}

const REMOTE_PAIR_PATH = '/remote/pair';

export interface RemoteModeInfo {
	// Shown on the phone, usually the computer's name.
	label: string;
	studioVersion: string;
}

function hasAttachments( body: unknown ): boolean {
	if ( typeof body !== 'object' || body === null ) {
		return false;
	}
	const { images, files, visualAnnotations } = body as Record< string, unknown >;
	return [ images, files, visualAnnotations ].some(
		( value ) => Array.isArray( value ) && value.length > 0
	);
}

// Mounted on the `/api` router ahead of every route: allowlist first, then the
// device token. Pairing is the one allowed route that needs no token.
export function createRemoteApiGuard() {
	return ( req: Request, res: Response, next: NextFunction ) => {
		if ( ! isRemoteRouteAllowed( req.method, req.path ) ) {
			res.status( 403 ).json( { error: 'Not available in remote mode' } );
			return;
		}
		if ( req.method === 'POST' && req.path === REMOTE_PAIR_PATH ) {
			next();
			return;
		}
		const header = req.headers.authorization ?? '';
		const token = header.startsWith( 'Bearer ' ) ? header.slice( 'Bearer '.length ) : '';
		authenticateDeviceToken( token )
			.then( ( device ) => {
				if ( ! device ) {
					res.status( 401 ).json( { error: 'Device is not paired' } );
					return;
				}
				if (
					req.method === 'POST' &&
					/\/messages$/.test( req.path ) &&
					hasAttachments( req.body )
				) {
					res.status( 400 ).json( { error: 'Attachments are not available in remote mode' } );
					return;
				}
				res.locals.remoteDevice = device;
				next();
			} )
			.catch( next );
	};
}

const pairBodySchema = z.object( {
	code: z.string().min( 1 ).max( 64 ),
	deviceName: z.string().trim().min( 1 ).max( 80 ),
	platform: z.enum( [ 'ios', 'android' ] ),
} );

export function registerRemoteRoutes( app: Express, api: Router, info: RemoteModeInfo ): void {
	// Read before pairing, so the phone can check which computer answers and
	// whether the two speak the same protocol.
	app.get( '/.well-known/studio/remote', ( _req: Request, res: Response, next: NextFunction ) => {
		getRemoteInstanceId()
			.then( ( instanceId ) => {
				res.json( {
					instanceId,
					label: info.label,
					protocolVersion: REMOTE_PROTOCOL_VERSION,
					studioVersion: info.studioVersion,
				} );
			} )
			.catch( next );
	} );

	api.post(
		REMOTE_PAIR_PATH,
		rateLimit( { windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false } ),
		( req: Request, res: Response, next: NextFunction ) => {
			const parsed = pairBodySchema.safeParse( req.body );
			if ( ! parsed.success ) {
				res.status( 400 ).json( { error: 'code, deviceName and platform are required' } );
				return;
			}
			redeemPairingCode( parsed.data )
				.then( ( paired ) => {
					if ( ! paired ) {
						res.status( 401 ).json( { error: 'Pairing code is not valid' } );
						return;
					}
					res.json( paired );
				} )
				.catch( next );
		}
	);

	api.delete( '/remote/devices/current', ( _req: Request, res: Response, next: NextFunction ) => {
		const device = res.locals.remoteDevice as RemoteDevice;
		revokeRemoteDevice( device.id )
			.then( () => res.sendStatus( 204 ) )
			.catch( next );
	} );
}
