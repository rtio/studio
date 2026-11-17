// A stand-in for `studio remote`, for work on the phone app.
//
// The real remote mode needs sites, chats and an agent run to show a spinner or
// a question in the drawer. This server sends the same shapes from made-up
// data, and plays a short script of events in a loop: a run starts, the agent
// asks a question, a site starts and stops.
//
// It listens on 127.0.0.1 only. Run it from apps/mobile:
//
//   node scripts/fake-remote.mjs
//
// Pair with the address it prints and the code FAKE-FAKE-FAKE. It logs each
// request that carries a device token.
import http from 'node:http';

const port = Number( process.env.FAKE_REMOTE_PORT ?? 8099 );
const STEP_MS = Number( process.env.FAKE_REMOTE_STEP_MS ?? 2000 );
// Set another id to play a different computer at the same address.
const instanceId = process.env.FAKE_REMOTE_INSTANCE_ID ?? 'fake-instance';

// Not secrets: this server holds no real data.
const PAIRING_CODE = 'FAKEFAKEFAKE';
const DEVICE_TOKEN = 'fake-device-token';

const sites = [
	{ id: 's1', name: 'Bakery', running: true, url: 'http://localhost:8881' },
	{ id: 's2', name: 'Portfolio', running: false, url: 'http://localhost:8882' },
	{ id: 's3', name: 'Shop', running: false, url: 'http://localhost:8883' },
];

function session( id, updatedAt, fields ) {
	return {
		id,
		filePath: `/Users/someone/.studio/sessions/2026/11/17/${ id }.jsonl`,
		createdAt: '2026-11-17T08:00:00.000Z',
		updatedAt,
		activeEnvironment: 'local',
		eventCount: 12,
		...fields,
	};
}

function ownedBy( site ) {
	return {
		ownerSiteId: site.id,
		ownerSitePath: `/Users/someone/Studio/${ site.name.toLowerCase() }`,
		ownerSiteName: site.name,
	};
}

const sessions = [
	session( 'c1', '2026-11-17T10:00:00.000Z', {
		firstPrompt: 'create a landing page',
		...ownedBy( sites[ 0 ] ),
	} ),
	session( 'c2', '2026-11-17T09:00:00.000Z', {
		title: 'Contact form',
		firstPrompt: 'add a contact form to the about page',
		...ownedBy( sites[ 0 ] ),
	} ),
	session( 'c3', '2026-11-17T08:30:00.000Z', {
		firstPrompt: 'add a blog',
		activeEnvironment: 'live',
		...ownedBy( sites[ 1 ] ),
	} ),
	session( 'c4', '2026-11-16T12:00:00.000Z', { firstPrompt: 'old work', archived: true } ),
	session( 'c5', '2026-11-17T11:00:00.000Z', { eventCount: 0 } ),
	session( 'c6', '2026-11-15T08:00:00.000Z', { firstPrompt: 'explain block themes' } ),
];

// The runs `GET /api/runs/active` reports, by chat id.
const activeRuns = new Map();
const streams = new Set();

function send( channel, payload ) {
	const block = `data: ${ JSON.stringify( { channel, payload } ) }\n\n`;
	for ( const stream of streams ) {
		stream.write( block );
	}
}

function agent( sessionId, event ) {
	const run = activeRuns.get( sessionId );
	send( 'agent', {
		runId: run?.runId ?? `run-${ sessionId }`,
		sessionId,
		event: { timestamp: new Date().toISOString(), ...event },
	} );
}

function startRun( sessionId ) {
	activeRuns.set( sessionId, {
		runId: `run-${ sessionId }-${ Date.now() }`,
		sessionId,
		startedAt: Date.now(),
		phase: 'running',
		pendingQuestions: [],
	} );
	agent( sessionId, { type: 'run.started' } );
}

function endRun( sessionId ) {
	agent( sessionId, { type: 'turn.completed', sessionId, status: 'success' } );
	agent( sessionId, { type: 'run.exited', status: 'success', code: 0 } );
	activeRuns.delete( sessionId );
	const ended = sessions.find( ( candidate ) => candidate.id === sessionId );
	ended.updatedAt = new Date().toISOString();
}

