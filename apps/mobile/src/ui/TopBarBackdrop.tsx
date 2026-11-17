import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/use-theme';
import { useSurfaceMode } from './use-surface-mode';

// What sits behind the controls at the top of a screen that scrolls under
// them. On iOS that is the system's chrome blur, as behind a navigation bar,
// so text that scrolls under the glass controls does not fight with them.
// It is solid when the system asks for less transparency. Android has
// TopBarBackdrop.android.tsx.
export function TopBarBackdrop() {
	const mode = useSurfaceMode();
	const { scheme, colors } = useTheme();

	if ( mode === 'solid' ) {
		return (
			<View
				pointerEvents="none"
				style={ [ StyleSheet.absoluteFill, { backgroundColor: colors.background } ] }
			/>
		);
	}
	return (
		<BlurView
			pointerEvents="none"
			intensity={ 100 }
			tint={ scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight' }
			style={ StyleSheet.absoluteFill }
		/>
	);
}
