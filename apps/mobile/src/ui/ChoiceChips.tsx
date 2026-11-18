import { Pressable, StyleSheet, View } from 'react-native';
import { space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import { Text } from './Text';
import type { ChoiceChipsProps } from './ChoiceChips.types';

// One choice out of several, as chips that wrap onto more lines. This file is
// the iOS version: rounded pills. Android has ChoiceChips.android.tsx, Material
// 3 filter chips.
export function ChoiceChips( { label, options, value, onChange }: ChoiceChipsProps ) {
	const { colors } = useTheme();

	return (
		<View accessibilityRole="radiogroup" accessibilityLabel={ label } style={ styles.chips }>
			{ options.map( ( option ) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={ option.value }
						accessibilityRole="radio"
						accessibilityState={ { selected } }
						onPress={ () => onChange( option.value ) }
						style={ ( { pressed } ) => [
							styles.chip,
							{
								borderColor: selected ? colors.accent : colors.border,
								backgroundColor: selected ? colors.accentSubtle : 'transparent',
							},
							pressed && { opacity: 0.6 },
						] }
					>
						<Text color={ selected ? 'accentText' : 'foreground' }>{ option.label }</Text>
					</Pressable>
				);
			} ) }
		</View>
	);
}

const styles = StyleSheet.create( {
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[ 2 ] },
	chip: {
		minHeight: 36,
		paddingHorizontal: space[ 3 ],
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
	},
} );
