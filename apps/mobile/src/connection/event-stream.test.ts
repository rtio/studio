import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startEventStream } from './event-stream';
import type { StreamConnection, StreamStatus } from './event-stream';

// A fake computer. Each call to `connect` is one attempt that the test opens,
// feeds, ends or fails by hand.
function fakeComputer() {
	const attempts: Array< {
		connection: StreamConnection;
		end: () => void;
		fail: ( error: unknown ) => void;
	} > = [];
	const connect = vi.fn(
		( connection: StreamConnection ) =>
			new Promise< void >( ( resolve, reject ) => {
				attempts.push( { connection, end: resolve, fail: reject } );
			} )
	);
	return { attempts, connect };
}

function start(
	computer: ReturnType< typeof fakeComputer >,
	isFatal: ( error: unknown ) => boolean = () => false
) {
	const statuses: StreamStatus[] = [];
	const messages: string[] = [];
	const onOpen = vi.fn();
	const stream = startEventStream( {
		connect: computer.connect,
		onMessage: ( data ) => messages.push( data ),
		onOpen,
		onStatus: ( status ) => statuses.push( status ),
		isFatal,
	} );
	return { stream, statuses, messages, onOpen };
}

// Lets the promise callbacks of an ended or failed attempt run.
async function settle() {
	await vi.advanceTimersByTimeAsync( 0 );
}

