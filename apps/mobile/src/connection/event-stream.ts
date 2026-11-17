import { backoffDelay } from './backoff';
import { createSseParser } from './sse-parser';

// `connecting` is the first try. `reconnecting` means the stream was lost or
// could not open, and the next try is scheduled. `stopped` is final.
export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'stopped';

export interface StreamConnection {
	// Aborts when this connection must end.
	signal: AbortSignal;
	// Call when the computer accepted the stream.
	onOpen: () => void;
	// Call with each piece of decoded text as it arrives.
	onData: ( chunk: string ) => void;
}

export interface EventStreamOptions {
	// Opens one connection. It resolves when the computer ends the stream and
	// rejects when the connection fails. On a phone this is a streaming fetch.
	connect: ( connection: StreamConnection ) => Promise< void >;
	// One event from the computer: the text of its `data:` lines.
	onMessage: ( data: string ) => void;
	// The stream has no resume cursor, so everything it missed is lost. This is
	// called each time a connection opens: reload what the events keep fresh.
	onOpen: () => void;
	// `error` is why the stream is reconnecting or stopped, when there is one.
	onStatus: ( status: StreamStatus, error?: unknown ) => void;
	// True for an error that another try cannot fix.
	isFatal: ( error: unknown ) => boolean;
}

export interface EventStream {
	// Drops the current connection or wait, and connects now.
	reconnect: () => void;
	stop: () => void;
}

// A connection that has not opened after this long is dropped. Without it, a
// computer that takes the request and never answers would leave the phone
// "connecting" for ever.
const OPEN_TIMEOUT_MS = 20_000;

// A stream that stayed open this long was a good connection.
const STABLE_AFTER_MS = 10_000;

// Keeps one event stream open to the computer. When the stream ends or fails
// it tries again, after 1 s at first and up to 30 s between later tries.
export function startEventStream( options: EventStreamOptions ): EventStream {
	let stopped = false;
	let failures = 0;
	// Each connection has a number. Callbacks of an older connection are ignored.
	let current = 0;
	let controller: AbortController | null = null;
	let timer: ReturnType< typeof setTimeout > | null = null;
	let openTimer: ReturnType< typeof setTimeout > | null = null;

	function connect() {
		const mine = ++current;
		const attempt = new AbortController();
		controller = attempt;
		let openedAt: number | null = null;
		openTimer = setTimeout( () => attempt.abort(), OPEN_TIMEOUT_MS );
		const parser = createSseParser( ( event ) => {
			if ( mine === current ) {
				options.onMessage( event.data );
			}
		} );

		void options
			.connect( {
				signal: attempt.signal,
				onOpen: () => {
					if ( mine === current ) {
						if ( openTimer ) {
							clearTimeout( openTimer );
						}
						openedAt = Date.now();
						options.onStatus( 'live' );
						options.onOpen();
					}
				},
				onData: ( chunk ) => {
					if ( mine === current ) {
						parser.push( chunk );
					}
				},
			} )
			.then(
				() => undefined,
				( error: unknown ) => error
			)
			.then( ( error ) => {
				if ( mine !== current ) {
					return;
				}
				if ( error !== undefined && options.isFatal( error ) ) {
					stopped = true;
					options.onStatus( 'stopped', error );
					return;
				}
				if ( openTimer ) {
					clearTimeout( openTimer );
				}
				// Start the waits again only after a connection that lasted. A computer
				// that accepts the stream and closes it at once would otherwise be
				// asked every second, and each open reloads the lists.
				if ( openedAt !== null && Date.now() - openedAt >= STABLE_AFTER_MS ) {
					failures = 0;
				}
				options.onStatus( 'reconnecting', error );
				timer = setTimeout( connect, backoffDelay( failures ) );
				failures += 1;
			} );
	}

	function dropCurrent() {
		current += 1;
		if ( timer ) {
			clearTimeout( timer );
			timer = null;
		}
		if ( openTimer ) {
			clearTimeout( openTimer );
			openTimer = null;
		}
		controller?.abort();
	}

	options.onStatus( 'connecting' );
	connect();

	return {
		reconnect: () => {
			if ( stopped ) {
				return;
			}
			dropCurrent();
			failures = 0;
			connect();
		},
		stop: () => {
			stopped = true;
			dropCurrent();
		},
	};
}
