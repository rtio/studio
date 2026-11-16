// Stand-in for the Studio CLI in server tests. Every command exits at once, except
// `_events`, which keeps running and reports one event of each kind in a loop.
if ( process.argv.includes( '_events' ) && process.send ) {
	setInterval( () => {
		process.send( {
			action: 'keyValuePair',
			key: 'auth-event',
			value: JSON.stringify( { event: 'auth-login' } ),
		} );
		process.send( {
			action: 'keyValuePair',
			key: 'site-event',
			value: JSON.stringify( { event: 'site-updated', siteId: 's1', running: true } ),
		} );
	}, 80 );
} else {
	process.exit( 0 );
}
