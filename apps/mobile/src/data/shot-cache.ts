import { siteShotsKey, storedShotKey } from './query-keys';
import type { Connection } from '../connection/connection-store';
import type { QueryClient } from '@tanstack/react-query';

// The preview sheet opens on a site: the screenshots in the cache are out of
// date. Nothing is fetched here. The sheet takes the one it shows as it opens,
// once, and the other layout when the person switches to it.
export function openSiteShots( client: QueryClient, connection: Connection, siteId: string ): void {
	for ( const queryKey of [
		siteShotsKey( connection, siteId ),
		storedShotKey( connection, siteId ),
	] ) {
		void client.invalidateQueries( { queryKey, refetchType: 'none' } );
	}
}
