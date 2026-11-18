import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, UnreachableError } from '../connection/api-client';
import { WrongComputerError } from '../connection/verify-computer';
import { createValueStore } from '../lib/value-store';
import { startLiveSession } from './live-session';
import type { LiveStatus } from './live-status';
import type { ActiveRun } from './remote-schemas';
import type { ActivityMap } from './run-activity';
import type { StreamConnection } from '../connection/event-stream';

function deferred< T >() {
	let resolve!: ( value: T ) => void;
	let reject!: ( error: unknown ) => void;
	const promise = new Promise< T >( ( onResolve, onReject ) => {
		resolve = onResolve;
		reject = onReject;
	} );
	return { promise, resolve, reject };
}

function agentEvent(
	sessionId: string,
	runId: string,
	type: string,
	more: Record< string, unknown > = {}
) {
	return `data: ${ JSON.stringify( {
		channel: 'agent',
		payload: { runId, sessionId, event: { type, ...more } },
	} ) }\n\n`;
}

// A fake phone and computer. `verify` answers what the test sets. Each stream
// and each read of the active runs waits until the test ends it by hand.
function setup( whoAnswersFirst: 'paired' | 'other' | 'nobody' = 'paired' ) {
	const status = createValueStore< LiveStatus >( 'off' );
	const activity = createValueStore< ActivityMap >( {} );
	const streams: Array< {
		stream: StreamConnection;
		end: () => void;
		fail: ( error: unknown ) => void;
	} > = [];
	const runReads: Array< ReturnType< typeof deferred< ActiveRun[] > > > = [];
	let whoAnswers = whoAnswersFirst;

	const parts = {
		status,
		activity,
		verify: vi.fn( async () => {
			if ( whoAnswers === 'other' ) {
				throw new WrongComputerError();
			}
			if ( whoAnswers === 'nobody' ) {
				throw new UnreachableError();
			}
		} ),
		openStream: vi.fn(
			( stream: StreamConnection ) =>
				new Promise< void >( ( resolve, reject ) => {
					streams.push( { stream, end: resolve, fail: reject } );
				} )
		),
		loadActiveRuns: vi.fn( () => {
			const read = deferred< ActiveRun[] >();
			runReads.push( read );
			return read.promise;
		} ),
		onUnauthorized: vi.fn(),
		onListsStale: vi.fn(),
		onChatsStale: vi.fn(),
		onSiteUpdated: vi.fn(),
		onSiteAddedOrRemoved: vi.fn(),
		openChatId: vi.fn( (): string | null => 'chat-1' ),
		onChatEvent: vi.fn(),
		onRunEvent: vi.fn(),
		onActiveRunsRead: vi.fn(),
		onActiveRuns: vi.fn(),
	};

	return {
		parts,
		status,
		activity,
		streams,
		runReads,
		answerAs: ( who: typeof whoAnswers ) => {
			whoAnswers = who;
		},
		session: startLiveSession( parts ),
	};
}

// Lets promise callbacks run.
async function settle() {
	await vi.advanceTimersByTimeAsync( 0 );
}

