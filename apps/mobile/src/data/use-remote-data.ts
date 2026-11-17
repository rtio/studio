import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { useMemo, useSyncExternalStore } from 'react';
import { createConnectionClient } from '../connection/connection';
import { listChats } from './chat-list';
import { activityStore, liveStatusStore } from './live-connection';
import { sessionsKey, sitesKey } from './query-keys';
import { parseSessions, parseSites } from './remote-schemas';
import type { ChatRow } from './chat-list';
import type { LiveStatus } from './live-status';
import type { Connection } from '../connection/connection-store';

// The sites of the paired computer. Events keep the list fresh while the
// stream is live (data/live-connection.ts).
export function useSites( connection: Connection ) {
	return useQuery( {
		queryKey: sitesKey( connection ),
		queryFn: async ( { signal } ) =>
			parseSites( await createConnectionClient( connection ).get( '/api/sites', { signal } ) ),
	} );
}

// The chats the drawer lists, with what each one is doing now. The computer
// reads every chat file for this answer, so the phone asks only when the
// stream opens and when a run starts or ends.
export function useChats( connection: Connection ): {
	chats: ChatRow[];
	isPending: boolean;
	isError: boolean;
	refetch: () => void;
} {
	const sessions = useQuery( {
		queryKey: sessionsKey( connection ),
		queryFn: async ( { signal } ) =>
			parseSessions(
				await createConnectionClient( connection ).get( '/api/sessions', { signal } )
			),
	} );
	const activity = useSyncExternalStore( activityStore.subscribe, activityStore.get );
	const untitled = __( 'New chat' );
	const chats = useMemo(
		() => listChats( sessions.data ?? [], activity, untitled ),
		[ sessions.data, activity, untitled ]
	);

	return {
		chats,
		isPending: sessions.isPending,
		isError: sessions.isError,
		refetch: () => void sessions.refetch(),
	};
}

export function useLiveStatus(): LiveStatus {
	return useSyncExternalStore( liveStatusStore.subscribe, liveStatusStore.get );
}
