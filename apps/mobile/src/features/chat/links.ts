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
	const host = parsed.hostname.toLowerCase();
	const loopback =
		host === 'localhost' ||
		host.endsWith( '.localhost' ) ||
		host.startsWith( '127.' ) ||
		host === '[::1]';
	return ! loopback;
}
