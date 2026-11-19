import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useState } from 'react';
import { liveStatusStore } from '../../data/live-connection';
import { useLiveStatus, useSiteShot, useStoredShot } from '../../data/use-remote-data';
import { formatAge, isStopped, previewView } from './preview-view';
import type { Connection } from '../../connection/connection-store';
import type { Site } from '../../data/remote-schemas';
import type { ShotLayout } from '../../data/site-shot';

export const layoutChoices = (): ReadonlyArray< { value: ShotLayout; label: string } > => [
	{ value: 'phone', label: __( 'Phone' ) },
	{ value: 'desktop', label: __( 'Desktop' ) },
];

// The time now, once a second while `ticking`.
function useNow( ticking: boolean ): number {
	const [ now, setNow ] = useState( Date.now );
	useEffect( () => {
		if ( ! ticking ) {
			return;
		}
		setNow( Date.now() );
		const timer = setInterval( () => setNow( Date.now() ), 1000 );
		return () => clearInterval( timer );
	}, [ ticking ] );
	return now;
}

// What the preview sheet shows for a site while it is open, for both sheets.
// The sheet opens with `showSitePreview`, which marks the shots out of date:
// a shot is taken as the sheet shows it.
export function useSitePreview(
	connection: Connection,
	site: Site,
	layout: ShotLayout,
	open: boolean
) {
	const live = useLiveStatus() === 'live';
	const shot = useSiteShot( connection, site.id, layout, open && site.running );
	const stopped = isStopped( { running: site.running, shot } );
	const stored = useStoredShot( connection, site.id, open && stopped );
	const view = previewView( { running: site.running, live, shot, stored } );
	const fresh = view.kind === 'image' && ! view.stopped;
	const now = useNow( open && fresh );

	// Under the screenshot: how old it is, or that it is the stored one of a
	// stopped site. The body says why when there is no screenshot.
	let note: string | null = null;
	if ( view.kind === 'image' && view.stopped ) {
		note = __( 'Site is stopped' );
	} else if ( fresh ) {
		/* translators: %s: how long ago the screenshot came, as a clock, like 0:12. */
		note = sprintf( __( 'Updated %s ago' ), formatAge( now - shot.dataUpdatedAt ) );
	}

	return {
		view,
		// A stopped site has only the desktop app's stored shot, in its desktop
		// layout.
		stopped,
		note,
		taking: shot.isFetching,
		canRefresh: live && ! stopped,
		refresh: () => {
			// `refetch` ignores `enabled`, and the request sends the device token:
			// check the link here.
			if ( liveStatusStore.get() === 'live' ) {
				void shot.refetch();
			}
		},
	};
}
