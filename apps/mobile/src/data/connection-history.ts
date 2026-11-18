import { createValueStore } from '../lib/value-store';
import type { LiveStatus } from './live-status';

// When the link to the computer was last live, and its last problem, for the
// connection details in Settings.
export interface ConnectionHistory {
	// When the link stopped being live, the last time it did. While it is
	// live, it is live now.
	lastLiveAt: number | null;
	lastProblem: { status: 'reconnecting' | 'wrong-computer'; at: number } | null;
}

const NO_HISTORY: ConnectionHistory = { lastLiveAt: null, lastProblem: null };

export function createConnectionHistory( now: () => number ) {
	const store = createValueStore< ConnectionHistory >( NO_HISTORY );
	let previous: LiveStatus | null = null;

	return {
		store,
		// The link changed to `status`.
		note( status: LiveStatus ) {
			let next = store.get();
			if ( previous === 'live' && status !== 'live' ) {
				next = { ...next, lastLiveAt: now() };
			}
			if ( ( status === 'reconnecting' || status === 'wrong-computer' ) && status !== previous ) {
				next = { ...next, lastProblem: { status, at: now() } };
			}
			store.set( next );
			previous = status;
		},
		// Another computer, or none.
		clear() {
			previous = null;
			store.set( NO_HISTORY );
		},
	};
}
