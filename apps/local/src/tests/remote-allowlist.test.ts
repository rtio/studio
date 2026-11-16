import { describe, expect, it } from 'vitest';
import { isRemoteRouteAllowed, REMOTE_EVENT_CHANNELS } from '../remote-mode';

describe( 'isRemoteRouteAllowed', () => {
	it.each( [
		[ 'POST', '/remote/pair' ],
		[ 'DELETE', '/remote/devices/current' ],
		[ 'GET', '/health' ],
		[ 'GET', '/sites' ],
		[ 'GET', '/sessions' ],
		[ 'POST', '/sessions' ],
		[ 'GET', '/sessions/abc-123' ],
		[ 'POST', '/sessions/abc-123/messages' ],
		[ 'GET', '/runs/active' ],
		[ 'POST', '/runs/run-1/interrupt' ],
		[ 'POST', '/runs/run-1/answer' ],
		[ 'GET', '/events' ],
	] )( 'allows %s %s', ( method, path ) => {
		expect( isRemoteRouteAllowed( method, path ) ).toBe( true );
	} );

	it.each( [
		[ 'POST', '/sites' ],
		[ 'DELETE', '/sites/site-1' ],
		[ 'POST', '/sites/site-1/start' ],
		[ 'POST', '/sites/site-1/stop' ],
		[ 'POST', '/sites/sort-order' ],
		[ 'GET', '/sites/site-1/file-tree' ],
		[ 'DELETE', '/sessions/abc-123' ],
		[ 'PATCH', '/sessions/abc-123' ],
		[ 'POST', '/sessions/abc-123/model' ],
		[ 'POST', '/sessions/abc-123/provider' ],
		[ 'POST', '/sessions/abc-123/environment' ],
		[ 'GET', '/auth/user' ],
		[ 'POST', '/auth/login' ],
		[ 'GET', '/ai-settings' ],
		[ 'GET', '/user-preferences' ],
		[ 'GET', '/quota' ],
		[ 'GET', '/snapshots' ],
		[ 'GET', '/no-such-route' ],
		[ 'GET', '/sessions/abc-123/messages' ],
		[ 'GET', '/health/extra' ],
	] )( 'blocks %s %s', ( method, path ) => {
		expect( isRemoteRouteAllowed( method, path ) ).toBe( false );
	} );
} );

describe( 'REMOTE_EVENT_CHANNELS', () => {
	it( 'passes agent output and site status only', () => {
		expect( [ ...REMOTE_EVENT_CHANNELS ].sort() ).toEqual( [ 'agent', 'site-event' ] );
	} );
} );
