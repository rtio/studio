import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { resolveSurfaceMode } from './surface-mode';
import type { SurfaceMode } from './surface-mode';

function useReduceTransparency(): boolean {
	const [ enabled, setEnabled ] = useState( false );

	useEffect( () => {
		let cancelled = false;
		void AccessibilityInfo.isReduceTransparencyEnabled().then( ( value ) => {
			if ( ! cancelled ) {
				setEnabled( value );
			}
		} );
		const subscription = AccessibilityInfo.addEventListener(
			'reduceTransparencyChanged',
			setEnabled
		);
		return () => {
			cancelled = true;
			subscription.remove();
		};
	}, [] );

	return enabled;
}

export function useSurfaceMode(): SurfaceMode {
	const reduceTransparency = useReduceTransparency();

	return resolveSurfaceMode( {
		os: Platform.OS,
		glassApiAvailable:
			Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable(),
		reduceTransparency,
	} );
}
