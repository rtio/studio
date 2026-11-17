import { Search } from 'lucide-react-native';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { fonts, space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';

interface SearchFieldProps {
	value: string;
	onChangeText: ( value: string ) => void;
	placeholder: string;
}

// A search box: a quiet filled field with a magnifier.
export function SearchField( { value, onChangeText, placeholder }: SearchFieldProps ) {
	const { colors } = useTheme();

	return (
		<View style={ [ styles.field, { backgroundColor: colors.muted } ] }>
			<Search color={ colors.mutedForeground } size={ 18 } />
			<TextInput
				value={ value }
				onChangeText={ onChangeText }
				placeholder={ placeholder }
				accessibilityLabel={ placeholder }
				placeholderTextColor={ colors.placeholder }
				cursorColor={ colors.accent }
				selectionColor={ colors.accent }
				autoCapitalize="none"
				autoCorrect={ false }
				returnKeyType="search"
				clearButtonMode="while-editing"
				style={ [ styles.input, { color: colors.foreground } ] }
			/>
		</View>
	);
}

const styles = StyleSheet.create( {
	field: {
		minHeight: Platform.select( { android: 48, default: 44 } ),
		paddingHorizontal: space[ 3 ],
		borderRadius: Platform.select( { android: 24, default: 12 } ),
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 2 ],
	},
	input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
} );