beforeEach( () => {
	vi.useFakeTimers();
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'startEventStream', () => {
	it( 'connects at once, and is live when the computer accepts the stream', () => {
		const computer = fakeComputer();
		const { statuses, onOpen } = start( computer );

		expect( computer.connect ).toHaveBeenCalledTimes( 1 );
		expect( statuses ).toEqual( [ 'connecting' ] );

		computer.attempts[ 0 ].connection.onOpen();

		expect( statuses ).toEqual( [ 'connecting', 'live' ] );
		expect( onOpen ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'gives each event once, also when it arrives in pieces', () => {
		const computer = fakeComputer();
		const { messages } = start( computer );
		const { connection } = computer.attempts[ 0 ];
		connection.onOpen();

		connection.onData( ': connected\n\ndata: {"channel":"ag' );
		connection.onData( 'ent"}\n\ndata: second\n\n' );

		expect( messages ).toEqual( [ '{"channel":"agent"}', 'second' ] );
	} );

	it( 'tries again after 1 s, then 2 s, when the computer does not answer', async () => {
		const computer = fakeComputer();
		const { statuses } = start( computer );

		computer.attempts[ 0 ].fail( new Error( 'no answer' ) );
		await settle();
		expect( statuses ).toEqual( [ 'connecting', 'reconnecting' ] );

		await vi.advanceTimersByTimeAsync( 999 );
		expect( computer.connect ).toHaveBeenCalledTimes( 1 );
		await vi.advanceTimersByTimeAsync( 1 );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );

		computer.attempts[ 1 ].fail( new Error( 'no answer' ) );
		await settle();
		await vi.advanceTimersByTimeAsync( 1_999 );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );
		await vi.advanceTimersByTimeAsync( 1 );
		expect( computer.connect ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'reconnects when the computer ends the stream', async () => {
		const computer = fakeComputer();
		const { statuses, onOpen } = start( computer );

		computer.attempts[ 0 ].connection.onOpen();
		computer.attempts[ 0 ].end();
		await settle();

		expect( statuses ).toEqual( [ 'connecting', 'live', 'reconnecting' ] );
		await vi.advanceTimersByTimeAsync( 1_000 );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );

		computer.attempts[ 1 ].connection.onOpen();
		expect( onOpen ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'keeps the waits growing for a computer that accepts the stream and closes it at once', async () => {
		const computer = fakeComputer();
		start( computer );

		computer.attempts[ 0 ].connection.onOpen();
		computer.attempts[ 0 ].end();
		await settle();
		await vi.advanceTimersByTimeAsync( 1_000 );
		computer.attempts[ 1 ].connection.onOpen();
		computer.attempts[ 1 ].end();
		await settle();

		await vi.advanceTimersByTimeAsync( 1_999 );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );
		await vi.advanceTimersByTimeAsync( 1 );
		expect( computer.connect ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'starts the waits again after the stream stayed open for ten seconds', async () => {
		const computer = fakeComputer();
		start( computer );

		computer.attempts[ 0 ].fail( new Error( 'no answer' ) );
		await settle();
		await vi.advanceTimersByTimeAsync( 1_000 );
		computer.attempts[ 1 ].connection.onOpen();
		await vi.advanceTimersByTimeAsync( 10_000 );
		computer.attempts[ 1 ].end();
		await settle();

		await vi.advanceTimersByTimeAsync( 1_000 );
		expect( computer.connect ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'drops a connection that does not open in twenty seconds and tries again', async () => {
		const computer = fakeComputer();
		const { statuses } = start( computer );
		const { connection, fail } = computer.attempts[ 0 ];
		connection.signal.addEventListener( 'abort', () => fail( new Error( 'aborted' ) ) );

		await vi.advanceTimersByTimeAsync( 19_999 );
		expect( connection.signal.aborted ).toBe( false );
		await vi.advanceTimersByTimeAsync( 1 );

		expect( connection.signal.aborted ).toBe( true );
		expect( statuses ).toEqual( [ 'connecting', 'reconnecting' ] );
		await vi.advanceTimersByTimeAsync( 1_000 );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'does not drop a connection that opened in time', async () => {
		const computer = fakeComputer();
		start( computer );
		computer.attempts[ 0 ].connection.onOpen();

		await vi.advanceTimersByTimeAsync( 60_000 );

		expect( computer.attempts[ 0 ].connection.signal.aborted ).toBe( false );
	} );

	it( 'reconnects now when asked, and ignores the connection it dropped', async () => {
		const computer = fakeComputer();
		const { stream, statuses, messages } = start( computer );
		computer.attempts[ 0 ].connection.onOpen();

		stream.reconnect();

		expect( computer.attempts[ 0 ].connection.signal.aborted ).toBe( true );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );

		// The dropped connection fails and still delivers text: both are ignored.
		computer.attempts[ 0 ].connection.onData( 'data: late\n\n' );
		computer.attempts[ 0 ].fail( new Error( 'aborted' ) );
		await settle();
		await vi.advanceTimersByTimeAsync( 60_000 );

		expect( messages ).toEqual( [] );
		expect( statuses ).toEqual( [ 'connecting', 'live' ] );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'skips the wait when asked to reconnect while it waits', async () => {
		const computer = fakeComputer();
		const { stream } = start( computer );
		computer.attempts[ 0 ].fail( new Error( 'no answer' ) );
		await settle();

		stream.reconnect();

		expect( computer.connect ).toHaveBeenCalledTimes( 2 );
		await vi.advanceTimersByTimeAsync( 60_000 );
		expect( computer.connect ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'stops for good on an error that another try cannot fix', async () => {
		const computer = fakeComputer();
		const refused = new Error( 'not paired' );
		const { stream, statuses } = start( computer, ( error ) => error === refused );

		computer.attempts[ 0 ].fail( refused );
		await settle();
		await vi.advanceTimersByTimeAsync( 60_000 );
		stream.reconnect();

		expect( statuses ).toEqual( [ 'connecting', 'stopped' ] );
		expect( computer.connect ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'drops the connection and stays quiet after stop', async () => {
		const computer = fakeComputer();
		const { stream, statuses } = start( computer );
		computer.attempts[ 0 ].connection.onOpen();

		stream.stop();
		computer.attempts[ 0 ].fail( new Error( 'aborted' ) );
		await settle();
		await vi.advanceTimersByTimeAsync( 60_000 );

		expect( computer.attempts[ 0 ].connection.signal.aborted ).toBe( true );
		expect( statuses ).toEqual( [ 'connecting', 'live' ] );
		expect( computer.connect ).toHaveBeenCalledTimes( 1 );
	} );
} );
