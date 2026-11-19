import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { siteShotKey, storedShotKey } from './query-keys';
import { openSiteShots } from './shot-cache';

const CONNECTION = {
	baseUrl: 'http://127.0.0.1:8099',
	token: 'token',
	deviceId: 'device-1',
	instanceId: 'instance-1',
	label: 'Computer',
	expiresAt: 0,
};

// Lets the query cache run its callbacks.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

describe( 'openSiteShots', () => {
	it( 'takes the shown shot once as the sheet opens, with an older one in the cache', async () => {
		const client = new QueryClient();
		const queryFn = vi.fn( async () => ( { image: 'data:image/jpeg;base64,x' } ) );
		const options = ( enabled: boolean ) => ( {
			queryKey: siteShotKey( CONNECTION, 's1', 'phone' ),
			queryFn,
			staleTime: Infinity,
			enabled,
		} );
		// The closed sheet, and a shot from the last time it was open.
		const sheet = new QueryObserver( client, options( false ) );
		const stop = sheet.subscribe( () => {} );
		await client.fetchQuery( options( true ) );
		queryFn.mockClear();

		openSiteShots( client, CONNECTION, 's1' );
		await settle();
		expect( queryFn ).not.toHaveBeenCalled();

		sheet.setOptions( options( true ) );
		await settle();
		expect( queryFn ).toHaveBeenCalledTimes( 1 );
		stop();
	} );

	it( 'marks the other layout and the stored shot out of date, and no other site', async () => {
		const client = new QueryClient();
		const cached = [
			siteShotKey( CONNECTION, 's1', 'desktop' ),
			storedShotKey( CONNECTION, 's1' ),
			siteShotKey( CONNECTION, 's2', 'phone' ),
		];
		for ( const queryKey of cached ) {
			client.setQueryData( queryKey, 'shot' );
		}

		openSiteShots( client, CONNECTION, 's1' );

		expect( cached.map( ( key ) => client.getQueryState( key )?.isInvalidated ) ).toEqual( [
			true,
			true,
			false,
		] );
	} );
} );
