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