beforeEach( () => {
	vi.useFakeTimers();
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'startLiveSession', () => {
	it( 'verifies the computer, opens the stream, and reloads the state', async () => {
		const { parts, status, activity, streams, runReads } = setup();
		expect( status.get() ).toBe( 'connecting' );

		await settle();
		expect( parts.verify ).toHaveBeenCalledTimes( 1 );
		streams[ 0 ].stream.onOpen();

		expect( status.get() ).toBe( 'live' );
		expect( parts.onListsStale ).toHaveBeenCalledTimes( 1 );
		runReads[ 0 ].resolve( [ { runId: 'run-1', sessionId: 'chat-1' } ] );
		await settle();
		expect( activity.get() ).toEqual( { 'chat-1': { runId: 'run-1', activity: 'working' } } );
	} );

	it( 'sends nothing with the token while another computer answers', async () => {
		const { parts, status } = setup( 'other' );

		await settle();
		await vi.advanceTimersByTimeAsync( 60_000 );

		expect( status.get() ).toBe( 'wrong-computer' );
		expect( parts.verify.mock.calls.length ).toBeGreaterThan( 2 );
		expect( parts.openStream ).not.toHaveBeenCalled();
		expect( parts.loadActiveRuns ).not.toHaveBeenCalled();
	} );

	it( 'keeps trying while nobody answers, and connects when the computer is back', async () => {
		const { status, streams, answerAs } = setup( 'nobody' );
		await settle();
		expect( status.get() ).toBe( 'reconnecting' );

		answerAs( 'paired' );
		await vi.advanceTimersByTimeAsync( 1_000 );
		streams[ 0 ].stream.onOpen();

		expect( status.get() ).toBe( 'live' );
	} );

	it( 'applies events that arrive while the active runs are read on top of that answer', async () => {
		const { activity, streams, runReads } = setup();
		await settle();
		const { stream } = streams[ 0 ];
		stream.onOpen();

		// The computer answered "chat-1 is running" before the run ended. The
		// event of the end arrives first, the older answer after it.
		stream.onData( agentEvent( 'chat-1', 'run-1', 'run.exited' ) );
		stream.onData( agentEvent( 'chat-2', 'run-2', 'run.started' ) );
		runReads[ 0 ].resolve( [ { runId: 'run-1', sessionId: 'chat-1' } ] );
		await settle();

		expect( activity.get() ).toEqual( { 'chat-2': { runId: 'run-2', activity: 'working' } } );
	} );

	it( 'gives the run control every agent event, and the active runs it read', async () => {
		const { parts, streams, runReads } = setup();
		await settle();
		const { stream } = streams[ 0 ];
		stream.onOpen();
		expect( parts.onActiveRunsRead ).toHaveBeenCalledTimes( 1 );
		expect( parts.onActiveRunsRead.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			parts.loadActiveRuns.mock.invocationCallOrder[ 0 ]
		);

		stream.onData( agentEvent( 'chat-2', 'run-2', 'run.started' ) );
		expect( parts.onRunEvent ).toHaveBeenCalledWith(
			'chat-2',
			expect.objectContaining( { runId: 'run-2', type: 'run.started' } )
		);

		const runs = [ { runId: 'run-1', sessionId: 'chat-1' } ];
		runReads[ 0 ].resolve( runs );
		await settle();

		expect( parts.onActiveRuns ).toHaveBeenCalledWith( runs );
		expect( parts.onRunEvent ).toHaveBeenCalledTimes( 1 );
	} );

	it( "keeps when a run seen live started, and passes a turn's status on", async () => {
		const { parts, activity, streams } = setup();
		await settle();
		const { stream } = streams[ 0 ];
		stream.onOpen();

		stream.onData(
			agentEvent( 'chat-2', 'run-2', 'run.started', { timestamp: '2026-11-18T10:00:00.000Z' } )
		);
		expect( activity.get()[ 'chat-2' ] ).toMatchObject( {
			since: Date.parse( '2026-11-18T10:00:00.000Z' ),
		} );

		stream.onData( agentEvent( 'chat-2', 'run-2', 'turn.completed', { status: 'error' } ) );
		expect( parts.onRunEvent ).toHaveBeenLastCalledWith(
			'chat-2',
			expect.objectContaining( { type: 'turn.completed', status: 'error' } )
		);
	} );

	it( 'ignores an answer about the active runs that arrives after a newer open', async () => {
		const { session, activity, streams, runReads } = setup();
		await settle();
		streams[ 0 ].stream.onOpen();

		session.reconnect();
		await settle();
		streams[ 1 ].stream.onOpen();
		runReads[ 1 ].resolve( [] );
		await settle();
		runReads[ 0 ].resolve( [ { runId: 'old-run', sessionId: 'chat-1' } ] );
		await settle();

		expect( activity.get() ).toEqual( {} );
	} );

	it( 'writes nothing after it is stopped', async () => {
		const { session, status, activity, streams, runReads } = setup();
		await settle();
		streams[ 0 ].stream.onOpen();

		session.stop();
		streams[ 0 ].stream.onData( agentEvent( 'chat-1', 'run-1', 'run.started' ) );
		runReads[ 0 ].resolve( [ { runId: 'run-1', sessionId: 'chat-1' } ] );
		streams[ 0 ].fail( new Error( 'aborted' ) );
		await settle();
		await vi.advanceTimersByTimeAsync( 60_000 );

		expect( activity.get() ).toEqual( {} );
		expect( status.get() ).toBe( 'live' );
		expect( streams ).toHaveLength( 1 );
	} );

	it( 'tells the phone about chats and sites that changed', async () => {
		const { parts, streams } = setup();
		await settle();
		const { stream } = streams[ 0 ];
		stream.onOpen();
		const site = { id: 's1', name: 'Bakery', running: true };

		stream.onData( agentEvent( 'chat-1', 'run-1', 'run.started' ) );
		stream.onData( agentEvent( 'chat-1', 'run-1', 'message' ) );
		stream.onData( agentEvent( 'chat-1', 'run-1', 'run.exited' ) );
		stream.onData(
			`data: ${ JSON.stringify( {
				channel: 'site-event',
				payload: { event: 'site-updated', siteId: 's1', site },
			} ) }\n\n`
		);
		stream.onData(
			`data: ${ JSON.stringify( {
				channel: 'site-event',
				payload: { event: 'site-deleted', siteId: 's2' },
			} ) }\n\n`
		);

		expect( parts.onChatsStale ).toHaveBeenCalledTimes( 2 );
		expect( parts.onSiteUpdated ).toHaveBeenCalledWith( site );
		expect( parts.onSiteAddedOrRemoved ).toHaveBeenCalledWith( 'site-deleted', 's2' );
	} );

	it( 'passes the events of the open chat on, and only those', async () => {
		const { parts, streams } = setup();
		await settle();
		const { stream } = streams[ 0 ];
		stream.onOpen();

		stream.onData( agentEvent( 'chat-2', 'run-2', 'run.started' ) );
		stream.onData(
			`data: ${ JSON.stringify( {
				channel: 'agent',
				payload: {
					runId: 'run-1',
					sessionId: 'chat-1',
					event: {
						type: 'message',
						timestamp: '2026-11-17T10:00:02.000Z',
						message: { type: 'message_end', message: { role: 'user' } },
					},
				},
			} ) }\n\n`
		);
		parts.openChatId.mockReturnValue( null );
		stream.onData( agentEvent( 'chat-1', 'run-1', 'run.exited' ) );

		expect( parts.onChatEvent ).toHaveBeenCalledTimes( 1 );
		expect( parts.onChatEvent ).toHaveBeenCalledWith( 'chat-1', {
			runId: 'run-1',
			type: 'message',
			timestamp: '2026-11-17T10:00:02.000Z',
			inner: { type: 'message_end', message: { role: 'user' } },
			text: undefined,
		} );
	} );

	it( 'checks every 15 seconds who answers, without the token, and reconnects when nobody does', async () => {
		const { parts, status, streams, answerAs } = setup();
		await settle();
		streams[ 0 ].stream.onOpen();
		expect( parts.verify ).toHaveBeenCalledTimes( 1 );

		await vi.advanceTimersByTimeAsync( 15_000 );
		expect( parts.verify ).toHaveBeenCalledTimes( 2 );
		expect( status.get() ).toBe( 'live' );

		answerAs( 'nobody' );
		await vi.advanceTimersByTimeAsync( 15_000 );

		expect( status.get() ).toBe( 'reconnecting' );
		expect( streams[ 0 ].stream.signal.aborted ).toBe( true );
	} );

	it( 'says so when the check finds another computer, and sends it no token', async () => {
		const { parts, status, streams, answerAs } = setup();
		await settle();
		streams[ 0 ].stream.onOpen();

		answerAs( 'other' );
		await vi.advanceTimersByTimeAsync( 15_000 );
		await vi.advanceTimersByTimeAsync( 30_000 );

		expect( status.get() ).toBe( 'wrong-computer' );
		expect( parts.openStream ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'opens the stream again after five minutes without data', async () => {
		const { streams } = setup();
		await settle();
		streams[ 0 ].stream.onOpen();

		await vi.advanceTimersByTimeAsync( 4 * 60_000 );
		streams[ 0 ].stream.onData( agentEvent( 'chat-1', 'run-1', 'message' ) );
		await vi.advanceTimersByTimeAsync( 4 * 60_000 );
		expect( streams ).toHaveLength( 1 );

		await vi.advanceTimersByTimeAsync( 60_000 + 15_000 );
		expect( streams[ 0 ].stream.signal.aborted ).toBe( true );
		expect( streams ).toHaveLength( 2 );
	} );

	it( 'unpairs once and stops when the computer refuses the token', async () => {
		const { parts, status, streams } = setup();
		await settle();

		streams[ 0 ].fail( new UnauthorizedError() );
		await settle();
		await vi.advanceTimersByTimeAsync( 60_000 );

		expect( parts.onUnauthorized ).toHaveBeenCalledTimes( 1 );
		expect( status.get() ).toBe( 'off' );
		expect( streams ).toHaveLength( 1 );
	} );
} );
