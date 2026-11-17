import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/use-theme';
import { FloatingSurface } from './FloatingSurface';
import type { IconButtonProps } from './IconButton.types';

// A round button with an icon. This file is the iOS version: a glass circle.
// Android has IconButton.android.tsx, a Material 3 icon button.
export function IconButton( { icon: Icon, label, onPress }: IconButtonProps ) {
	const { colors } = useTheme();

	return (
		<Pressable accessibilityRole="button" accessibilityLabel={ label } onPress={ onPress }>
			<FloatingSurface style={ styles.circle }>
				<Icon color={ colors.foreground } size={ 20 } />
			</FloatingSurface>
		</Pressable>
	);
}

const styles = StyleSheet.create( {
	circle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
} );
