import { AppState } from 'react-native';
import { createConnectionClient, reportUnauthorized } from '../connection/connection';
import { openEventStream } from '../connection/open-event-stream';
import { verifyComputer } from '../connection/verify-computer';
import { createValueStore } from '../lib/value-store';
import { withUpdatedSite } from './chat-list';
import { requestChatRead } from './chat-read';
import { startLiveSession } from './live-session';
import { createOpenChat } from './open-chat';
import { queryClient } from './query-client';
import { chatKey, sessionsKey, sitesKey } from './query-keys';
import { parseActiveRuns } from './remote-schemas';
import { resetSelection, selectedChatId, selectedSiteId, selectSite } from './selection';
import type { LiveStatus } from './live-status';
import type { Site } from './remote-schemas';
import type { ActivityMap } from './run-activity';
import type { Connection } from '../connection/connection-store';

export const liveStatusStore = createValueStore< LiveStatus >( 'off' );
export const activityStore = createValueStore< ActivityMap >( {} );

let live: {
	connection: Connection;
	reconnect: () => void;
	stop: () => void;
} | null = null;

// What the stream adds to the open chat. A read it asks for goes to the
// paired computer only while the link is live (data/chat-read.ts).
export const openChat = createOpenChat( ( chatId ) => {
	if ( live ) {
		void requestChatRead( queryClient, chatKey( live.connection, chatId ) );
	}
} );

// Gives the live session (data/live-session.ts) its parts on a phone: the
// requests, the query cache and the app's state.
function start( connection: Connection ) {
	const client = createConnectionClient( connection );

	const session = startLiveSession( {
		status: liveStatusStore,
		activity: activityStore,
		verify: ( signal ) => verifyComputer( connection, fetch, signal ),
		openStream: ( stream ) => openEventStream( connection, stream ),
		loadActiveRuns: async () => parseActiveRuns( await client.get( '/api/runs/active' ) ),
		onUnauthorized: () => reportUnauthorized( connection ),
		onListsStale: () => {
			void queryClient.invalidateQueries( { queryKey: sitesKey( connection ) } );
			void queryClient.invalidateQueries( { queryKey: sessionsKey( connection ) } );
			openChat.resync();
		},
		onChatsStale: () => {
			void queryClient.invalidateQueries( { queryKey: sessionsKey( connection ) } );
		},
		onSiteUpdated: ( site ) => {
			const queryKey = sitesKey( connection );
			queryClient.setQueryData< Site[] >( queryKey, ( sites ) =>
				sites ? withUpdatedSite( sites, site ) : sites
			);
			// A read of the sites that is on its way started before this event,
			// and its answer would put the old state back. Read again.
			if ( queryClient.isFetching( { queryKey } ) > 0 ) {
				void queryClient.invalidateQueries( { queryKey } );
			}
		},
		onSiteAddedOrRemoved: ( event, siteId ) => {
			if ( event === 'site-deleted' && selectedSiteId() === siteId ) {
				selectSite( null );
			}
			void queryClient.invalidateQueries( { queryKey: sitesKey( connection ) } );
		},
		openChatId: selectedChatId,
		onChatEvent: openChat.handle,
	} );

	// The system can freeze the app in the background and drop the stream
	// without a word. Connect again when the app comes back from there. A short
	// "inactive" (the app switcher, Control Center) does not need it.
	let wasInBackground = false;
	const appState = AppState.addEventListener( 'change', ( state ) => {
		if ( state === 'background' ) {
			wasInBackground = true;
		} else if ( state === 'active' && wasInBackground ) {
			wasInBackground = false;
			session.reconnect();
		}
	} );

	return {
		connection,
		reconnect: session.reconnect,
		stop: () => {
			session.stop();
			appState.remove();
		},
	};
}

// Starts, replaces or stops the live connection so it matches the paired
// computer. Call it whenever the connection changes.
export function syncLiveConnection( connection: Connection | null ): void {
	if ( ( live?.connection.deviceId ?? null ) === ( connection?.deviceId ?? null ) ) {
		return;
	}
	live?.stop();
	live = null;
	activityStore.set( {} );
	openChat.clear();
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
