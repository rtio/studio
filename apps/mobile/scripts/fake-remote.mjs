// A stand-in for `studio remote`, for work on the phone app.
//
// The real remote mode needs sites, chats and an agent run to show a spinner,
// a question or live text on the phone. This server sends the same shapes
// from made-up data, and plays a script of events in a loop: a run starts and
// writes a reply in a chat, the agent asks a question, a site starts and stops.
// Like the computer, it saves each entry of a chat before it sends the event
// that tells about it.
//
// It listens on 127.0.0.1 only. Run it from apps/mobile:
//
//   node scripts/fake-remote.mjs
//
// Pair with the address it prints and the code FAKE-FAKE-FAKE. It logs each
// request that carries a device token, and each request for the image in the
// agent's reply, which the phone must never make.
import http from 'node:http';

const port = Number( process.env.FAKE_REMOTE_PORT ?? 8099 );
const STEP_MS = Number( process.env.FAKE_REMOTE_STEP_MS ?? 2000 );
// Set another id to play a different computer at the same address.
const instanceId = process.env.FAKE_REMOTE_INSTANCE_ID ?? 'fake-instance';
// Set a chat id to make reading that chat fail, as the real server does for a
// chat it cannot load.
const brokenChat = process.env.FAKE_REMOTE_BROKEN_CHAT;

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

// The saved entries of each chat, as the agent library and Studio write them.
let entryCount = 0;

function entry( fields ) {
	entryCount += 1;
	return {
		id: `e${ entryCount }`,
		parentId: null,
		timestamp: new Date().toISOString(),
		...fields,
	};
}

const header = ( id ) => ( {
	type: 'session',
	version: 3,
	id,
	timestamp: '2026-11-17T08:00:00.000Z',
	cwd: '~/Studio',
} );
const userPrompt = ( text, source = 'prompt' ) =>
	entry( { type: 'custom', customType: 'studio.user_prompt', data: { text, source } } );
const message = ( body ) => entry( { type: 'message', message: body } );
const assistant = ( content ) => ( { role: 'assistant', content, stopReason: 'stop' } );
const text = ( value ) => ( { type: 'text', text: value } );
const toolCall = ( id, name, args ) => ( { type: 'toolCall', id, name, arguments: args } );
const toolResult = ( toolCallId, toolName, value, isError = false ) => ( {
	role: 'toolResult',
	toolCallId,
	toolName,
	content: [ text( value ) ],
	isError,
} );
const turnClosed = ( status, errorMessage ) =>
	entry( {
		type: 'custom',
		customType: 'studio.turn_closed',
		data: errorMessage ? { status, errorMessage } : { status },
	} );
const question = ( data ) => entry( { type: 'custom', customType: 'studio.agent_question', data } );

const LAYOUT_QUESTION = {
	question: 'Which layout for the blog?',
	options: [
		{ label: 'Grid', description: 'Three columns of cards' },
		{ label: 'List', description: 'One column with excerpts' },
	],
};

const chats = new Map( [
	[
		'c1',
		[
			header( 'c1' ),
			userPrompt( 'create a landing page' ),
			message( { role: 'user', content: [ text( 'create a landing page' ) ] } ),
			message(
				assistant( [
					text( 'I will add a landing page with a hero and a call to action.' ),
					toolCall( 't1', 'wp_cli', { command: 'post create --post_type=page --post_title=Home' } ),
				] )
			),
			message( toolResult( 't1', 'wp_cli', 'Success: Created post 12.' ) ),
			message(
				assistant( [ toolCall( 't2', 'Edit', { path: 'theme/templates/front-page.html' } ) ] )
			),
			message( toolResult( 't2', 'Edit', 'Saved' ) ),
			message(
				assistant( [
					text(
						[
							'## Done',
							'',
							'The **landing page** is ready:',
							'',
							'- A hero with your headline',
							'- A *Order now* button',
							'',
							'Read more about [block themes](https://wordpress.org/documentation/article/block-themes/).',
						].join( '\n' )
					),
				] )
			),
			turnClosed( 'success' ),
		],
	],
	[
		'c2',
		[
			header( 'c2' ),
			userPrompt( 'add a contact form to the about page' ),
			question( {
				question: 'Which fields should the form have?',
				options: [
					{ label: 'Name', description: '' },
					{ label: 'Email', description: '' },
					{ label: 'Phone', description: '' },
				],
				multiSelect: true,
			} ),
			userPrompt( 'Name, Email', 'ask_user' ),
			message( assistant( [ toolCall( 't3', 'Edit', { path: 'theme/patterns/contact.php' } ) ] ) ),
			message( toolResult( 't3', 'Edit', 'Saved' ) ),
			message(
				assistant( [
					text(
						[
							'| Field | Required |',
							'| --- | --- |',
							'| Name | yes |',
							'| Email | yes |',
							'',
							'```php',
							"<?php echo do_blocks( '<!-- wp:jetpack/contact-form /-->' ); ?>",
							'```',
						].join( '\n' )
					),
				] )
			),
			turnClosed( 'success' ),
			userPrompt( 'make it shorter' ),
			message( assistant( [ toolCall( 't4', 'Edit', { path: 'theme/patterns/contact.php' } ) ] ) ),
			turnClosed( 'interrupted' ),
		],
	],
	[ 'c3', [] ],
	[
		'c6',
		[
			header( 'c6' ),
			userPrompt( 'explain block themes' ),
			turnClosed( 'error', 'Error: studio_out_of_credits' ),
		],
	],
] );

