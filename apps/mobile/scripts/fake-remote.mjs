// A stand-in for `studio remote`, for work on the phone app.
//
// The real remote mode needs sites, chats and an agent run to show a spinner,
// a question or live text on the phone. This server sends the same shapes
// from made-up data, and plays a script of events in a loop: a run starts and
// writes a reply in a chat, the agent asks a question, a site starts and stops.
// Like the computer, it saves each entry of a chat before it sends the event
// that tells about it.
//
// It also takes what the phone sends: a message starts a short run in that
// chat (a prompt with "?" in it makes the agent ask two questions first), an
// answer lets that run go on, a stop ends it as the computer does, and a new
// chat is created for a site. The loop leaves alone a chat the phone runs in.
//
// It listens on 127.0.0.1 only. Run it from apps/mobile:
//
//   node scripts/fake-remote.mjs
//
// It takes made-up screenshots of its sites (see fake-screenshot.mjs). A site
// changes when a run in one of its chats ends: the next screenshot shows a
// new color. A run the phone started also sends `preview.reload` first, as
// the computer's agent does when it reloads the site's preview.
//
// Pair with the address it prints and the code FAKE-FAKE-FAKE. It logs each
// request that carries a device token, and each request for the image in the
// agent's reply, which the phone must never make.
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { drawScreenshot } from './fake-screenshot.mjs';

const port = Number( process.env.FAKE_REMOTE_PORT ?? 8099 );
const STEP_MS = Number( process.env.FAKE_REMOTE_STEP_MS ?? 2000 );
// Set another id to play a different computer at the same address.
const instanceId = process.env.FAKE_REMOTE_INSTANCE_ID ?? 'fake-instance';
// Set a chat id to make reading that chat fail, as the real server does for a
// chat it cannot load.
const brokenChat = process.env.FAKE_REMOTE_BROKEN_CHAT;
// Set `no-browser` or `failed` to make every screenshot fail for that reason.
const shotFailure = process.env.FAKE_REMOTE_SCREENSHOT;
// A real screenshot takes a second or two on the computer.
const SHOT_MS = 800;

// Not secrets: this server holds no real data.
const PAIRING_CODE = 'FAKEFAKEFAKE';
const DEVICE_TOKEN = 'fake-device-token';

const sites = [
	{ id: 's1', name: 'Bakery', running: true, url: 'http://localhost:8881' },
	{ id: 's2', name: 'Portfolio', running: false, url: 'http://localhost:8882' },
	{ id: 's3', name: 'Shop', running: false, url: 'http://localhost:8883' },
];

// For the screenshots: each site's color, how many times its chats changed
// it, and whether the computer stored a screenshot of it (Shop has none).
const ACCENTS = { s1: '#C2410C', s2: '#1D4ED8', s3: '#047857' };
const changes = new Map();
const STORED = new Set( [ 's1', 's2' ] );

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
// The chats where the loop below has a run, and the runs the phone started,
// by chat id and by run id.
const loopRuns = new Set();
const phoneRuns = new Map();
const runsById = new Map();
let newChats = 0;

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
	loopRuns.add( sessionId );
	activeRuns.set( sessionId, {
		runId: `run-${ sessionId }-${ Date.now() }`,
		sessionId,
		startedAt: Date.now(),
		phase: 'running',
		pendingQuestions: [],
	} );
	agent( sessionId, { type: 'run.started' } );
}

// The agent changed the site of this chat, if it has one.
function changeSite( sessionId ) {
	const siteId = sessions.find( ( candidate ) => candidate.id === sessionId )?.ownerSiteId;
	if ( siteId ) {
		changes.set( siteId, ( changes.get( siteId ) ?? 0 ) + 1 );
	}
}

