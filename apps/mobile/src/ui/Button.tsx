import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/use-theme';
import { Text } from './Text';
import type { ButtonProps } from './Button.types';

// A button with a text label. This file is the iOS version: a capsule that
// dims while pressed. Android has Button.android.tsx, a Material 3 button.
export function Button( { label, onPress, variant = 'primary', disabled = false }: ButtonProps ) {
	const { colors } = useTheme();
	const fill = variant === 'primary' ? colors.primary : colors.muted;
	let ink: 'primaryForeground' | 'destructive' | 'foreground' = 'foreground';
	if ( variant === 'primary' ) {
		ink = 'primaryForeground';
	} else if ( variant === 'destructive' ) {
		ink = 'destructive';
	}

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={ { disabled } }
			disabled={ disabled }
			onPress={ onPress }
			style={ ( { pressed } ) => [
				styles.button,
				{ backgroundColor: fill },
				pressed && styles.pressed,
				disabled && styles.disabled,
			] }
		>
			<Text variant="label" color={ ink }>
				{ label }
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create( {
	button: {
		minHeight: 44,
		paddingHorizontal: 20,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	pressed: { opacity: 0.7 },
	disabled: { opacity: 0.4 },
} );
