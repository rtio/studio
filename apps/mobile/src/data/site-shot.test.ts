import { describe, expect, it } from 'vitest';
import { parseShot, parseStoredShot } from './site-shot';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';

describe( 'parseShot', () => {
	it( 'reads an image and drops the time the computer took it', () => {
		expect( parseShot( { image: JPEG, takenAt: 1000 } ) ).toEqual( { image: JPEG } );
	} );

	it( 'reads why there is no image', () => {
		expect( parseShot( { image: null, reason: 'stopped' } ) ).toEqual( {
			image: null,
			reason: 'stopped',
		} );
		expect( parseShot( { image: null, reason: 'no-browser' } ) ).toEqual( {
			image: null,
			reason: 'no-browser',
		} );
		expect( parseShot( { image: null, reason: 'out-of-paper' } ) ).toEqual( {
			image: null,
			reason: 'failed',
		} );
	} );

	it( 'never takes an address to load', () => {
		for ( const image of [
			'http://192.168.1.2:8881/shot.jpg',
			'file:///etc/hosts',
			'data:text/html;base64,PGgxPg==',
		] ) {
			expect( parseShot( { image } ) ).toEqual( { image: null, reason: 'failed' } );
		}
	} );

	it( 'reads an answer of the wrong shape as a failed shot', () => {
		expect( parseShot( undefined ) ).toEqual( { image: null, reason: 'failed' } );
		expect( parseShot( { error: 'Internal error' } ) ).toEqual( { image: null, reason: 'failed' } );
	} );
} );

describe( 'parseStoredShot', () => {
	it( 'reads the stored image, or none', () => {
		const png = 'data:image/png;base64,iVBORw0K';

		expect( parseStoredShot( { thumbnail: png } ) ).toBe( png );
		expect( parseStoredShot( { thumbnail: null } ) ).toBeNull();
		expect( parseStoredShot( { thumbnail: 'http://192.168.1.2/shot.png' } ) ).toBeNull();
		expect( parseStoredShot( 'nonsense' ) ).toBeNull();
	} );
} );