function endRun( sessionId ) {
	changeSite( sessionId );
	agent( sessionId, { type: 'turn.completed', sessionId, status: 'success' } );
	agent( sessionId, { type: 'run.exited', status: 'success', code: 0 } );
	activeRuns.delete( sessionId );
	loopRuns.delete( sessionId );
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

// A step of the loop in a chat: skipped while the phone runs in that chat,
// and, unless it starts the loop's run, when the loop has no run there.
function inChat( sessionId, step, starts = false ) {
	return async () => {
		if ( phoneRuns.has( sessionId ) || ( ! starts && ! loopRuns.has( sessionId ) ) ) {
			return;
		}
		await step();
	};
}

const SCRIPT = [
	inChat( 'c1', () => startRun( 'c1' ), true ),
	inChat( 'c1', () =>
		inner( 'c1', { type: 'message_update', message: assistant( [ text( 'Checking' ) ] ) } )
	),
	inChat( 'c3', blogTurn, true ),
	() => setRunning( sites[ 1 ], true ),
	inChat( 'c1', () => endRun( 'c1' ) ),
	inChat( 'c3', () => {
		// Another tool of the same turn ends. The question still waits.
		inner( 'c3', {
			type: 'tool_execution_end',
			toolCallId: 't5',
			toolName: 'wp_cli',
			isError: false,
		} );
	} ),
	inChat( 'c3', blogTurnEnd ),
	() => setRunning( sites[ 1 ], false ),
];

// The questions the agent asks when the phone's prompt asks for them: one
// with the model's own "Other" option, and one where several can be picked.
const COLOR_QUESTION = {
	question: 'Which color scheme?',
	options: [
		{ label: 'Light', description: 'A bright background' },
		{ label: 'Dark', description: 'A dark background' },
		{ label: 'Other', description: 'Describe your own' },
	],
};
const PAGES_QUESTION = {
	question: 'Which pages should it change?',
	options: [
		{ label: 'Home', description: '' },
		{ label: 'About', description: '' },
		{ label: 'Blog', description: '' },
	],
	multiSelect: true,
};

// An event of a run the phone started. It keeps the run's id after the run
// left the list of active runs.
function emit( run, event ) {
	send( 'agent', {
		runId: run.runId,
		sessionId: run.sessionId,
		event: { timestamp: new Date().toISOString(), ...event },
	} );
}

function finish( run, events ) {
	if ( run.done ) {
		return;
	}
	run.done = true;
	for ( const event of events ) {
		emit( run, event );
	}
	// A run the phone started after stopping this one may hold the chat now.
	if ( activeRuns.get( run.sessionId )?.runId === run.runId ) {
		activeRuns.delete( run.sessionId );
	}
	if ( phoneRuns.get( run.sessionId ) === run ) {
		phoneRuns.delete( run.sessionId );
	}
	runsById.delete( run.runId );
	const summary = sessions.find( ( candidate ) => candidate.id === run.sessionId );
	summary.updatedAt = new Date().toISOString();
}

// Writes a reply word by word, as streamReply does, and stops early when the
// run is stopped. Returns false then.
async function phoneReply( run, words ) {
	let sofar = '';
	for ( const word of words ) {
		if ( run.stopped ) {
			return false;
		}
		sofar += word;
		const partial = assistant( [ text( sofar ) ] );
		emit( run, { type: 'message', message: { type: 'message_update', message: partial } } );
		await wait( STEP_MS / 10 );
	}
	const complete = assistant( [ text( sofar ) ] );
	save( run.sessionId, message( complete ) );
	emit( run, { type: 'message', message: { type: 'message_end', message: complete } } );
	return ! run.stopped;
}

async function phoneTurn( run, prompt ) {
	const { sessionId } = run;
	if ( ! prompt.trim() ) {
		// The computer's agent refuses a blank prompt and the run fails.
		finish( run, [ { type: 'run.exited', status: 'error', code: 1 } ] );
		return;
	}
	emit( run, { type: 'turn.started' } );
	save( sessionId, userPrompt( prompt ) );
	const user = { role: 'user', content: [ text( prompt ) ] };
	save( sessionId, message( user ) );
	emit( run, { type: 'message', message: { type: 'message_end', message: user } } );
	await wait( STEP_MS / 2 );

	let answers = null;
	if ( prompt.includes( '?' ) ) {
		if ( ! ( await phoneReply( run, [ 'Two ', 'questions ', 'first.' ] ) ) ) {
			return;
		}
		save( sessionId, question( COLOR_QUESTION ) );
		save( sessionId, question( PAGES_QUESTION ) );
		activeRuns.get( sessionId ).pendingQuestions = [ COLOR_QUESTION, PAGES_QUESTION ];
		emit( run, { type: 'question.asked', questions: [ COLOR_QUESTION, PAGES_QUESTION ] } );
		// Never answered when the run is stopped while it waits: the computer
		// kills it (see stopRun).
		answers = await new Promise( ( resolve ) => ( run.answer = resolve ) );
		for ( const asked of [ COLOR_QUESTION, PAGES_QUESTION ] ) {
			const answer = answers?.[ asked.question ];
			if ( typeof answer === 'string' && answer.trim() ) {
				save( sessionId, userPrompt( answer, 'ask_user' ) );
			}
		}
		activeRuns.get( sessionId ).pendingQuestions = [];
		emit( run, { type: 'message', message: { type: 'message_start', message: assistant( [] ) } } );
	}
	const words = answers
		? [ 'Done, ', 'with ', `${ Object.values( answers ).join( ' and ' ) }.` ]
		: [
				'Done. ',
				'I looked ',
				'at the site, ',
				'changed ',
				'what you ',
				'asked for, ',
				'and checked ',
				'the pages ',
				'again ',
				'in a few ',
				'small ',
				'steps.',
		  ];
	changeSite( sessionId );
	emit( run, { type: 'preview.reload' } );
	if ( ! ( await phoneReply( run, words ) ) ) {
		return;
	}
	save( sessionId, turnClosed( 'success' ) );
	finish( run, [
		{ type: 'turn.completed', sessionId, status: 'success', turnId: run.turnId },
		{ type: 'run.exited', status: 'success', code: 0 },
	] );
}

const killed = [ { type: 'run.interrupted' }, { type: 'run.exited', status: 'error', code: null } ];

// As the computer does: the first stop asks the agent to stop and takes the
// run off the list at once; the turn then closes. A second stop kills it, and
// so does the computer 2 s after the first when the agent does not stop: an
// agent that waits for answers ignores the stop.
function stopRun( run ) {
	run.attempts += 1;
	if ( activeRuns.get( run.sessionId )?.runId === run.runId ) {
		activeRuns.delete( run.sessionId );
	}
	if ( run.attempts > 1 ) {
		finish( run, killed );
		return;
	}
	run.stopped = true;
	emit( run, { type: 'run.interrupting' } );
	if ( run.answer ) {
		// An answer that comes after this reaches no one, as on the computer.
		run.answer = null;
		setTimeout( () => finish( run, killed ), 2000 );
		return;
	}
	setTimeout( () => {
		if ( run.done ) {
			return;
		}
		save( run.sessionId, turnClosed( 'interrupted' ) );
		finish( run, [
			{ type: 'turn.completed', sessionId: run.sessionId, status: 'error', turnId: run.turnId },
			{ type: 'run.interrupted' },
			{ type: 'run.exited', status: 'success', code: 0 },
		] );
	}, STEP_MS );
}

// `POST /api/sessions/:id/messages`, with the checks remote mode makes.
function startPhoneRun( res, sessionId, body ) {
	const keys = Object.keys( body );
	const valid =
		typeof body.prompt === 'string' &&
		body.prompt.length > 0 &&
		( body.turnId === undefined || typeof body.turnId === 'string' ) &&
		keys.every( ( key ) => key === 'prompt' || key === 'turnId' );
	if ( ! valid ) {
		json( res, 400, { error: 'Remote mode accepts a text prompt only, without attachments' } );
		return;
	}
	const summary = sessions.find( ( candidate ) => candidate.id === sessionId );
	// The real server answers 500 for an unknown chat and for a busy one.
	if ( ! summary || activeRuns.has( sessionId ) ) {
		json( res, 500, { error: 'Internal error' } );
		return;
	}
	const run = {
		runId: randomUUID(),
		sessionId,
		turnId: body.turnId,
		attempts: 0,
		stopped: false,
		done: false,
		answer: null,
	};
	runsById.set( run.runId, run );
	phoneRuns.set( sessionId, run );
	activeRuns.set( sessionId, {
		runId: run.runId,
		sessionId,
		startedAt: Date.now(),
		phase: 'running',
		pendingQuestions: [],
	} );
	summary.firstPrompt ??= body.prompt;
	summary.updatedAt = new Date().toISOString();
	// The computer sends this when the agent's process starts, which can be
	// before it answers the request.
	emit( run, { type: 'run.started' } );
	json( res, 200, { runId: run.runId } );
	void phoneTurn( run, body.prompt );
}

async function play() {
	for ( let step = 0; ; step += 1 ) {
		await wait( STEP_MS );
		await SCRIPT[ step % SCRIPT.length ]();
	}
}
void play();

// As the computer answers `POST /api/sites/:id/screenshot`, with a PNG where
// the computer sends a JPEG.
async function takeShot( res, siteId, layout ) {
	if ( layout !== 'phone' && layout !== 'desktop' ) {
		json( res, 400, { error: 'layout must be phone or desktop' } );
		return;
	}
	const site = sites.find( ( candidate ) => candidate.id === siteId );
	if ( ! site ) {
		json( res, 404, { error: 'Site not found.' } );
		return;
	}
	if ( ! site.running ) {
		json( res, 200, { image: null, reason: 'stopped' } );
		return;
	}
	await wait( SHOT_MS );
	if ( shotFailure === 'no-browser' || shotFailure === 'failed' ) {
		json( res, 200, { image: null, reason: shotFailure } );
		return;
	}
	const png = drawScreenshot( {
		layout,
		accent: ACCENTS[ site.id ],
		change: changes.get( site.id ) ?? 0,
	} );
	json( res, 200, {
		image: `data:image/png;base64,${ png.toString( 'base64' ) }`,
		takenAt: Date.now(),
	} );
}

// The screenshot the desktop app stored, from before any change.
function storedShot( siteId ) {
	if ( ! STORED.has( siteId ) ) {
		return null;
	}
	const png = drawScreenshot( { layout: 'desktop', accent: ACCENTS[ siteId ], change: 0 } );
	return `data:image/png;base64,${ png.toString( 'base64' ) }`;
}

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

	const messageRoute = /^POST \/api\/sessions\/([^/?]+)\/messages$/.exec( route );
	if ( messageRoute ) {
		startPhoneRun( res, decodeURIComponent( messageRoute[ 1 ] ), await readBody( req ) );
		return;
	}
	const runRoute = /^POST \/api\/runs\/([^/?]+)\/(answer|interrupt)$/.exec( route );
	if ( runRoute ) {
		const body = await readBody( req );
		const run = runsById.get( decodeURIComponent( runRoute[ 1 ] ) );
		// The real server answers 204 for any run id, and drops an answer
		// nothing waits for.
		if ( run && runRoute[ 2 ] === 'interrupt' ) {
			stopRun( run );
		} else if ( run?.answer ) {
			const answer = run.answer;
			run.answer = null;
			answer( body.answers ?? {} );
		}
		res.writeHead( 204 ).end();
		return;
	}

	const shotRoute = /^POST \/api\/sites\/([^/?]+)\/screenshot$/.exec( route );
	if ( shotRoute ) {
		const body = await readBody( req );
		await takeShot( res, decodeURIComponent( shotRoute[ 1 ] ), body.layout );
		return;
	}
	const thumbnailRoute = /^GET \/api\/sites\/([^/?]+)\/thumbnail$/.exec( route );
	if ( thumbnailRoute ) {
		json( res, 200, { thumbnail: storedShot( decodeURIComponent( thumbnailRoute[ 1 ] ) ) } );
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
		case 'POST /api/sessions': {
			// A new chat, bound to the site when the computer knows it.
			const body = await readBody( req );
			const site = sites.find( ( candidate ) => candidate.id === body.siteId );
			newChats += 1;
			const id = `n${ newChats }`;
			const summary = session( id, new Date().toISOString(), {
				eventCount: site ? 1 : 0,
				...( site ? ownedBy( site ) : {} ),
			} );
			sessions.push( summary );
			chats.set( id, [ header( id ) ] );
			json( res, 200, summary );
			return;
		}
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
