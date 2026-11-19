import type { ShotLayout } from './site-shot';
import type { Connection } from '../connection/connection-store';

// The cache keys of what the phone reads from the computer. Each key holds the
// device id, so data of an older pairing is never shown for a new one.
export const sitesKey = ( connection: Connection ) => [ 'sites', connection.deviceId ] as const;
export const sessionsKey = ( connection: Connection ) =>
	[ 'sessions', connection.deviceId ] as const;
// One chat with its saved entries. Not under `sessions`, so a new read of the
// list does not read the open chat again.
export const chatKey = ( connection: Connection, chatId: string ) =>
	[ 'chat', connection.deviceId, chatId ] as const;
// The screenshots of one running site, by layout, for the preview sheet. The
// prefix without the layout marks both out of date at once.
export const siteShotsKey = ( connection: Connection, siteId: string ) =>
	[ 'site-shot', connection.deviceId, siteId ] as const;
export const siteShotKey = ( connection: Connection, siteId: string, layout: ShotLayout ) =>
	[ ...siteShotsKey( connection, siteId ), layout ] as const;
// The screenshot the desktop app stored for a site, shown while it is stopped.
export const storedShotKey = ( connection: Connection, siteId: string ) =>
	[ 'stored-shot', connection.deviceId, siteId ] as const;
