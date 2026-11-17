import { describe, expect, it } from 'vitest';
import { studioThemes } from '../../theme/theme';
import { isOpenableLink } from './links';
import { markdownStyle } from './markdown-style';

// The elements the markdown library draws text or lines for.
const DRAWN = [
	'paragraph',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'blockquote',
	'list',
	'codeBlock',
	'link',
	'strong',
	'em',
	'strikethrough',
	'underline',
	'code',
	'thematicBreak',
	'table',
	'math',
	'inlineMath',
	'spoiler',
	'highlight',
] as const;

describe( 'markdownStyle', () => {
	it.each( [ 'light', 'dark' ] as const )(
		'gives every drawn element a color from the %s theme',
		( scheme ) => {
			const { colors } = studioThemes[ scheme ];
			const style = markdownStyle( colors, 'Menlo' );
			const themeColors = new Set( Object.values( colors ) );

			for ( const element of DRAWN ) {
				const color = ( style[ element ] as { color?: string } | undefined )?.color;
				expect( color, element ).toBeDefined();
				expect( themeColors.has( color as string ), element ).toBe( true );
			}
			for ( const value of Object.values( style ).flatMap( ( part ) =>
				Object.entries( part ?? {} )
			) ) {
				const [ key, setting ] = value;
				if ( /color$/i.test( key ) ) {
					expect( themeColors.has( setting as string ), key ).toBe( true );
				}
			}
		}
	);
} );

describe( 'isOpenableLink', () => {
	it( 'opens web links', () => {
		expect( isOpenableLink( 'https://wordpress.org/documentation/' ) ).toBe( true );
		expect( isOpenableLink( 'http://example.com' ) ).toBe( true );
	} );

	it( 'does not open other schemes', () => {
		for ( const url of [
			'file:///etc/hosts',
			'tel:+15555550100',
			'javascript:alert(1)',
			'studio-remote://pair?url=http%3A%2F%2Fexample.com&code=X&id=Y',
			'not a link',
		] ) {
			expect( isOpenableLink( url ), url ).toBe( false );
		}
	} );

	it( "does not open the computer's own loopback address", () => {
		for ( const url of [
			'http://localhost:8881/wp-admin/',
			'http://my-site.localhost/',
			'http://127.0.0.1:8881',
			'http://127.1/',
			'http://[::1]:8881',
			'http://localhost.:8881',
			'http://0.0.0.0:8881',
			'http://0:8881',
			'http://[::]:8881',
			'http://[::ffff:127.0.0.1]:8881',
		] ) {
			expect( isOpenableLink( url ), url ).toBe( false );
		}
	} );
} );
