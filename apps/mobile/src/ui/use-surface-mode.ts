import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { reduceTransparencyStore } from './reduce-transparency';
import { resolveSurfaceMode } from './surface-mode';
import type { SurfaceMode } from './surface-mode';

export function useSurfaceMode(): SurfaceMode {
	const reduceTransparency = useSyncExternalStore(
		reduceTransparencyStore.subscribe,
		reduceTransparencyStore.get
	);

	return resolveSurfaceMode( {
		os: Platform.OS,
		glassApiAvailable:
			Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable(),
		reduceTransparency,
	} );
}
