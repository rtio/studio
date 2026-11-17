import { AccessibilityInfo } from 'react-native';
import { createValueStore } from '../lib/value-store';

// The system's "Reduce Transparency" setting, read once for the whole app. Every
// floating surface reads this store, so they all agree from the first frame.
export const reduceTransparencyStore = createValueStore( false );

// Reads the setting and follows later changes. The app waits for this before it
// draws a screen (startup.ts).
export async function watchReduceTransparency(): Promise< void > {
	AccessibilityInfo.addEventListener( 'reduceTransparencyChanged', ( enabled ) => {
		reduceTransparencyStore.set( enabled );
	} );
	try {
		reduceTransparencyStore.set( await AccessibilityInfo.isReduceTransparencyEnabled() );
	} catch {
		// Keep the default: transparency is allowed.
	}
}
