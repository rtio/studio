import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/use-theme';
import type { SendButtonProps } from './SendButton.types';

// The round button that sends from the composer: Studio's near-black primary.
// This file is the iOS version. Android has SendButton.android.tsx, a Material 3
// filled icon button.
export function SendButton( { icon: Icon, label, disabled, onPress }: SendButtonProps ) {
	const { colors } = useTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={ label }
			accessibilityState={ { disabled } }
			disabled={ disabled }
			onPress={ onPress }
			style={ [ styles.circle, { backgroundColor: disabled ? colors.muted : colors.primary } ] }
		>
			<Icon color={ disabled ? colors.mutedForeground : colors.primaryForeground } size={ 18 } />
		</Pressable>
	);
}

const styles = StyleSheet.create( {
	circle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
} );
