import { View } from 'react-native';
import { useTheme } from '../theme/use-theme';
import { FLOATING_SURFACE_RADIUS } from './FloatingSurface.types';
import type { FloatingSurfaceProps } from './FloatingSurface.types';

// The Android version of FloatingSurface. Android follows Material 3: an opaque
// tonal surface with elevation, with no blur. Its color is a Material role from
// the theme, so it matches the Compose controls.
export function FloatingSurface( {
	children,
	style,
	radius = FLOATING_SURFACE_RADIUS,
}: FloatingSurfaceProps ) {
	const { colors } = useTheme();

	return (
		<View
			style={ [
				{
					borderRadius: radius,
					backgroundColor: colors.floating,
					elevation: 3,
					// Keeps children inside the rounded corners. The shadow stays.
					overflow: 'hidden',
				},
				style,
			] }
		>
			{ children }
		</View>
	);
}
