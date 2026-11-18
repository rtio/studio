import { uuid } from 'expo';
import { AppState } from 'react-native';
import { z } from 'zod';
import { createConnectionClient, reportUnauthorized } from '../connection/connection';
import { openEventStream } from '../connection/open-event-stream';
import { verifyComputer } from '../connection/verify-computer';
import { playHaptic } from '../feedback/haptics';
import { createValueStore } from '../lib/value-store';
import { withUpdatedSite } from './chat-list';
import { requestChatRead } from './chat-read';
import { drafts } from './drafts';
import { createHapticMoments } from './haptic-moments';
import { startLiveSession } from './live-session';
import { createOpenChat } from './open-chat';
import { queryClient } from './query-client';
import { chatKey, sessionsKey, sitesKey } from './query-keys';
import { parseActiveRuns } from './remote-schemas';
import { createRunControl } from './run-control';
import {
	resetSelection,
	selectChat,
	selectedChatId,
	selectedSiteId,
	selectSite,
	subscribeSelectedChat,
} from './selection';
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

// Sends, queues, stops and answers. A request goes to the paired computer
// only while the link is live.
export const runControl = createRunControl( {
	post: ( path, body ) => {
		if ( ! live || liveStatusStore.get() !== 'live' ) {
			return Promise.reject( new Error( 'Not connected' ) );
		}
		return createConnectionClient( live.connection ).post( path, body );
	},
	isLive: () => live !== null && liveStatusStore.get() === 'live',
	newTurnId: () => uuid.v4(),
	now: Date.now,
	showPrompt: ( chatId, text ) => openChat.showPrompt( chatId, text ),
	dropPrompt: ( chatId, key ) => openChat.dropPrompt( chatId, key ),
} );

// Which events of the stream the person feels.
const hapticMoments = createHapticMoments();

// The open chat changes as soon as the person chooses a chat, before the
// screen draws it, so a prompt sent to a chat just created shows in it.
subscribeSelectedChat( () => {
	const chatId = selectedChatId();
	if ( chatId ) {
		openChat.select( chatId );
	} else {
		openChat.clear();
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
		onRunEvent: ( chatId, event ) => {
			const moment = hapticMoments.moment( event );
			if ( moment ) {
				playHaptic( moment );
			}
			runControl.handle( chatId, event );
		},
		onActiveRunsRead: runControl.beginHydrate,
		onActiveRuns: runControl.hydrate,
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
	hapticMoments.clear();
	openChat.clear();
	runControl.clear();
	drafts.clear();
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

const createdChatSchema = z.object( { id: z.string() } );

// Makes a chat for the site on the computer, names it through `onChatMade`,
// opens it, and sends it the first prompt. Rejects when either step failed; a
// chat that was made stays open.
export async function startChat(
	siteId: string,
	text: string,
	onChatMade: ( chatId: string ) => void
): Promise< void > {
	if ( ! text.trim() ) {
		return;
	}
	if ( ! live || liveStatusStore.get() !== 'live' ) {
		throw new Error( 'Not connected' );
	}
	const created = await createConnectionClient( live.connection ).post( '/api/sessions', {
		siteId,
	} );
	const { id } = createdChatSchema.parse( created );
	onChatMade( id );
	selectChat( id );
	await runControl.send( id, text );
}
