// Draws a made-up screenshot of a site for the stand-in server
// (fake-remote.mjs): a header in the site's color, a large block whose color
// changes each time the agent changes the site, and gray lines for text. A
// plain PNG, built with Node alone.
import { crc32, deflateSync } from 'node:zlib';

// Page sizes at scale 1: the computer's phone and desktop layouts.
const SIZES = {
	phone: { width: 393, height: 852 },
	desktop: { width: 1280, height: 800 },
};

// A new color for the large block after each change of the site.
const HERO_COLORS = [ '#F4C27A', '#9FD3C7', '#C9B6E4', '#F2A6A6', '#A9C8F2' ];

function rgb( hex ) {
	const value = Number.parseInt( hex.slice( 1 ), 16 );
	return [ ( value >> 16 ) & 255, ( value >> 8 ) & 255, value & 255 ];
}

function chunk( type, data ) {
	const length = Buffer.alloc( 4 );
	length.writeUInt32BE( data.length );
	const body = Buffer.concat( [ Buffer.from( type, 'ascii' ), data ] );
	const crc = Buffer.alloc( 4 );
	crc.writeUInt32BE( crc32( body ) >>> 0 );
	return Buffer.concat( [ length, body, crc ] );
}

function encodePng( width, height, pixels ) {
	const header = Buffer.alloc( 13 );
	header.writeUInt32BE( width, 0 );
	header.writeUInt32BE( height, 4 );
	header[ 8 ] = 8; // bits per channel
	header[ 9 ] = 2; // RGB
	// Each row starts with filter type 0 (none).
	const rows = Buffer.alloc( ( width * 3 + 1 ) * height );
	for ( let y = 0; y < height; y++ ) {
		pixels.copy( rows, y * ( width * 3 + 1 ) + 1, y * width * 3, ( y + 1 ) * width * 3 );
	}
	return Buffer.concat( [
		Buffer.from( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] ),
		chunk( 'IHDR', header ),
		chunk( 'IDAT', deflateSync( rows ) ),
		chunk( 'IEND', Buffer.alloc( 0 ) ),
	] );
}

// `layout`: 'phone' or 'desktop'. `accent`: the site's color. `change`: how
// many times the agent changed the site.
export function drawScreenshot( { layout, accent, change } ) {
	const { width, height } = SIZES[ layout ];
	const pixels = Buffer.alloc( width * height * 3, 255 );
	const fill = ( x, y, w, h, hex ) => {
		const [ r, g, b ] = rgb( hex );
		for ( let row = Math.max( 0, y ); row < Math.min( height, y + h ); row++ ) {
			for ( let col = Math.max( 0, x ); col < Math.min( width, x + w ); col++ ) {
				const at = ( row * width + col ) * 3;
				pixels[ at ] = r;
				pixels[ at + 1 ] = g;
				pixels[ at + 2 ] = b;
			}
		}
	};
	const hero = HERO_COLORS[ change % HERO_COLORS.length ];
	const margin = layout === 'phone' ? 20 : 80;
	const headerHeight = layout === 'phone' ? 64 : 72;
	fill( 0, 0, width, headerHeight, accent );
	// The site's title and its menu, as white bars in the header.
	fill( margin, headerHeight / 2 - 8, layout === 'phone' ? 120 : 180, 16, '#FFFFFF' );
	if ( layout === 'desktop' ) {
		for ( let item = 0; item < 4; item++ ) {
			fill( width - margin - 90 - item * 110, headerHeight / 2 - 5, 80, 10, '#FFFFFF' );
		}
	}
	const heroTop = headerHeight + ( layout === 'phone' ? 32 : 48 );
	const heroHeight = layout === 'phone' ? 240 : 300;
	fill( margin, heroTop, width - margin * 2, heroHeight, hero );
	// Lines of text, then a button in the site's color.
	let top = heroTop + heroHeight + 32;
	const lineWidths = [ 0.92, 0.85, 0.96, 0.6, 0.88, 0.74 ];
	for ( const share of lineWidths ) {
		fill( margin, top, Math.round( ( width - margin * 2 ) * share ), 12, '#D9D9D9' );
		top += 26;
	}
	fill( margin, top + 16, layout === 'phone' ? 140 : 180, 44, accent );
	return encodePng( width, height, pixels );
}
