import { connectionStore } from './connection/connection';
import { hapticsPreference } from './feedback/haptics';
import { colorSchemePreference } from './theme/color-scheme';
import { watchReduceTransparency } from './ui/reduce-transparency';

let started: Promise< void > | undefined;

// Everything the app reads before it draws its first screen: the paired
// computer, the theme and haptics choices and the Reduce Transparency setting.
// Safe to call more than once.
export function startApp(): Promise< void > {
	started ??= Promise.all( [
		connectionStore.load(),
		colorSchemePreference.load(),
		hapticsPreference.load(),
		watchReduceTransparency(),
	] ).then( () => undefined );
	return started;
}
