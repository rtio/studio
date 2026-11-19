import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { useMemo, useSyncExternalStore } from 'react';
import { createConnectionClient } from '../connection/connection';
import { listChats } from './chat-list';
import { activityStore, liveStatusStore } from './live-connection';
import { sessionsKey, siteShotKey, sitesKey, storedShotKey } from './query-keys';
import { parseSessions, parseSites } from './remote-schemas';
import { parseShot, parseStoredShot } from './site-shot';
import type { ChatRow } from './chat-list';
import type { LiveStatus } from './live-status';
import type { ShotLayout } from './site-shot';
import type { Connection } from '../connection/connection-store';

// These requests carry the device token. They run only while the link is
// live, which means the phone has just checked that the paired computer is the
// one that answers. They never run by themselves: the live connection says
// when a list is out of date (data/live-connection.ts).
function useWhileLive() {
	return { enabled: useLiveStatus() === 'live', staleTime: Infinity };
}

// The sites of the paired computer.
export function useSites( connection: Connection ) {
	return useQuery( {
		...useWhileLive(),
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
		...useWhileLive(),
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
		refetch: () => {
			// `refetch` ignores `enabled`, and the read sends the device token:
			// check the link here.
			if ( liveStatusStore.get() === 'live' ) {
				void sessions.refetch();
			}
		},
	};
}

// A screenshot of a running site in a layout, for the preview sheet. It is
// taken only while the sheet shows it (`enabled`), when it has none, and
// again when the shots are out of date (`showSitePreview`, the stream, the
// refresh button). `dataUpdatedAt` is when it came.
export function useSiteShot(
	connection: Connection,
	siteId: string,
	layout: ShotLayout,
	enabled: boolean
) {
	const whileLive = useWhileLive();
	return useQuery( {
		...whileLive,
		enabled: whileLive.enabled && enabled,
		queryKey: siteShotKey( connection, siteId, layout ),
		queryFn: async () =>
			parseShot(
				await createConnectionClient( connection ).post(
					`/api/sites/${ encodeURIComponent( siteId ) }/screenshot`,
					{ layout }
				)
			),
	} );
}

// The screenshot the desktop app stored for a site, for the preview sheet
// while the site is stopped.
export function useStoredShot( connection: Connection, siteId: string, enabled: boolean ) {
	const whileLive = useWhileLive();
	return useQuery( {
		...whileLive,
		enabled: whileLive.enabled && enabled,
		queryKey: storedShotKey( connection, siteId ),
		queryFn: async ( { signal } ) =>
			parseStoredShot(
				await createConnectionClient( connection ).get(
					`/api/sites/${ encodeURIComponent( siteId ) }/thumbnail`,
					{ signal }
				)
			),
	} );
}

export function useLiveStatus(): LiveStatus {
	return useSyncExternalStore( liveStatusStore.subscribe, liveStatusStore.get );
}
