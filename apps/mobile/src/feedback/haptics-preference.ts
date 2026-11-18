import { createValueStore } from '../lib/value-store';
import type { KeyValueStorage } from '../lib/storage';

const STORAGE_KEY = 'studio.haptics';

// Whether the phone taps back when a message goes out, when the agent needs an
// answer, and when it finishes. On until the person turns it off in Settings.
export function createHapticsPreference( storage: KeyValueStorage ) {
	const store = createValueStore< boolean >( true );

	return {
		get: store.get,
		subscribe: store.subscribe,
		async load(): Promise< void > {
			let stored: string | null = null;
			try {
				stored = await storage.getItem( STORAGE_KEY );
			} catch {
				// Storage that cannot be read means no choice was saved.
			}
			if ( stored === 'on' || stored === 'off' ) {
				store.set( stored === 'on' );
			}
		},
		async set( on: boolean ): Promise< void > {
			store.set( on );
			try {
				await storage.setItem( STORAGE_KEY, on ? 'on' : 'off' );
			} catch {
				// The choice still holds until the app closes.
			}
		},
	};
}
