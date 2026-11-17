import { describe, expect, it } from 'vitest';
import {
	normalizeBaseUrl,
	normalizePairingCode,
	pairingLinkFromParams,
	pairingLinkFromParts,
	parsePairingUrl,
} from './pairing-link';

describe( 'normalizeBaseUrl', () => {
	it( 'adds http to a typed host and port', () => {
		expect( normalizeBaseUrl( '192.168.1.20:8082' ) ).toBe( 'http://192.168.1.20:8082' );
	} );

	it( 'keeps https, removes a trailing slash and surrounding spaces', () => {
		expect( normalizeBaseUrl( '  https://Studio.Example:8443/ ' ) ).toBe(
			'https://studio.example:8443'
		);
	} );

	it( 'keeps an IPv6 host in brackets', () => {
		expect( normalizeBaseUrl( 'http://[fd7a:115c::1]:8082' ) ).toBe( 'http://[fd7a:115c::1]:8082' );
	} );

	it( 'rejects an empty value, another scheme, a path and a user name', () => {
		expect( normalizeBaseUrl( '   ' ) ).toBeNull();
		expect( normalizeBaseUrl( 'ftp://192.168.1.20' ) ).toBeNull();
		expect( normalizeBaseUrl( 'http://192.168.1.20:8082/api' ) ).toBeNull();
		expect( normalizeBaseUrl( 'http://someone@192.168.1.20' ) ).toBeNull();
	} );

	it( 'rejects a query, a fragment and a backslash', () => {
		expect( normalizeBaseUrl( 'http://192.168.1.20:8082?next=1' ) ).toBeNull();
		expect( normalizeBaseUrl( 'http://192.168.1.20:8082#top' ) ).toBeNull();
		expect( normalizeBaseUrl( 'http://192.168.1.20\\example.com' ) ).toBeNull();
	} );
} );

describe( 'normalizePairingCode', () => {
	it( 'removes dashes and spaces and upper-cases the code', () => {
		expect( normalizePairingCode( ' k7qm-2xva 9d3h ' ) ).toBe( 'K7QM2XVA9D3H' );
	} );

	it( 'rejects a code of the wrong length or with other characters', () => {
		expect( normalizePairingCode( 'K7QM-2XVA' ) ).toBeNull();
		expect( normalizePairingCode( 'K7QM-2XVA-9D3H-AAAA' ) ).toBeNull();
		expect( normalizePairingCode( 'K7QM-2XVA-9D3!' ) ).toBeNull();
	} );
} );

describe( 'pairingLinkFromParts', () => {
	it( 'builds a link without an instance id from typed fields', () => {
		expect( pairingLinkFromParts( { url: '10.0.0.5:8082', code: 'K7QM-2XVA-9D3H' } ) ).toEqual( {
			baseUrl: 'http://10.0.0.5:8082',
			code: 'K7QM2XVA9D3H',
		} );
	} );

	it( 'returns null when the address or the code is missing or wrong', () => {
		expect( pairingLinkFromParts( { url: '10.0.0.5:8082' } ) ).toBeNull();
		expect( pairingLinkFromParts( { code: 'K7QM-2XVA-9D3H' } ) ).toBeNull();
		expect( pairingLinkFromParts( { url: 'not a url', code: 'K7QM-2XVA-9D3H' } ) ).toBeNull();
	} );
} );

describe( 'pairingLinkFromParams', () => {
	it( 'builds a link from the three values of a pairing link', () => {
		expect(
			pairingLinkFromParams( {
				url: 'http://192.168.1.20:8082',
				code: 'K7QM2XVA9D3H',
				id: 'instance-1',
			} )
		).toEqual( {
			baseUrl: 'http://192.168.1.20:8082',
			code: 'K7QM2XVA9D3H',
			instanceId: 'instance-1',
		} );
	} );

	it( 'returns null without the id of the computer', () => {
		expect(
			pairingLinkFromParams( { url: 'http://192.168.1.20:8082', code: 'K7QM2XVA9D3H' } )
		).toBeNull();
		expect(
			pairingLinkFromParams( { url: 'http://192.168.1.20:8082', code: 'K7QM2XVA9D3H', id: '' } )
		).toBeNull();
	} );

	it( 'returns null when a value came more than once, which a router gives as a list', () => {
		expect(
			pairingLinkFromParams( {
				url: [ 'http://192.168.1.20:8082', 'http://10.0.0.9:8082' ],
				code: 'K7QM2XVA9D3H',
				id: 'instance-1',
			} )
		).toBeNull();
	} );
} );

describe( 'parsePairingUrl', () => {
	it( 'reads the URL that studio remote puts in the QR code', () => {
		const params = new URLSearchParams( {
			url: 'http://192.168.1.20:8082',
			code: 'K7QM2XVA9D3H',
			id: 'instance-1',
		} );

		expect( parsePairingUrl( `studio-remote://pair?${ params.toString() }` ) ).toEqual( {
			baseUrl: 'http://192.168.1.20:8082',
			code: 'K7QM2XVA9D3H',
			instanceId: 'instance-1',
		} );
	} );

	it( 'returns null for a QR code that is not a Studio pairing code', () => {
		expect( parsePairingUrl( 'https://wordpress.com' ) ).toBeNull();
		expect(
			parsePairingUrl( 'studio-remote://other?url=http%3A%2F%2F10.0.0.5&code=K7QM2XVA9D3H' )
		).toBeNull();
	} );

	it( 'returns null when a value is missing or badly encoded', () => {
		expect( parsePairingUrl( 'studio-remote://pair?code=K7QM2XVA9D3H&id=instance-1' ) ).toBeNull();
		expect(
			parsePairingUrl( 'studio-remote://pair?url=http%3A%2F%2F10.0.0.5%3A8082&code=K7QM2XVA9D3H' )
		).toBeNull();
		expect( parsePairingUrl( 'studio-remote://pair?url=%E0%A4%A&code=K7QM2XVA9D3H' ) ).toBeNull();
	} );
} );
