import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import type { FloatingSurfaceProps } from './FloatingSurface.types';

// The Android version of FloatingSurface. Android follows Material 3: an opaque
// tonal surface with elevation. Its colors come from the same seeded palette that
// themes the Compose controls, so both match.
export function FloatingSurface( { children, style, radius = 22 }: FloatingSurfaceProps ) {
	const colors = useMaterialColors( { seedColor: STUDIO_SEED_COLOR } );

	return (
		<View
			style={ [
				{ borderRadius: radius, backgroundColor: colors.surfaceContainerHigh, elevation: 3 },
				style,
			] }
		>
			{ children }
		</View>
	);
}
