import { describe, expect, it } from 'vitest';
import { formatElapsed } from './elapsed';

describe( 'formatElapsed', () => {
	it( 'shows minutes and seconds, and hours once there are any', () => {
		expect( formatElapsed( 42_000 ) ).toBe( '0:42' );
		expect( formatElapsed( 725_500 ) ).toBe( '12:05' );
		expect( formatElapsed( 3_723_000 ) ).toBe( '1:02:03' );
	} );

	it( 'shows a duration below zero as zero', () => {
		expect( formatElapsed( -5000 ) ).toBe( '0:00' );
	} );
} );
