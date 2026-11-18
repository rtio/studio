import { Host } from '@expo/ui';
import { Switch } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { STUDIO_SEED_COLOR } from '../theme/seed';
import { space } from '../theme/typography';
import { useTheme } from '../theme/use-theme';
import { Text } from './Text';
import type { SwitchRowProps } from './SwitchRow.types';

// The Android version of SwitchRow: the label, then a Material 3 switch drawn
// by Jetpack Compose. The universal labelled switch sizes its row to the whole
// label on one line and pushes the switch off the screen.
export function SwitchRow( { label, value, onValueChange }: SwitchRowProps ) {
	const { scheme } = useTheme();

	return (
		<View style={ styles.row }>
			<Text style={ styles.label }>{ label }</Text>
			<Host matchContents seedColor={ STUDIO_SEED_COLOR } colorScheme={ scheme }>
				<Switch
					value={ value }
					onCheckedChange={ onValueChange }
					modifiers={ [ semantics( { contentDescription: label } ) ] }
				/>
			</Host>
		</View>
	);
}

const styles = StyleSheet.create( {
	row: { flexDirection: 'row', alignItems: 'center', gap: space[ 3 ] },
	label: { flex: 1 },
} );
