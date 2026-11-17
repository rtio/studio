import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/use-theme';

// The Android version of TopBarBackdrop: Material 3's top app bar is opaque,
// so content that scrolls under it is hidden.
export function TopBarBackdrop() {
	const { colors } = useTheme();

	return (
		<View
			pointerEvents="none"
			style={ [ StyleSheet.absoluteFill, { backgroundColor: colors.background } ] }
		/>
	);
}
