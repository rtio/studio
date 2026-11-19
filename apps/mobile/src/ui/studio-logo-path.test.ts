import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { STUDIO_LOGO_PATH } from './studio-logo-path';

it( 'draws the mark of the desktop app icon', () => {
	const icon = path.resolve(
		import.meta.dirname,
		'../../../studio/assets/studio-app-icon.icon/Assets'
	);

	for ( const look of [ 'light.svg', 'dark.svg' ] ) {
		expect( readFileSync( path.join( icon, look ), 'utf8' ) ).toContain(
			`d="${ STUDIO_LOGO_PATH }"`
		);
	}
} );