const C3_SEED = [
	header( 'c3' ),
	userPrompt( 'add a blog' ),
	message( assistant( [ text( 'Which site?' ) ] ) ),
	turnClosed( 'success' ),
];
chats.set( 'c3', [ ...C3_SEED ] );

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

// An event of the agent library, wrapped as Studio sends it.
function inner( sessionId, event ) {
	agent( sessionId, { type: 'message', message: event } );
}

function save( sessionId, saved ) {
	chats.get( sessionId ).push( saved );
	return saved;
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

const wait = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

// Writes an assistant message as the agent library streams it: each update
// carries the whole message so far, twice, and the end carries it complete.
async function streamReply( sessionId, words, tail = [] ) {
	let sofar = '';
	for ( const word of words ) {
		sofar += word;
		const partial = assistant( [ text( sofar ) ] );
		inner( sessionId, {
			type: 'message_update',
			message: partial,
			assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: word, partial },
		} );
		await wait( STEP_MS / 10 );
	}
	const complete = assistant( [ text( sofar ), ...tail ] );
	save( sessionId, message( complete ) );
	inner( sessionId, { type: 'message_end', message: complete } );
}

// A turn in "Add a blog": the prompt, a reply with a step, a question that is
// answered on the computer, and a final reply.
async function blogTurn() {
	chats.set( 'c3', [ ...C3_SEED ] );
	startRun( 'c3' );
	agent( 'c3', { type: 'turn.started' } );
	save( 'c3', userPrompt( 'Add a blog page with the latest posts' ) );
	const user = { role: 'user', content: [ text( 'Add a blog page with the latest posts' ) ] };
	save( 'c3', message( user ) );
	inner( 'c3', { type: 'message_end', message: user } );
	await wait( STEP_MS / 2 );

	await streamReply(
		'c3',
		[
			'I will ',
			'add a ',
			'**blog page** ',
			'that lists ',
			'your latest ',
			'posts. ',
			'First I ',
			'check them.',
		],
		[ toolCall( 't5', 'wp_cli', { command: 'post list --post_type=post --post_status=publish' } ) ]
	);
	inner( 'c3', { type: 'tool_execution_start', toolCallId: 't5', toolName: 'wp_cli', args: {} } );
	await wait( STEP_MS );
	const listed = toolResult( 't5', 'wp_cli', 'ID\tpost_title\n4\tHello world' );
	save( 'c3', message( listed ) );
	inner( 'c3', { type: 'message_end', message: listed } );
	inner( 'c3', { type: 'turn_end', message: assistant( [] ), toolResults: [ listed ] } );
	await wait( STEP_MS / 2 );

	// The question is saved before its event.
	save( 'c3', question( LAYOUT_QUESTION ) );
	activeRuns.get( 'c3' ).pendingQuestions = [ LAYOUT_QUESTION ];
	agent( 'c3', {
		type: 'question.asked',
		questions: [ { ...LAYOUT_QUESTION, multiSelect: false } ],
	} );
}

async function blogTurnEnd() {
	// The question is answered on the computer, and the agent goes on.
	save( 'c3', userPrompt( 'Grid', 'ask_user' ) );
	activeRuns.get( 'c3' ).pendingQuestions = [];
	inner( 'c3', { type: 'message_start', message: assistant( [] ) } );
	await streamReply( 'c3', [
		'Done. ',
		'The blog page ',
		'shows the latest posts ',
		'in a grid.\n\n',
		'- Open [the page](http://localhost:8882/blog) on your computer\n',
		'- Read the [Query Loop guide](https://wordpress.org/documentation/article/query-loop-block/)\n\n',
		`![Preview](http://127.0.0.1:${ port }/agent-image.png)`,
	] );
	save( 'c3', turnClosed( 'success' ) );
	endRun( 'c3' );
}

const SCRIPT = [
	() => startRun( 'c1' ),
	() => inner( 'c1', { type: 'message_update', message: assistant( [ text( 'Checking' ) ] ) } ),
	blogTurn,
	() => setRunning( sites[ 1 ], true ),
	() => endRun( 'c1' ),
	() => {
		// Another tool of the same turn ends. The question still waits.
		inner( 'c3', {
			type: 'tool_execution_end',
			toolCallId: 't5',
			toolName: 'wp_cli',
			isError: false,
		} );
	},
	blogTurnEnd,
	() => setRunning( sites[ 1 ], false ),
];

async function play() {
	for ( let step = 0; ; step += 1 ) {
		await wait( STEP_MS );
		await SCRIPT[ step % SCRIPT.length ]();
	}
}
void play();

function json( res, status, body ) {
	res.writeHead( status, { 'Content-Type': 'application/json' } );
	res.end( JSON.stringify( body ) );
}

function readBody( req ) {
	return new Promise( ( resolve ) => {
		let body = '';
		req.on( 'data', ( chunk ) => ( body += chunk ) );
		req.on( 'end', () => {
			try {
				resolve( JSON.parse( body || '{}' ) );
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
	if ( req.url === '/agent-image.png' ) {
		console.log( 'image requested: the phone loaded an image from agent text' );
		res.writeHead( 404 ).end();
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

	const chatRoute = /^GET \/api\/sessions\/([^/?]+)$/.exec( route );
	if ( chatRoute ) {
		const id = decodeURIComponent( chatRoute[ 1 ] );
		const summary = sessions.find( ( candidate ) => candidate.id === id );
		if ( ! summary || id === brokenChat ) {
			// The real server answers 500 for a chat it does not know.
			json( res, 500, { error: 'Internal error' } );
			return;
		}
		json( res, 200, { summary, entries: chats.get( id ) ?? [ header( id ) ] } );
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
