import { createValueStore } from '../lib/value-store';
import type { KeyValueStorage } from '../lib/storage';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'studio.color-scheme';

function isPreference( value: string | null ): value is ColorSchemePreference {
	return value === 'system' || value === 'light' || value === 'dark';
}

// The theme choice in Settings: follow the system, or always light or dark.
// `apply` hands the choice to the platform.
export function createColorSchemePreference(
	storage: KeyValueStorage,
	apply: ( preference: ColorSchemePreference ) => void
) {
	const store = createValueStore< ColorSchemePreference >( 'system' );

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
			if ( isPreference( stored ) ) {
				store.set( stored );
				apply( stored );
			}
		},
		async set( preference: ColorSchemePreference ): Promise< void > {
			store.set( preference );
			apply( preference );
			try {
				await storage.setItem( STORAGE_KEY, preference );
			} catch {
				// The choice still holds until the app closes.
			}
		},
	};
}
