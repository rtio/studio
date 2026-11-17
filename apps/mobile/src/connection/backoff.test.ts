import { describe, expect, it } from 'vitest';
import { backoffDelay } from './backoff';

describe( 'backoffDelay', () => {
	it( 'starts at one second and doubles', () => {
		expect( [ 0, 1, 2, 3, 4 ].map( backoffDelay ) ).toEqual( [
			1_000, 2_000, 4_000, 8_000, 16_000,
		] );
	} );

	it( 'never waits longer than thirty seconds', () => {
		expect( backoffDelay( 5 ) ).toBe( 30_000 );
		expect( backoffDelay( 50 ) ).toBe( 30_000 );
	} );
} );
