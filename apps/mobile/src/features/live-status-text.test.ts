import { describe, expect, it } from 'vitest';
import { liveStatusColor, liveStatusText } from './live-status-text';
import type { LiveStatus } from '../data/live-status';

describe( 'liveStatusText', () => {
	it( 'names the computer while connecting and when connected', () => {
		expect( liveStatusText( 'connecting', 'Work laptop' ) ).toBe( 'Connecting to Work laptop…' );
		expect( liveStatusText( 'live', 'Work laptop' ) ).toBe( 'Connected to Work laptop' );
	} );

	it( 'has a different line for each problem', () => {
		expect( liveStatusText( 'reconnecting', 'Work laptop' ) ).not.toBe(
			liveStatusText( 'wrong-computer', 'Work laptop' )
		);
	} );
} );

describe( 'liveStatusColor', () => {
	it( 'is green only when the stream is live', () => {
		const statuses: LiveStatus[] = [
			'off',
			'connecting',
			'live',
			'reconnecting',
			'wrong-computer',
		];

		expect(
			statuses.filter( ( status ) => liveStatusColor( status ) === 'statusRunning' )
		).toEqual( [ 'live' ] );
	} );
} );
