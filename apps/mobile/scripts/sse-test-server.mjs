import http from 'node:http';

const port = Number( process.env.SSE_TEST_PORT ?? 8799 );
const TEST_TOKEN = 'spike-test-token';

const server = http.createServer( ( req, res ) => {
	if ( req.headers.authorization !== `Bearer ${ TEST_TOKEN }` ) {
		res.writeHead( 401 ).end();
		console.log( 'rejected: no test token' );
		return;
	}

	res.writeHead( 200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
	} );
	res.write( ': connected\n\n' );
	console.log( 'stream opened' );

	let sent = 0;
	const timer = setInterval( () => {
		sent += 1;
		res.write( `data: ${ JSON.stringify( { channel: 'agent', payload: { n: sent } } ) }\n\n` );
		if ( sent === 20 ) {
			clearInterval( timer );
			res.end();
		}
	}, 500 );

	req.on( 'close', () => {
		clearInterval( timer );
		console.log( `stream closed after ${ sent } events` );
	} );
} );

server.listen( port, '127.0.0.1', () => {
	console.log( `SSE test server on http://127.0.0.1:${ port }` );
} );
