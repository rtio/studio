import { AppState } from 'react-native';
import { UnauthorizedError } from '../connection/api-client';
import { createConnectionClient, reportUnauthorized } from '../connection/connection';
import { startEventStream } from '../connection/event-stream';
import { openEventStream } from '../connection/open-event-stream';
import { verifyComputer, WrongComputerError } from '../connection/verify-computer';
import { createValueStore } from '../lib/value-store';
import { withUpdatedSite } from './chat-list';
import { queryClient } from './query-client';
import { sessionsKey, sitesKey } from './query-keys';
import { parseActiveRuns, parseStreamMessage } from './remote-schemas';
import { activityFromActiveRuns, applyAgentEvent } from './run-activity';
import { resetSelection } from './selection';
import type { LiveStatus } from './live-status';
import type { Site } from './remote-schemas';
import type { ActivityMap } from './run-activity';
import type { Connection } from '../connection/connection-store';

export const liveStatusStore = createValueStore< LiveStatus >( 'off' );
export const activityStore = createValueStore< ActivityMap >( {} );

// The stream has no heartbeat: a dead connection is silent. While the stream
// is live, the phone asks the computer this often whether it still answers.
const LIVENESS_CHECK_MS = 15_000;

let live: { deviceId: string; reconnect: () => void; stop: () => void } | null = null;

function start( connection: Connection ) {
	const client = createConnectionClient( connection );

	// Everything the events keep fresh. The stream cannot replay what it missed,
	// so this runs each time it opens.
	async function reload() {
		void queryClient.invalidateQueries( { queryKey: sitesKey( connection ) } );
		void queryClient.invalidateQueries( { queryKey: sessionsKey( connection ) } );
		try {
			const runs = parseActiveRuns( await client.get( '/api/runs/active' ) );
			activityStore.set( activityFromActiveRuns( runs ) );
		} catch {
			// The stream fails too when the computer is gone, and then tries again.
		}
	}

	function handle( data: string ) {
		const message = parseStreamMessage( data );
		if ( ! message ) {
			return;
		}
		if ( message.channel === 'agent' ) {
			const { sessionId, event } = message.payload;
			activityStore.set(
				applyAgentEvent( activityStore.get(), sessionId, event.type, event.detail )
			);
			// A run changes the list of chats: a new chat appears, a title arrives,
			// the order changes.
			if ( event.type === 'run.started' || event.type === 'run.exited' ) {
				void queryClient.invalidateQueries( { queryKey: sessionsKey( connection ) } );
			}
			return;
		}
		const { event, site } = message.payload;
		if ( event === 'site-updated' && site ) {
			queryClient.setQueryData< Site[] >( sitesKey( connection ), ( sites ) =>
				sites ? withUpdatedSite( sites, site ) : sites
			);
		} else if ( event === 'site-created' || event === 'site-deleted' ) {
			void queryClient.invalidateQueries( { queryKey: sitesKey( connection ) } );
		}
	}

	const stream = startEventStream( {
		connect: async ( streamConnection ) => {
			// Who answers at the paired address? Asked without the token, so the
			// token only goes to the paired computer.
			await verifyComputer( connection, fetch, streamConnection.signal );
			try {
				await openEventStream( connection, streamConnection );
			} catch ( error ) {
				if ( error instanceof UnauthorizedError ) {
					reportUnauthorized( connection );
				}
				throw error;
			}
		},
		onMessage: handle,
		onOpen: () => void reload(),
		onStatus: ( status, error ) => {
			if ( status === 'stopped' ) {
				liveStatusStore.set( 'off' );
			} else if ( status === 'reconnecting' && error instanceof WrongComputerError ) {
				liveStatusStore.set( 'wrong-computer' );
			} else {
				liveStatusStore.set( status );
			}
		},
		isFatal: ( error ) => error instanceof UnauthorizedError,
	} );

	const liveness = setInterval( () => {
		if ( liveStatusStore.get() !== 'live' ) {
			return;
		}
		client.get( '/api/health' ).catch( ( error: unknown ) => {
			if ( error instanceof UnauthorizedError || liveStatusStore.get() !== 'live' ) {
				return;
			}
			liveStatusStore.set( 'reconnecting' );
			stream.reconnect();
		} );
	}, LIVENESS_CHECK_MS );

	// The system can freeze the app in the background and drop the stream
	// without a word. Connect again when the app comes back.
	const appState = AppState.addEventListener( 'change', ( state ) => {
		if ( state === 'active' ) {
			stream.reconnect();
		}
	} );

	return {
		deviceId: connection.deviceId,
		reconnect: stream.reconnect,
		stop: () => {
			stream.stop();
			clearInterval( liveness );
			appState.remove();
		},
	};
}

// Starts, replaces or stops the live connection so it matches the paired
// computer. Call it whenever the connection changes.
export function syncLiveConnection( connection: Connection | null ): void {
	if ( ( live?.deviceId ?? null ) === ( connection?.deviceId ?? null ) ) {
		return;
	}
	live?.stop();
	live = null;
	activityStore.set( {} );
	resetSelection();
	if ( ! connection ) {
		liveStatusStore.set( 'off' );
		return;
	}
	live = start( connection );
}

// Tries the computer again now. For a "Try again" button.
export function reconnectNow(): void {
	live?.reconnect();
}
