import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOKENS_SOURCE_HASH, tokens } from './tokens.generated';

const tokensCssPath = fileURLToPath(
	new URL( '../../../ui/src/lib/theme/tokens.css', import.meta.url )
);

describe( 'generated tokens', () => {
	it( 'are generated from the current tokens.css', () => {
		const currentHash = createHash( 'sha256' )
			.update( readFileSync( tokensCssPath, 'utf8' ) )
			.digest( 'hex' );

		// If this fails, tokens.css changed. Run `npm run tokens` in apps/mobile.
		expect( TOKENS_SOURCE_HASH ).toBe( currentHash );
	} );

	it( 'hold a six-digit hex color for every name, scheme and surface', () => {
		for ( const scheme of [ tokens.light, tokens.dark ] ) {
			for ( const surface of [ scheme.base, scheme.floating ] ) {
				for ( const value of Object.values( surface ) ) {
					expect( value ).toMatch( /^#[0-9a-f]{6}$/ );
				}
			}
		}
	} );

	it( 'keep Blueberry as the accent in light mode', () => {
		expect( tokens.light.base.accent ).toBe( '#3858e9' );
	} );
} );
