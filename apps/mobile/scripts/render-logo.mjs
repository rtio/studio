// Draws the Studio logo into the images the phone app's icon and splash
// screen need, from the desktop app's icon (the W mark in
// apps/studio/assets/studio-app-icon.icon). iOS uses that icon file itself.
//
// Run it from apps/mobile with `npm run logo` after the desktop icon changes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const appRoot = path.resolve( import.meta.dirname, '..' );
const iconSvg = readFileSync(
	path.resolve( appRoot, '../studio/assets/studio-app-icon.icon/Assets/light.svg' ),
	'utf8'
);
const mark = /<path d="([^"]+)"/.exec( iconSvg )?.[ 1 ];
if ( ! mark ) {
	throw new Error( 'No path in the desktop icon.' );
}

// In the desktop icon the mark is a circle 760 wide, at 132 in a 1024 square.
const MARK_BOX = '132 132 760 760';

// `share`: how much of the image's width the mark takes.
const IMAGES = [
	// Android shows the middle two thirds of an adaptive icon's layers, cut to
	// the launcher's shape. The mark takes about three quarters of that.
	{ file: 'android-icon-foreground.png', size: 1024, share: 0.5, color: '#222222' },
	// For themed icons: Android colors it in and uses only its shape.
	{ file: 'android-icon-monochrome.png', size: 1024, share: 0.5, color: '#000000' },
	// The splash screen draws the mark 100 points wide, in the desktop icon's
	// light and dark colors.
	{ file: 'splash-icon-light.png', size: 512, share: 1, color: '#222222' },
	{ file: 'splash-icon-dark.png', size: 512, share: 1, color: '#EEEEEE' },
];

const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	for ( const { file, size, share, color } of IMAGES ) {
		const width = Math.round( size * share );
		const offset = Math.round( ( size - width ) / 2 );
		await page.setViewportSize( { width: size, height: size } );
		await page.setContent(
			`<!doctype html><html><body style="margin:0">
			<svg width="${ size }" height="${ size }" xmlns="http://www.w3.org/2000/svg">
				<svg x="${ offset }" y="${ offset }" width="${ width }" height="${ width }" viewBox="${ MARK_BOX }">
					<path d="${ mark }" fill-rule="evenodd" clip-rule="evenodd" fill="${ color }"/>
				</svg>
			</svg></body></html>`
		);
		await page.screenshot( {
			path: path.resolve( appRoot, 'assets', file ),
			omitBackground: true,
			clip: { x: 0, y: 0, width: size, height: size },
		} );
		console.log( `Wrote assets/${ file }` );
	}
} finally {
	await browser.close();
}
