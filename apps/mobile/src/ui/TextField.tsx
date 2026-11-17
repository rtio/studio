import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { fonts, space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import { Text } from './Text';
import type { TextInputProps } from 'react-native';

interface TextFieldProps extends Omit< TextInputProps, 'style' | 'onFocus' | 'onBlur' > {
	label: string;
}

// A labelled one-line text field. The input is React Native's on both platforms.
// The theme gives it the platform's colors, and the corner radius follows the
// platform: Material's small corner on Android, a rounder one on iOS.
export function TextField( { label, ...rest }: TextFieldProps ) {
	const { colors } = useTheme();
	const [ focused, setFocused ] = useState( false );

	return (
		<View style={ styles.field }>
			<Text variant="label">{ label }</Text>
			<TextInput
				{ ...rest }
				accessibilityLabel={ label }
				placeholderTextColor={ colors.placeholder }
				cursorColor={ colors.accent }
				selectionColor={ colors.accent }
				onFocus={ () => setFocused( true ) }
				onBlur={ () => setFocused( false ) }
				style={ [
					styles.input,
					{
						color: colors.foreground,
						backgroundColor: colors.background,
						borderColor: focused ? colors.accent : colors.border,
					},
				] }
			/>
		</View>
	);
}

const styles = StyleSheet.create( {
	field: { gap: space[ 2 ] },
	input: {
		minHeight: 48,
		paddingHorizontal: space[ 3 ],
		borderWidth: 1,
		borderRadius: Platform.select( { android: 4, default: 12 } ),
		fontFamily: fonts.regular,
		// Larger than body text: typed text must be easy to read and check.
		fontSize: 16,
	},
} );
