import { Pressable, StyleSheet, View } from 'react-native';
import { space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import { Text } from './Text';
import type { ChoiceRowProps } from './ChoiceRow.types';

// A choice of one out of a few options, side by side. This file is the iOS
// version: a segmented control. Android has ChoiceRow.android.tsx, a Material 3
// segmented button row.
export function ChoiceRow< Value extends string >( {
	label,
	options,
	value,
	onChange,
}: ChoiceRowProps< Value > ) {
	const { colors } = useTheme();

	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={ label }
			style={ [ styles.row, { backgroundColor: colors.muted } ] }
		>
			{ options.map( ( option ) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={ option.value }
						accessibilityRole="radio"
						accessibilityState={ { selected } }
						onPress={ () => onChange( option.value ) }
						style={ [ styles.option, selected && { backgroundColor: colors.background } ] }
					>
						<Text variant="label" color={ selected ? 'foreground' : 'mutedForeground' }>
							{ option.label }
						</Text>
					</Pressable>
				);
			} ) }
		</View>
	);
}

const styles = StyleSheet.create( {
	row: { flexDirection: 'row', padding: 2, borderRadius: 12 },
	option: {
		flex: 1,
		minHeight: 40,
		paddingHorizontal: space[ 2 ],
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
} );
