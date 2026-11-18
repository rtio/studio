import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { secureStorage } from '../lib/secure-storage';
import { createHapticsPreference } from './haptics-preference';
import type { HapticMoment } from '../data/haptic-moments';

export const hapticsPreference = createHapticsPreference( secureStorage );

export function useHapticsPreference(): boolean {
	return useSyncExternalStore( hapticsPreference.subscribe, hapticsPreference.get );
}

// A light tap when a message goes out; the system's warning when the agent
// needs an answer, its success when a turn ends well, its error when it fails.
export function playHaptic( moment: HapticMoment | 'send' ): void {
	if ( ! hapticsPreference.get() ) {
		return;
	}
	let played: Promise< void >;
	switch ( moment ) {
		case 'send':
			played = Haptics.impactAsync( Haptics.ImpactFeedbackStyle.Light );
			break;
		case 'needs-answer':
			played = Haptics.notificationAsync( Haptics.NotificationFeedbackType.Warning );
			break;
		case 'finished':
			played = Haptics.notificationAsync( Haptics.NotificationFeedbackType.Success );
			break;
		case 'failed':
			played = Haptics.notificationAsync( Haptics.NotificationFeedbackType.Error );
			break;
	}
	// A phone without haptics, or with them off in its settings, does nothing.
	played.catch( () => undefined );
}
