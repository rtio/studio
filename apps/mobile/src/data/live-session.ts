import { UnauthorizedError } from '../connection/api-client';
import { startEventStream } from '../connection/event-stream';
import { WrongComputerError } from '../connection/verify-computer';
import { parseStreamMessage } from './remote-schemas';
import { activityFromActiveRuns, applyAgentEvent } from './run-activity';
import type { ChatEvent } from './chat-reply';
import type { LiveStatus } from './live-status';
import type { ActiveRun, Site } from './remote-schemas';
import type { ActivityMap, AgentEventInfo } from './run-activity';
import type { StreamConnection } from '../connection/event-stream';
import type { ValueStore } from '../lib/value-store';

// The stream has no heartbeat: a dead connection is silent. While the stream
// is live, the phone asks this often who answers at the paired address.
const LIVENESS_CHECK_MS = 15_000;

// A stream with no data for this long is opened again. The check above reaches
// the computer over the current network route. The stream can sit on an old
// route that died without a word (Wi-Fi to VPN, for example), and then only
// its silence shows it.
const SILENCE_LIMIT_MS = 5 * 60_000;

// What the session needs from the phone. Three of these send the device token:
// `openStream`, `loadActiveRuns`, and whatever the phone does when the status
// is `live`. The session calls the first two only after `verify` passed for
// the same try.
export interface LiveSessionParts {
	status: ValueStore< LiveStatus >;
	activity: ValueStore< ActivityMap >;
	// Asks who answers at the paired address, without the token. Rejects with
	// WrongComputerError or UnreachableError.
	verify: ( signal?: AbortSignal ) => Promise< void >;
	// Opens the event stream. Sends the token.
	openStream: ( stream: StreamConnection ) => Promise< void >;
	// Reads `GET /api/runs/active`. Sends the token.
	loadActiveRuns: () => Promise< ActiveRun[] >;
	// The computer answered 401 to the stream: this phone is not paired any more.
	onUnauthorized: () => void;
	// The stream opened. It cannot replay what it missed: read the lists again.
	onListsStale: () => void;
	// A run started or ended, which changes the list of chats.
	onChatsStale: () => void;
	onSiteUpdated: ( site: Site ) => void;
	onSiteAddedOrRemoved: ( event: 'site-created' | 'site-deleted', siteId: string ) => void;
	// The chat that is open on the phone, if any. Its events go to
	// `onChatEvent` too.
	openChatId: () => string | null;
	onChatEvent: ( chatId: string, event: ChatEvent ) => void;
	// Every agent event of every chat, for the run control (data/run-control.ts).
	onRunEvent: ( chatId: string, event: ChatEvent ) => void;
	// The runs are read again: right before the request, then with what the
	// computer listed. The run control keeps what newer events said.
	onActiveRunsRead: () => void;
	onActiveRuns: ( runs: ActiveRun[] ) => void;
}

export interface LiveSession {
	// Drops the stream and connects again now.
	reconnect: () => void;
	stop: () => void;
}

// Keeps the phone in step with the paired computer: one event stream, the
// state that events keep fresh, and the checks that notice a dead link.
export function startLiveSession( parts: LiveSessionParts ): LiveSession {
	const { status, activity } = parts;
	let stopped = false;
	// Counts the times the stream opened. Work that started before the latest
	// open is out of date when it ends.
	let opens = 0;
	let lastDataAt = Date.now();
	// The agent events that arrive while the active runs are read. They are
	// newer than that answer, so they are applied again on top of it.
	let duringReload: AgentEventInfo[] | null = null;

	async function reload() {
		const mine = opens;
		duringReload = [];
		parts.onListsStale();
		parts.onActiveRunsRead();
		let runs: ActiveRun[] | null = null;
		try {
			runs = await parts.loadActiveRuns();
		} catch {
			// The stream fails too when the computer is gone, and then tries again.
		}
		if ( stopped || mine !== opens ) {
			return;
		}
		const newer = duringReload;
		duringReload = null;
		if ( runs ) {
			activity.set( newer.reduce( applyAgentEvent, activityFromActiveRuns( runs ) ) );
			parts.onActiveRuns( runs );
		}
	}

	function handle( data: string ) {
		if ( stopped ) {
			return;
		}
		const message = parseStreamMessage( data );
		if ( ! message ) {
			return;
		}
		if ( message.channel === 'agent' ) {
			const { sessionId, runId, event } = message.payload;
			const at = event.timestamp ? Date.parse( event.timestamp ) : NaN;
			const info: AgentEventInfo = {
				sessionId,
				runId,
				type: event.type,
				detail: event.inner?.type,
				at: Number.isNaN( at ) ? undefined : at,
			};
			const chatEvent: ChatEvent = {
				runId,
				type: event.type,
				timestamp: event.timestamp,
				inner: event.inner,
				text: event.text,
				questions: event.questions,
			};
			duringReload?.push( info );
			activity.set( applyAgentEvent( activity.get(), info ) );
			if ( event.type === 'run.started' || event.type === 'run.exited' ) {
				parts.onChatsStale();
			}
			if ( sessionId === parts.openChatId() ) {
				parts.onChatEvent( sessionId, chatEvent );
			}
			parts.onRunEvent( sessionId, chatEvent );
			return;
		}
		const { event, siteId, site } = message.payload;
		if ( event === 'site-updated' && site ) {
			parts.onSiteUpdated( site );
		} else if ( event === 'site-created' || event === 'site-deleted' ) {
			parts.onSiteAddedOrRemoved( event, siteId );
		}
	}

	const stream = startEventStream( {
		connect: async ( connection ) => {
			await parts.verify( connection.signal );
			try {
				await parts.openStream( {
					signal: connection.signal,
					onOpen: connection.onOpen,
					onData: ( chunk ) => {
						lastDataAt = Date.now();
						connection.onData( chunk );
					},
				} );
			} catch ( error ) {
				if ( error instanceof UnauthorizedError && ! stopped ) {
					parts.onUnauthorized();
				}
				throw error;
			}
		},
		onMessage: handle,
		onOpen: () => {
			opens += 1;
			lastDataAt = Date.now();
			void reload();
		},
		onStatus: ( streamStatus, error ) => {
			if ( stopped ) {
				return;
			}
			if ( streamStatus === 'stopped' ) {
				status.set( 'off' );
			} else if ( streamStatus === 'reconnecting' && error instanceof WrongComputerError ) {
				status.set( 'wrong-computer' );
			} else {
				status.set( streamStatus );
			}
		},
		isFatal: ( error ) => error instanceof UnauthorizedError,
	} );

	const liveness = setInterval( () => {
		if ( status.get() !== 'live' ) {
			return;
		}
		if ( Date.now() - lastDataAt >= SILENCE_LIMIT_MS ) {
			// The new connection gets the full time before it counts as silent.
			lastDataAt = Date.now();
			stream.reconnect();
			return;
		}
		const mine = opens;
		parts.verify().catch( ( error: unknown ) => {
			// A check that started before the latest open says nothing about it.
			if ( stopped || mine !== opens || status.get() !== 'live' ) {
				return;
			}
			status.set( error instanceof WrongComputerError ? 'wrong-computer' : 'reconnecting' );
			stream.reconnect();
		} );
	}, LIVENESS_CHECK_MS );

	return {
		reconnect: () => {
			if ( ! stopped ) {
				stream.reconnect();
			}
		},
		stop: () => {
			stopped = true;
			clearInterval( liveness );
			stream.stop();
		},
	};
}