function setRunning( site, running ) {
	site.running = running;
	send( 'site-event', { event: 'site-updated', siteId: site.id, running, site } );
}

const QUESTION = {
	question: 'Which layout?',
	options: [
		{ label: 'Grid', description: 'Three columns' },
		{ label: 'List', description: 'One column' },
	],
};

const SCRIPT = [
	() => startRun( 'c1' ),
	() => agent( 'c1', { type: 'message', message: { type: 'message_update' } } ),
	() => {
		startRun( 'c3' );
		activeRuns.get( 'c3' ).pendingQuestions = [ QUESTION ];
		agent( 'c3', { type: 'question.asked', questions: [ QUESTION ] } );
	},
	() => setRunning( sites[ 1 ], true ),
	() => endRun( 'c1' ),
	() => {
		// Another tool of the same turn ends. The question still waits.
		agent( 'c3', { type: 'message', message: { type: 'tool_execution_end' } } );
	},
	() => {
		// The question is answered on the computer, and the agent goes on.
		activeRuns.get( 'c3' ).pendingQuestions = [];
		agent( 'c3', { type: 'message', message: { type: 'message_start' } } );
	},
	() => endRun( 'c3' ),
	() => setRunning( sites[ 1 ], false ),
];

let step = 0;
setInterval( () => {
	SCRIPT[ step % SCRIPT.length ]();
	step += 1;
}, STEP_MS );

function json( res, status, body ) {
	res.writeHead( status, { 'Content-Type': 'application/json' } );
	res.end( JSON.stringify( body ) );
}

function readBody( req ) {
	return new Promise( ( resolve ) => {
		let text = '';
		req.on( 'data', ( chunk ) => ( text += chunk ) );
		req.on( 'end', () => {
			try {
				resolve( JSON.parse( text || '{}' ) );
			} catch {
				resolve( {} );
			}
		} );
	} );
}

const server = http.createServer( async ( req, res ) => {
	const route = `${ req.method } ${ req.url }`;

	// The real server refuses any request that a web page could send.
	if ( req.headers.origin ) {
		json( res, 403, { error: 'Origin not allowed' } );
		return;
	}
	if ( route === 'GET /.well-known/studio/remote' ) {
		json( res, 200, {
			instanceId,
			label: 'Fake computer',
			protocolVersion: 1,
			studioVersion: 'fake',
		} );
		return;
	}
	if ( route === 'POST /api/remote/pair' ) {
		const body = await readBody( req );
		const code = String( body.code ?? '' )
			.replace( /[\s-]/g, '' )
			.toUpperCase();
		if ( code !== PAIRING_CODE ) {
			json( res, 401, { error: 'Pairing code is not valid' } );
			return;
		}
		json( res, 200, {
			token: DEVICE_TOKEN,
			deviceId: 'fake-device',
			expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
		} );
		return;
	}
	// A test can read this to see whether a phone sent its token here.
	if ( req.headers.authorization ) {
		console.log( `token received: ${ route }` );
	}
	if ( req.headers.authorization !== `Bearer ${ DEVICE_TOKEN }` ) {
		json( res, 401, { error: 'Device is not paired' } );
		return;
	}

	switch ( route ) {
		case 'GET /api/health':
			json( res, 200, { status: 'ok' } );
			return;
		case 'GET /api/sites':
			json( res, 200, sites );
			return;
		case 'GET /api/sessions':
			json(
				res,
				200,
				[ ...sessions ].sort( ( a, b ) => ( a.updatedAt < b.updatedAt ? 1 : -1 ) )
			);
			return;
		case 'GET /api/runs/active':
			json( res, 200, [ ...activeRuns.values() ] );
			return;
		case 'DELETE /api/remote/devices/current':
			res.writeHead( 204 ).end();
			return;
		case 'GET /api/events':
			res.writeHead( 200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			} );
			res.write( ': connected\n\n' );
			streams.add( res );
			req.on( 'close', () => streams.delete( res ) );
			return;
		default:
			json( res, 403, { error: 'Not available in remote mode' } );
	}
} );

server.listen( port, '127.0.0.1', () => {
	console.log( `Fake remote on http://127.0.0.1:${ port }` );
	console.log( 'Pairing code: FAKE-FAKE-FAKE' );
} );
