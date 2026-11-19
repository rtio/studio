import type { SiteShot } from '../../data/site-shot';

// What the preview sheet shows: a screenshot, or the logo with a state.
export type PreviewView =
	// `stopped`: the computer's stored screenshot of a stopped site.
	| { kind: 'image'; image: string; stopped: boolean }
	| { kind: 'taking' }
	| { kind: 'stopped' }
	| { kind: 'no-browser' }
	| { kind: 'failed' }
	| { kind: 'offline' };

export interface PreviewInputs {
	// What the sites list says.
	running: boolean;
	live: boolean;
	// The latest answers to the screenshot and the stored screenshot, as the
	// query cache holds them: an answer stays when a later request gets none.
	// `isFetching`: a new screenshot is being taken.
	shot: { data?: SiteShot; isError: boolean; isFetching: boolean };
	stored: { data?: string | null; isError: boolean };
}

// The computer can find a site stopped that the list still shows running.
export function isStopped( { running, shot }: Pick< PreviewInputs, 'running' | 'shot' > ) {
	return ! running || ( shot.data?.image === null && shot.data.reason === 'stopped' );
}

export function previewView( inputs: PreviewInputs ): PreviewView {
	const { live, shot, stored } = inputs;
	if ( isStopped( inputs ) ) {
		if ( stored.data ) {
			return { kind: 'image', image: stored.data, stopped: true };
		}
		return stored.data === undefined && ! stored.isError && live
			? { kind: 'taking' }
			: { kind: 'stopped' };
	}
	if ( shot.data?.image ) {
		return { kind: 'image', image: shot.data.image, stopped: false };
	}
	// Trying again after a failure shows that it is trying.
	if ( shot.isFetching && live ) {
		return { kind: 'taking' };
	}
	if ( shot.data?.image === null && shot.data.reason === 'no-browser' ) {
		return { kind: 'no-browser' };
	}
	if ( shot.data || shot.isError ) {
		return { kind: 'failed' };
	}
	return live ? { kind: 'taking' } : { kind: 'offline' };
}

// How long ago a screenshot came, as a clock: 0:12, 4:05, 1:02:03.
export function formatAge( ms: number ): string {
	const seconds = Math.max( 0, Math.floor( ms / 1000 ) );
	const pad = ( value: number ) => String( value ).padStart( 2, '0' );
	const hours = Math.floor( seconds / 3600 );
	const minutes = Math.floor( ( seconds % 3600 ) / 60 );
	const rest = pad( seconds % 60 );
	return hours > 0 ? `${ hours }:${ pad( minutes ) }:${ rest }` : `${ minutes }:${ rest }`;
}
