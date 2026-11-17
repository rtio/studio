// Whether a link in the agent's text may open on the phone. Agent text is not
// trusted: a link can name any scheme (`file:`, `tel:`, another app's own
// scheme), so only web links open. A link to the computer's own loopback
// address (a site at `http://localhost:8881`) would reach the phone itself,
// so it does not open either.
export function isOpenableLink( url: string ): boolean {
	let parsed: URL;
	try {
		parsed = new URL( url );
	} catch {
		return false;
	}
	if ( parsed.protocol !== 'http:' && parsed.protocol !== 'https:' ) {
		return false;
	}
	// The URL parser writes IP addresses one way (`127.1` is `127.0.0.1`,
	// `[::ffff:127.0.0.1]` is `[::ffff:7f00:1]`); a name can end in a dot.
	const host = parsed.hostname.toLowerCase().replace( /\.+$/, '' );
	const loopback =
		host === 'localhost' ||
		host.endsWith( '.localhost' ) ||
		host.startsWith( '127.' ) ||
		host === '0.0.0.0' ||
		host === '[::1]' ||
		host === '[::]' ||
		host.startsWith( '[::ffff:7f' );
	return ! loopback;
}
