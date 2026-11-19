import { describe, expect, it } from 'vitest';
import { formatAge, previewView } from './preview-view';
import type { PreviewInputs } from './preview-view';

const IMAGE = 'data:image/jpeg;base64,/9j/';
const STORED = 'data:image/png;base64,iVBOR';

function inputs( fields: Partial< PreviewInputs > = {} ): PreviewInputs {
	return {
		running: true,
		live: true,
		shot: { isError: false, isFetching: false },
		stored: { isError: false },
		...fields,
	};
}

describe( 'previewView', () => {
	it( 'shows the screenshot of a running site, and the logo while it is taken', () => {
		expect( previewView( inputs() ) ).toEqual( { kind: 'taking' } );
		expect(
			previewView(
				inputs( { shot: { data: { image: IMAGE }, isError: false, isFetching: true } } )
			)
		).toEqual( { kind: 'image', image: IMAGE, stopped: false } );
	} );

	it( 'keeps the last screenshot when a new request fails or the link drops', () => {
		const shot = { data: { image: IMAGE }, isError: true, isFetching: false };

		expect( previewView( inputs( { shot } ) ) ).toMatchObject( { kind: 'image' } );
		expect( previewView( inputs( { shot, live: false } ) ) ).toMatchObject( { kind: 'image' } );
	} );

	it( 'says why there is no screenshot', () => {
		const reason = ( why: 'no-browser' | 'failed', isFetching = false ) =>
			previewView(
				inputs( { shot: { data: { image: null, reason: why }, isError: false, isFetching } } )
			);

		expect( reason( 'no-browser' ) ).toEqual( { kind: 'no-browser' } );
		expect( reason( 'failed' ) ).toEqual( { kind: 'failed' } );
		expect( reason( 'failed', true ) ).toEqual( { kind: 'taking' } );
		expect( previewView( inputs( { shot: { isError: true, isFetching: false } } ) ) ).toEqual( {
			kind: 'failed',
		} );
		expect( previewView( inputs( { live: false } ) ) ).toEqual( { kind: 'offline' } );
	} );

	it( "shows a stopped site's stored screenshot, or says it is stopped", () => {
		const stopped = inputs( { running: false } );

		expect( previewView( stopped ) ).toEqual( { kind: 'taking' } );
		expect( previewView( { ...stopped, stored: { data: STORED, isError: false } } ) ).toEqual( {
			kind: 'image',
			image: STORED,
			stopped: true,
		} );
		expect( previewView( { ...stopped, stored: { data: null, isError: false } } ) ).toEqual( {
			kind: 'stopped',
		} );
		expect( previewView( { ...stopped, stored: { isError: true } } ) ).toEqual( {
			kind: 'stopped',
		} );
		expect( previewView( { ...stopped, live: false } ) ).toEqual( { kind: 'stopped' } );
	} );

	it( 'takes the word of the computer that the site is stopped', () => {
		const view = previewView(
			inputs( {
				shot: { data: { image: null, reason: 'stopped' }, isError: false, isFetching: false },
				stored: { data: STORED, isError: false },
			} )
		);

		expect( view ).toEqual( { kind: 'image', image: STORED, stopped: true } );
	} );
} );

describe( 'formatAge', () => {
	it( 'reads like a clock', () => {
		expect( formatAge( 0 ) ).toBe( '0:00' );
		expect( formatAge( 12_400 ) ).toBe( '0:12' );
		expect( formatAge( 245_000 ) ).toBe( '4:05' );
		expect( formatAge( 3_723_000 ) ).toBe( '1:02:03' );
		expect( formatAge( -500 ) ).toBe( '0:00' );
	} );
} );
