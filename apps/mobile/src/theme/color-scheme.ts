import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { secureStorage } from '../lib/secure-storage';
import { createColorSchemePreference } from './color-scheme-preference';
import type { ColorSchemePreference } from './color-scheme-preference';

// The app's theme choice. React Native applies it to every screen and to the
// native controls.
export const colorSchemePreference = createColorSchemePreference( secureStorage, ( preference ) => {
	Appearance.setColorScheme( preference === 'system' ? 'unspecified' : preference );
} );

export function useColorSchemePreference(): ColorSchemePreference {
	return useSyncExternalStore( colorSchemePreference.subscribe, colorSchemePreference.get );
}
