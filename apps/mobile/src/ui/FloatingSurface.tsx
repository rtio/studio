import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { useSurfaceMode } from './use-surface-mode';
import type { FloatingSurfaceProps } from './FloatingSurface.types';
import type { ViewStyle } from 'react-native';

// The surface for controls that float over content. This file is the iOS version:
// Liquid Glass, a blur on older iOS, or a solid surface. Android has its own file,
// FloatingSurface.android.tsx, which draws a Material 3 surface.
export function FloatingSurface( { children, style, radius = 22 }: FloatingSurfaceProps ) {
	const mode = useSurfaceMode();
	const dark = useColorScheme() === 'dark';
	const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };

	if ( mode === 'liquid' ) {
		return (
			<GlassView
				glassEffectStyle="regular"
				isInteractive
				colorScheme={ dark ? 'dark' : 'light' }
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
					tint={ dark ? 'dark' : 'light' }
					style={ StyleSheet.absoluteFill }
				/>
				{ children }
			</View>
		);
	}

	return (
		<View style={ [ shape, { backgroundColor: dark ? '#222327' : '#ffffff' }, style ] }>
			{ children }
		</View>
	);
}
