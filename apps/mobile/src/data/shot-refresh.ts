// When the preview sheet takes a new screenshot by itself. While it shows site
// S, the agent changed S when it reloads S's preview (`preview.reload`) or
// when a run in a chat of S ends (`run.exited`). Then the shots of S are out
// of date: `refresh` marks them so and the sheet takes the one it shows. At
// most once a second: an event within a second of the last refresh waits for
// the end of that second.

export interface ShotRefreshParts {
	// The site of a chat, if the phone knows it.
	siteOfChat: ( chatId: string ) => string | undefined;
	refresh: ( siteId: string ) => void;
	now?: () => number;
}

const CHANGES = new Set( [ 'preview.reload', 'run.exited' ] );
const GAP_MS = 1000;

export function createShotRefresh( { siteOfChat, refresh, now = Date.now }: ShotRefreshParts ) {
	let shown: string | null = null;
	let lastAt = -Infinity;
	let timer: ReturnType< typeof setTimeout > | null = null;

	function cancel() {
		if ( timer ) {
			clearTimeout( timer );
			timer = null;
		}
	}

	function fire() {
		timer = null;
		if ( shown ) {
			lastAt = now();
			refresh( shown );
		}
	}

	return {
		// The site the sheet shows, or null when it is closed.
		show( siteId: string | null ) {
			if ( siteId !== shown ) {
				cancel();
				shown = siteId;
			}
		},
		handle( chatId: string, event: { type: string } ) {
			if ( ! shown || ! CHANGES.has( event.type ) || siteOfChat( chatId ) !== shown || timer ) {
				return;
			}
			const wait = lastAt + GAP_MS - now();
			if ( wait <= 0 ) {
				fire();
			} else {
				timer = setTimeout( fire, wait );
			}
		},
	};
}
