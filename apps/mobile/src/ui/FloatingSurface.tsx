import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/use-theme';
import { FLOATING_SURFACE_RADIUS } from './FloatingSurface.types';
import { useSurfaceMode } from './use-surface-mode';
import type { FloatingSurfaceProps } from './FloatingSurface.types';
import type { ViewStyle } from 'react-native';

// The surface for controls that float over content. This file is the version
// for iOS and for any platform that is not Android: Liquid Glass, a blur on iOS
// before 26, or a solid surface when the system asks for less transparency.
// Android has FloatingSurface.android.tsx, which draws a Material 3 surface.
export function FloatingSurface( {
	children,
	style,
	radius = FLOATING_SURFACE_RADIUS,
	interactive = false,
}: FloatingSurfaceProps ) {
	const mode = useSurfaceMode();
	const { scheme, colors } = useTheme();
	const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };

	if ( mode === 'liquid' ) {
		return (
			<GlassView
				glassEffectStyle="regular"
				isInteractive={ interactive }
				colorScheme={ scheme }
				style={ [ shape, style ] }
			>
				{ children }
			</GlassView>
		);
	}

	if ( mode === 'blur' ) {
		return (
			<View style={ [ shape, style ] }>
				<BlurView
					pointerEvents="none"
					intensity={ 60 }
					tint={ scheme }
					style={ StyleSheet.absoluteFill }
				/>
				{ children }
			</View>
		);
	}

	return (
		<View
			style={ [
				shape,
				{
					backgroundColor: colors.floating,
					borderColor: colors.floatingBorder,
					borderWidth: StyleSheet.hairlineWidth,
				},
				style,
			] }
		>
			{ children }
		</View>
	);
}
